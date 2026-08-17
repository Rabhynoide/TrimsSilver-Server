// Regenerates src/data/item-catalog.json from broderickhyman/ao-bin-dumps.
// Run manually after major Albion Online game patches: npm run catalog:build

import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const RAW_ITEMS_URL =
  "https://raw.githubusercontent.com/broderickhyman/ao-bin-dumps/master/items.json";
const FORMATTED_ITEMS_URL =
  "https://raw.githubusercontent.com/broderickhyman/ao-bin-dumps/master/formatted/items.json";

const OUTPUT_PATH = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "src",
  "data",
  "item-catalog.json",
);

async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to fetch ${url}: ${res.status} ${res.statusText}`);
  }
  return res.json();
}

function buildNameIndex(formattedItems) {
  const nameByUniqueName = new Map();
  for (const item of formattedItems) {
    const enName = item.LocalizedNames?.["EN-US"];
    if (item.UniqueName && enName) {
      nameByUniqueName.set(item.UniqueName, enName);
    }
  }
  return nameByUniqueName;
}

// Two unrelated enchant-variant conventions exist in the game data:
// - Equipment (weapons/armor/artifacts/...): the base item's own entry has a
//   nested `enchantments.enchantment` array; enchanted variants aren't
//   separate top-level items. AODP addresses them as `UNIQUENAME@N`.
// - Resources (ore/wood/fiber/hide/rock, refined metal bar/planks/leather/
//   cloth): each enchant level is its own standalone top-level item, named
//   `UNIQUENAME_LEVELN`, with no localization entry of its own (the game
//   client synthesizes "Uncommon/Rare/Exceptional/Pristine {name}" client-side
//   rather than storing it as a string). AODP addresses them as
//   `UNIQUENAME_LEVELN`, not `UNIQUENAME@N`.
const LEVEL_SUFFIX = /_LEVEL([1-4])$/;

function findStandaloneEnchantLevels(rawItems) {
  const itemTypeKeys = Object.keys(rawItems.items).filter(
    (key) => !key.startsWith("@") && key !== "shopcategories",
  );

  const maxLevelByBaseName = new Map();
  for (const typeKey of itemTypeKeys) {
    const bucket = rawItems.items[typeKey];
    const entries = Array.isArray(bucket) ? bucket : [bucket];
    for (const entry of entries) {
      const uniqueName = entry["@uniquename"];
      const match = uniqueName?.match(LEVEL_SUFFIX);
      if (!match) continue;

      const baseName = uniqueName.slice(0, match.index);
      const level = parseInt(match[1], 10);
      maxLevelByBaseName.set(baseName, Math.max(maxLevelByBaseName.get(baseName) ?? 0, level));
    }
  }
  return maxLevelByBaseName;
}

function extractCatalog(rawItems, nameByUniqueName) {
  const itemTypeKeys = Object.keys(rawItems.items).filter(
    (key) => !key.startsWith("@") && key !== "shopcategories",
  );
  const standaloneEnchantLevels = findStandaloneEnchantLevels(rawItems);

  const rows = [];
  for (const typeKey of itemTypeKeys) {
    const bucket = rawItems.items[typeKey];
    const entries = Array.isArray(bucket) ? bucket : [bucket];

    for (const entry of entries) {
      const uniqueName = entry["@uniquename"];
      const shopCategory = entry["@shopcategory"];
      if (!uniqueName || !shopCategory) continue;

      // Standalone _LEVELN entries aren't their own catalog item — they're
      // folded into their base item's maxEnchant below.
      if (LEVEL_SUFFIX.test(uniqueName)) continue;

      // Vanity/cosmetic skins, GvG trophies, quest items etc. carry a shopcategory
      // for in-game UI purposes but aren't player-tradable and mostly have no icon
      // under this uniqueName in the render service — exclude them from the catalog.
      if (entry["@showinmarketplace"] === "false") continue;
      if (entry["@hidefromplayer"] === "true") continue;

      let tier = entry["@tier"] ? parseInt(entry["@tier"], 10) : null;
      if (tier == null) {
        const match = uniqueName.match(/^T(\d)_/);
        if (match) tier = parseInt(match[1], 10);
      }
      if (tier == null) continue;

      const name = nameByUniqueName.get(uniqueName);
      if (!name) continue;

      let maxEnchant = 0;
      let enchantSuffix = "@";
      const enchantments = entry.enchantments?.enchantment;
      if (enchantments) {
        maxEnchant = Array.isArray(enchantments) ? enchantments.length : 1;
        enchantSuffix = "@";
      } else if (standaloneEnchantLevels.has(uniqueName)) {
        maxEnchant = standaloneEnchantLevels.get(uniqueName);
        enchantSuffix = "_LEVEL";
      }

      // Only equipment/mounts have quality (Normal..Masterpiece, 1-5) — gathered
      // and refined resources, farmables, consumables, furniture etc. are always
      // quality 1. `@maxqualitylevel` is only present on items that vary.
      const hasQuality = Boolean(entry["@maxqualitylevel"]);

      rows.push({
        uniqueName,
        name,
        tier,
        maxEnchant,
        enchantSuffix,
        hasQuality,
        shopCategory,
        shopSubCategory1: entry["@shopsubcategory1"] ?? null,
      });
    }
  }

  rows.sort((a, b) => a.name.localeCompare(b.name) || a.tier - b.tier);
  return rows;
}

async function main() {
  console.log("Fetching ao-bin-dumps item data...");
  const [rawItems, formattedItems] = await Promise.all([
    fetchJson(RAW_ITEMS_URL),
    fetchJson(FORMATTED_ITEMS_URL),
  ]);

  const nameByUniqueName = buildNameIndex(formattedItems);
  const catalog = extractCatalog(rawItems, nameByUniqueName);

  writeFileSync(OUTPUT_PATH, JSON.stringify(catalog), "utf-8");
  console.log(`Wrote ${catalog.length} items to ${OUTPUT_PATH}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
