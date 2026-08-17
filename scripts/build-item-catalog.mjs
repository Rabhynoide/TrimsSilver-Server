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

function extractCatalog(rawItems, nameByUniqueName) {
  const itemTypeKeys = Object.keys(rawItems.items).filter(
    (key) => !key.startsWith("@") && key !== "shopcategories",
  );

  const rows = [];
  for (const typeKey of itemTypeKeys) {
    const bucket = rawItems.items[typeKey];
    const entries = Array.isArray(bucket) ? bucket : [bucket];

    for (const entry of entries) {
      const uniqueName = entry["@uniquename"];
      const shopCategory = entry["@shopcategory"];
      if (!uniqueName || !shopCategory) continue;

      let tier = entry["@tier"] ? parseInt(entry["@tier"], 10) : null;
      if (tier == null) {
        const match = uniqueName.match(/^T(\d)_/);
        if (match) tier = parseInt(match[1], 10);
      }
      if (tier == null) continue;

      const name = nameByUniqueName.get(uniqueName);
      if (!name) continue;

      let maxEnchant = 0;
      const enchantments = entry.enchantments?.enchantment;
      if (enchantments) {
        maxEnchant = Array.isArray(enchantments) ? enchantments.length : 1;
      }

      rows.push({
        uniqueName,
        name,
        tier,
        maxEnchant,
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
