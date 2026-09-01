// Regenerates src/data/crafting-catalog.json from broderickhyman/ao-bin-dumps.
// Run manually after major Albion Online game patches: npm run crafting-catalog:build
//
// Source: items.json (raw) only — no formatted/items.json needed here, since
// this catalog stores no names (the Crafting Calculator joins against the
// existing src/data/item-catalog.json by uniqueName for names/icons/tier).
//
// Scope: only the `weapon` and `equipmentitem` buckets (weapons, armor, bags,
// capes, offhands — confirmed by inspection to cover 807+675 items, the large
// majority tagged with a crafting recipe). Deliberately excludes other
// buckets that also carry a `craftingrequirements` node — `consumableitem`/
// `consumablefrominventoryitem`/`simpleitem` (food/potions, Farming's own
// domain), `mount` (Saddler tree), `furnitureitem`, `journalitem` — to match
// the "AFM craft-calculator-simple equipment-crafting parity" scope this
// feature targets, not a blanket "anything craftable" catalog.
//
// Each item's base `craftingrequirements` (@silver/@time/@craftingfocus/
// craftresource) becomes its enchant-0 recipe; each entry in
// `enchantments.enchantment[]` (levels 1-4) carries its own parallel
// `craftingrequirements` node (resource ids get a `_LEVELN` suffix at each
// level) and becomes that enchant's recipe.
//
// `@combatspecachievement` (present on ~1040 of the ~1480 in-scope items,
// confirmed by direct inspection — it's the only `*specachievement*` field
// in the whole file, despite covering both weapon AND armor buckets) is
// captured as `specAchievementId` when present, so the web UI can auto-fill
// a signed-in user's specialization level from their already-synced
// AchievementSnapshot data, the same mechanism Farming uses for `FARM_*`
// ids. Items without the field just get `specAchievementId: null` and skip
// auto-fill — a documented gap, not a guessed category mapping.
//
// `workshop` (added for Craft Finder): every item's `@craftingcategory`
// (e.g. "sword", "plate_helmet") is mapped to the real Albion crafting
// building it's made at — confirmed against the wiki's crafting-station
// guides, not guessed: Warrior's Forge (melee weapons + plate armor),
// Hunter's Lodge (ranged weapons + leather armor), Mage's Tower (magic
// weapons + cloth armor), Toolmaker (gathering tools), Workbench
// (off-hands, bags, capes — the "Bag Tailor"/"Cape Tailor" specialization
// nodes live there, confirmed via patch notes). A small number of
// `@craftingcategory` values found in-scope don't map to any of the 5
// (internal/QA/prototype items that slipped through the marketplace
// filters below, e.g. "UNIQUE_WEAPONMASTER_ARMOR_PROTOTYPE") — these fall
// back to "workbench" rather than being dropped, a documented approximation
// for a handful of non-player-facing items, not a real gap.
//
// `craftingCategory` (added alongside `workshop`): the raw `@craftingcategory`
// string itself, kept as-is rather than only its resolved workshop — Craft
// Finder's per-city Local Production Bonus specialty (see
// craft-finder-constants.ts's CRAFTING_SPECIALTY_CITY_BY_CATEGORY) targets
// one specific weapon/armor type per city, not a whole workshop, so the
// engine needs this exact raw value to know which items qualify.

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
  "crafting-catalog.json",
);

const IN_SCOPE_BUCKETS = ["weapon", "equipmentitem"];

const CRAFTING_CATEGORY_TO_WORKSHOP = {
  // Warrior's Forge — melee weapons + plate armor
  sword: "warriors_forge",
  axe: "warriors_forge",
  mace: "warriors_forge",
  dagger: "warriors_forge",
  spear: "warriors_forge",
  quarterstaff: "warriors_forge",
  hammer: "warriors_forge",
  knuckles: "warriors_forge",
  plate_helmet: "warriors_forge",
  plate_armor: "warriors_forge",
  plate_shoes: "warriors_forge",
  // Hunter's Lodge — ranged weapons + leather armor
  bow: "hunters_lodge",
  crossbow: "hunters_lodge",
  leather_helmet: "hunters_lodge",
  leather_armor: "hunters_lodge",
  leather_shoes: "hunters_lodge",
  // Mage's Tower — magic weapons + cloth armor
  cursestaff: "mages_tower",
  firestaff: "mages_tower",
  froststaff: "mages_tower",
  arcanestaff: "mages_tower",
  holystaff: "mages_tower",
  naturestaff: "mages_tower",
  cloth_helmet: "mages_tower",
  cloth_armor: "mages_tower",
  cloth_shoes: "mages_tower",
  // Toolmaker — gathering tools
  pickaxe: "toolmaker",
  tools: "toolmaker",
  stonehammer: "toolmaker",
  woodaxe: "toolmaker",
  sickle: "toolmaker",
  skinningknife: "toolmaker",
  gatherergear: "toolmaker",
  // Workbench — off-hands, bags, capes
  shield: "workbench",
  offhand: "workbench",
  horn: "workbench",
  torch: "workbench",
  cape: "workbench",
  bag: "workbench",
};
const DEFAULT_WORKSHOP = "workbench";

function workshopFor(entry) {
  return CRAFTING_CATEGORY_TO_WORKSHOP[entry["@craftingcategory"]] ?? DEFAULT_WORKSHOP;
}

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

function buildResources(craftingrequirements) {
  return asArray(craftingrequirements?.craftresource).map((r) => ({
    uniqueName: r["@uniquename"],
    count: parseInt(r["@count"], 10),
  }));
}

function buildRecipe(enchant, craftingrequirements) {
  if (!craftingrequirements) return null;
  const resources = buildResources(craftingrequirements);
  if (resources.length === 0) return null;
  return {
    enchant,
    silver: parseInt(craftingrequirements["@silver"] ?? "0", 10),
    focusCost: parseInt(craftingrequirements["@craftingfocus"] ?? "0", 10),
    // Always 1 for equipment (confirmed by inspection — unlike food/potion
    // recipes in food-catalog.json, which frequently batch-produce more per
    // craft action), kept for shape parity with that catalog's CraftRecipe.
    amountCrafted: parseInt(craftingrequirements["@amountcrafted"] ?? "1", 10),
    resources,
  };
}

function buildRecipesForItem(entry) {
  const recipes = [];
  const base = buildRecipe(0, entry.craftingrequirements);
  if (base) recipes.push(base);

  for (const ench of asArray(entry.enchantments?.enchantment)) {
    const level = parseInt(ench["@enchantmentlevel"], 10);
    const recipe = buildRecipe(level, ench.craftingrequirements);
    if (recipe) recipes.push(recipe);
  }
  return recipes;
}

function extractCatalog(rawItems) {
  const rows = [];
  for (const bucket of IN_SCOPE_BUCKETS) {
    for (const entry of asArray(rawItems.items[bucket])) {
      const uniqueName = entry["@uniquename"];
      if (!uniqueName || !entry["@shopcategory"]) continue;
      if (entry["@showinmarketplace"] === "false") continue;
      if (entry["@hidefromplayer"] === "true") continue;

      const recipes = buildRecipesForItem(entry);
      if (recipes.length === 0) continue;

      rows.push({
        uniqueName,
        specAchievementId: entry["@combatspecachievement"] ?? null,
        workshop: workshopFor(entry),
        craftingCategory: entry["@craftingcategory"] ?? null,
        recipes,
      });
    }
  }
  rows.sort((a, b) => a.uniqueName.localeCompare(b.uniqueName));
  return rows;
}

async function main() {
  console.log("Fetching ao-bin-dumps item data...");
  const rawItems = await fetchJson(RAW_ITEMS_URL);

  const catalog = extractCatalog(rawItems);

  writeFileSync(OUTPUT_PATH, JSON.stringify(catalog), "utf-8");
  console.log(`Wrote ${catalog.length} craftable items to ${OUTPUT_PATH}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
