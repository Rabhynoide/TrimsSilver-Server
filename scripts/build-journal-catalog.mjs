// Regenerates src/data/journal-catalog.json from broderickhyman/ao-bin-dumps.
// Run manually after major Albion Online game patches: npm run journal-catalog:build
//
// Source: items.json's `journalitem` bucket (133 rows = 19 journal families ×
// T2-T8) plus `simpleitem` (for raw-resource `@famevalue`, the exact
// fame-per-unit a resource contributes toward filling a gathering journal —
// confirmed against wiki.albiononline.com/wiki/Journal's own "Fame per
// Resource" table, e.g. T4_WOOD's @famevalue=7.5 and T4_WOOD_LEVEL1's
// @famevalue=15 match that table exactly).
//
// Each journal item already carries, straight from game data:
// - @maxfame: total fame needed to fill it (confirmed against the wiki's
//   "Fame required to fill" tables for every journal type — gathering,
//   crafting, mercenary, general/fishing trophy).
// - @baselootamount: the 100%-yield base multiplier for its delivery reward.
// - lootlist.loot[]: the exact weighted reward table (itemname/itemamount/
//   weight, or silveramount/weight for Mercenary journals) — used as-is
//   instead of the wiki's simplified aggregate percentages, since it's the
//   authoritative source those percentages were themselves derived from.
// - famefillingmissions.gatherfame.validitem: for the 5 raw-resource
//   gathering journals (Wood/Stone/Ore/Fiber/Hide) and their 5 Trophy
//   counterparts, the exact list of resource items (own tier through +2,
//   all 5 enchant levels) that count toward filling it.
//
// Deliberately NOT modeled here (see the Journals Calculator plan): fill
// cost for Fishing/Trophy Fishing (any-tier-any-fish, dozens of biome/rarity
// SKUs, no single "the" input resource), Crafting journals (Blacksmith/
// Fletcher/Imbuer/Tinker — crafting fame per equipment item isn't a field in
// this data; the @famevalue mechanic only covers enchanted refined
// resources' bonus fame, not base crafting fame), Mercenary/Trophy Mercenary
// (PvE monster-kill fame, not a market-priceable input), and Trophy General
// (fills from any fame-earning activity at all). Those families still get
// full delivery/reward-side modeling (so "Buy Full, Sell Mats" works for all
// 19 families) — only their "Buy Empty, ..." fill cost is a manual entry in
// the UI rather than auto-computed.

import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const RAW_ITEMS_URL =
  "https://raw.githubusercontent.com/broderickhyman/ao-bin-dumps/master/items.json";

const OUTPUT_PATH = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "src",
  "data",
  "journal-catalog.json",
);

// Journal family -> raw resource type prefix used by its gatherfame validitem
// list (journal family names don't always match the resource's own
// @resourcetype — "STONE" journals gather "ROCK", confirmed by inspecting
// T4_JOURNAL_TROPHY_STONE's lootlist reward, which is
// T4_FURNITUREITEM_TROPHY_ROCK).
const GATHERING_FAMILIES = new Set(["WOOD", "STONE", "ORE", "FIBER", "HIDE"]);
const GATHERING_TROPHY_FAMILIES = new Set([
  "TROPHY_WOOD",
  "TROPHY_STONE",
  "TROPHY_ORE",
  "TROPHY_FIBER",
  "TROPHY_HIDE",
]);

async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to fetch ${url}: ${res.status} ${res.statusText}`);
  }
  return res.json();
}

function asArray(value) {
  if (value == null) return [];
  return Array.isArray(value) ? value : [value];
}

function buildLoot(lootlist) {
  return asArray(lootlist?.loot).map((entry) => {
    if (entry["@silveramount"] != null) {
      return {
        silverAmount: parseFloat(entry["@silveramount"]),
        weight: parseFloat(entry["@weight"] ?? "1"),
      };
    }
    return {
      itemName: entry["@itemname"],
      itemAmount: parseFloat(entry["@itemamount"] ?? "1"),
      weight: parseFloat(entry["@weight"] ?? "1"),
      enchant: entry["@itemenchantmentlevel"] ? parseInt(entry["@itemenchantmentlevel"], 10) : 0,
    };
  });
}

function buildFillOptions(item, famevalueByName) {
  const validItems = asArray(item.famefillingmissions?.gatherfame?.validitem);
  if (validItems.length === 0) return null;

  return validItems
    .map((v) => v["@id"])
    .filter(Boolean)
    .map((uniqueName) => ({ uniqueName, famevalue: famevalueByName.get(uniqueName) ?? null }))
    .filter((opt) => opt.famevalue != null);
}

function extractCatalog(rawItems) {
  const journalItems = asArray(rawItems.items.journalitem);
  const simpleItems = asArray(rawItems.items.simpleitem);

  const famevalueByName = new Map();
  for (const it of simpleItems) {
    const fame = it["@famevalue"];
    if (fame != null) famevalueByName.set(it["@uniquename"], parseFloat(fame));
  }

  const rows = [];
  for (const item of journalItems) {
    const uniqueName = item["@uniquename"];
    const tier = parseInt(item["@tier"], 10);
    const family = uniqueName.replace(`T${tier}_JOURNAL_`, "");
    const isGathering = GATHERING_FAMILIES.has(family) || GATHERING_TROPHY_FAMILIES.has(family);

    rows.push({
      uniqueName,
      family,
      tier,
      emptySilver: parseInt(item.craftingrequirements?.["@silver"] ?? "0", 10),
      maxFame: parseFloat(item["@maxfame"]),
      baseLootAmount: parseFloat(item["@baselootamount"]),
      loot: buildLoot(item.lootlist),
      fillOptions: isGathering ? buildFillOptions(item, famevalueByName) : null,
    });
  }

  rows.sort((a, b) => a.family.localeCompare(b.family) || a.tier - b.tier);
  return rows;
}

async function main() {
  console.log("Fetching ao-bin-dumps item data...");
  const rawItems = await fetchJson(RAW_ITEMS_URL);

  const catalog = extractCatalog(rawItems);

  writeFileSync(OUTPUT_PATH, JSON.stringify(catalog), "utf-8");
  console.log(`Wrote ${catalog.length} journal items to ${OUTPUT_PATH}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
