// Regenerates src/data/resource-catalog.json from broderickhyman/ao-bin-dumps.
// Run manually after major Albion Online game patches: npm run resource-catalog:build
//
// Source: items.json (raw) only, `simpleitem` bucket — confirmed by direct
// inspection that raw resources (ore/wood/hide/fiber/rock) AND refined
// resources (metalbar/planks/leather/cloth/stoneblock) both live here, not in
// `weapon`/`equipmentitem` (crafting-catalog.json's own scope). This is the
// piece the Crafting Calculator never needed: the resource-refining chain
// down to raw materials, required for Craft Finder's make-or-buy tree.
//
// Unlike equipment (crafting-catalog.json), an enchanted resource is NOT a
// nested `enchantments.enchantment[]` entry on a base item — each enchant
// level is its OWN standalone top-level `simpleitem` entry (its own
// `@uniquename` like "T4_METALBAR_LEVEL1") with its OWN independent
// `craftingrequirements`, confirmed by direct inspection. So this script
// scans every entry in the 10 resource subcategories individually rather
// than walking a parent's enchant array.
//
// Also confirmed by inspection: a refined resource's `craftingrequirements`
// is sometimes an ARRAY of alternative recipes, not just for "faction token"
// variants (which this script filters out) but also for genuinely distinct
// legitimate paths — e.g. T5_WOOD_LEVEL1 can be made either from 1x
// T4_WOOD_LEVEL1 (a tier-up transmutation) or 1x T5_WOOD (a same-tier
// enchant transmutation), both silver-only, no faction token. Rather than
// guessing which one is "the" recipe, every non-faction option is kept — the
// make-or-buy evaluator tries each option and picks the cheapest, the same
// way it already picks between buy vs craft.
//
// Raw resources (ore/wood/hide/fiber/rock) are recorded here too, but
// deliberately WITHOUT their crafting/transmutation options even when the
// raw data has them (an enchanted raw resource like T4_ORE_LEVEL1 does carry
// a silver-only "Resource Transmutation" recipe converting the base resource
// up an enchant level — by design decision, not modeled: they're kept as
// pure market-price leaves in the make-or-buy tree instead). They're still
// included as rows here (with `options: []`) purely to carry their own
// `itemValue` — needed as an input wherever a refined-resource or equipment
// recipe consumes a raw resource directly (e.g. T1 tools use T1_WOOD/T1_ROCK
// with no refining step in between) for Craft Finder's station-fee formula
// (see calc.ts).
//
// `itemValue` (`@itemvalue`) is the resource's own stored game-data value —
// used directly for its own crafting-station Nutrition Cost (Nutrition Cost
// = Item Value × 0.1125, confirmed against Albion's official "Usage Fee and
// Crafting Changes" patch notes) and, for raw resources, as an input to the
// consuming recipe's own derived Item Value.
//
// Food/potion ingredient chain (added alongside the original 10 material
// subcategories, for Craft Finder's Cooking/Alchemy support): confirmed by
// direct inspection that `simpleitem`'s `farming` subcategory (crops/herbs,
// e.g. T1_CARROT) and `cooked` subcategory (intermediate cooking products
// with their own recipe, e.g. T3_FLOUR → T4_BREAD, T1_FISHCHOPS +
// T1_SEAWEED → T1_FISHSAUCE_LEVELN) both carry `@itemvalue` directly, same
// as the material resources above. `essence` (T4_ESSENCE_POTION's own
// ingredient chain) mostly does too, except the root `T*_ESSENCE` items
// themselves — confirmed to have neither a stored `@itemvalue` nor any
// `craftingrequirements` of their own (a genuine dead end, not an oversight
// — they're a Hellgate/Mists-only rare drop, not a normal market resource),
// so they fall back to `itemValue: 0` like anything else with no data,
// documented as a narrow, low-impact gap (only affects Essence Potion's own
// derived Item Value). `fish` lives in the separate `consumableitem`
// bucket, not `simpleitem` — handled by its own loop below — but is
// otherwise a plain buy-only leaf exactly like the crops.

import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const FOOD_INGREDIENT_CATEGORIES = { farming: "cooking", cooked: "cooking", essence: "alchemy" };

const RAW_ITEMS_URL =
  "https://raw.githubusercontent.com/broderickhyman/ao-bin-dumps/master/items.json";

const OUTPUT_PATH = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "src",
  "data",
  "resource-catalog.json",
);

// The 10 material resource subcategories: 5 raw (gathered) + 5 refined
// (crafted from the raw counterpart) — equipment's own ingredient chain.
// `farming`/`cooked`/`essence` (food/potion's ingredient chain) are handled
// separately below via FOOD_INGREDIENT_CATEGORIES; everything else in the
// `simpleitem` bucket (maps/artefacts/mission items/etc.) stays out of
// scope for both.
const RAW_CATEGORIES = ["ore", "wood", "hide", "fiber", "rock"];
const REFINED_CATEGORIES = ["metalbar", "planks", "leather", "cloth", "stoneblock"];

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

// Faction Warfare token recipes are the same underlying craft with a bonus
// token requirement layered on top (e.g. an extra `T1_FACTION_MOUNTAIN_TOKEN_1`
// ingredient) — not a genuinely cheaper/different path a non-faction player
// can use, so they're excluded rather than offered as a real alternative.
function isFactionResource(uniqueName) {
  return uniqueName.includes("FACTION") || uniqueName.includes("TOKEN");
}

function buildRecipeOption(craftingrequirements) {
  const resources = asArray(craftingrequirements.craftresource)
    .map((r) => ({ uniqueName: r["@uniquename"], count: parseInt(r["@count"], 10) }))
    .filter((r) => r.uniqueName && !Number.isNaN(r.count));
  if (resources.length === 0) return null;
  if (resources.some((r) => isFactionResource(r.uniqueName))) return null;
  return {
    silver: parseInt(craftingrequirements["@silver"] ?? "0", 10),
    focusCost: parseInt(craftingrequirements["@craftingfocus"] ?? "0", 10),
    // Almost always 1 (one craft action = one unit), but confirmed by direct
    // inspection that some recipes genuinely batch-produce more per action
    // (e.g. T4_STONEBLOCK from certain option variants, T1_FISHCHOPS up to
    // 200 at once) — the evaluator (craft-finder/calc.ts) divides the
    // option's total cost by this to get a real per-unit cost.
    amountCrafted: parseInt(craftingrequirements["@amountcrafted"] ?? "1", 10),
    resources,
  };
}

function extractCatalog(rawItems) {
  const rows = [];
  const simple = asArray(rawItems.items.simpleitem);

  for (const entry of simple) {
    if (!entry) continue;
    const uniqueName = entry["@uniquename"];
    const subCategory = entry["@shopsubcategory1"];
    const isRaw = RAW_CATEGORIES.includes(subCategory);
    const isRefined = REFINED_CATEGORIES.includes(subCategory);
    const foodCategory = FOOD_INGREDIENT_CATEGORIES[subCategory];
    if (!uniqueName || !(isRaw || isRefined || foodCategory)) continue;

    // Raw materials deliberately skip recipe extraction (see the header
    // comment on RAW_CATEGORIES); refined materials and every food
    // ingredient subcategory attempt it — for `farming` this is always a
    // no-op (crops/herbs never carry `craftingrequirements`, confirmed by
    // inspection), so there's no need for a separate raw/refined-style split
    // there.
    const options =
      isRefined || foodCategory
        ? asArray(entry.craftingrequirements).map(buildRecipeOption).filter((o) => o !== null)
        : [];

    rows.push({
      uniqueName,
      category: foodCategory ?? subCategory,
      tier: parseInt(entry["@tier"], 10),
      enchant: parseInt(entry["@enchantmentlevel"] ?? "0", 10),
      itemValue: parseInt(entry["@itemvalue"] ?? "0", 10),
      options,
    });
  }

  // Fish (consumableitem's own `fish` subcategory, not simpleitem) — a
  // plain buy-only leaf like a crop, just addressed from a different raw
  // bucket. Confirmed by inspection: no `craftingrequirements` of its own.
  const consumables = asArray(rawItems.items.consumableitem);
  for (const entry of consumables) {
    if (!entry || entry["@shopsubcategory1"] !== "fish") continue;
    const uniqueName = entry["@uniquename"];
    if (!uniqueName) continue;
    rows.push({
      uniqueName,
      category: "cooking",
      tier: parseInt(entry["@tier"], 10),
      enchant: parseInt(entry["@enchantmentlevel"] ?? "0", 10),
      itemValue: parseInt(entry["@itemvalue"] ?? "0", 10),
      options: [],
    });
  }

  rows.sort((a, b) => a.uniqueName.localeCompare(b.uniqueName));
  return rows;
}

async function main() {
  console.log("Fetching ao-bin-dumps item data...");
  const rawItems = await fetchJson(RAW_ITEMS_URL);

  const catalog = extractCatalog(rawItems);

  writeFileSync(OUTPUT_PATH, JSON.stringify(catalog), "utf-8");
  console.log(`Wrote ${catalog.length} resource entries to ${OUTPUT_PATH}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
