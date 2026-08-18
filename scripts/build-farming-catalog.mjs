// Regenerates src/data/farming-catalog.json from broderickhyman/ao-bin-dumps.
// Run manually after major Albion Online game patches: npm run farming-catalog:build
//
// Sources three upstream files:
// - items.json (raw): `farmableitem` entries — seeds/babies, grow time, focus cost,
//   max nurture bonus, food consumption.
// - formatted/items.json: EN-US item names.
// - loot.json: resolves each recipe's `lootlist` reference to real output item(s) +
//   yield range (crop harvest, animal product harvest, and secondary bonus drops
//   like Earthworm).
// - achievements.json (raw): the farming Destiny Board spec tree (Crop Farmer,
//   Animal Breeder, Herbalist + their per-item sub-specs) — same achievement ids
//   the desktop client already uploads via FullAchievementInfo, so the web UI can
//   auto-fill a signed-in user's spec levels from already-stored data.
// - localization.json (raw, TMX): resolves spec `@DESTINYBOARD_TITLE_*` tags to
//   EN-US display names ("Carrot Farmer" etc.) — formatted/ has no localization.json.

import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const BASE_URL = "https://raw.githubusercontent.com/broderickhyman/ao-bin-dumps/master";
const RAW_ITEMS_URL = `${BASE_URL}/items.json`;
const FORMATTED_ITEMS_URL = `${BASE_URL}/formatted/items.json`;
const LOOT_URL = `${BASE_URL}/loot.json`;
const ACHIEVEMENTS_URL = `${BASE_URL}/achievements.json`;
const LOCALIZATION_URL = `${BASE_URL}/localization.json`;

const OUTPUT_PATH = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "src",
  "data",
  "farming-catalog.json",
);

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

function buildLootIndex(lootData) {
  const lootByName = new Map();
  for (const list of asArray(lootData.LootDefinition.Lootlist)) {
    const items = asArray(list.Item).map((item) => {
      // "@amount" is either a single value ("1") or a range ("3-6"); a plain
      // split+map leaves `max` as `undefined` (not NaN) for the single-value
      // case, which Number.isNaN(undefined) fails to catch — check length instead.
      const parts = String(item["@amount"]).split("-").map(Number);
      const min = parts[0];
      const max = parts.length > 1 ? parts[1] : min;
      return {
        uniqueName: item["@type"],
        chance: parseFloat(item["@chance"]),
        amountMin: min,
        amountMax: max,
      };
    });
    lootByName.set(list["@name"], items);
  }
  return lootByName;
}

// Only the standard Royal-tradeable livestock are in scope (see plan: "Beast"
// rare/faction mounts like Direwolf, Swamp Dragon, faction-war variants etc.
// are excluded — no clean sell path, several are faction/territory-locked).
const ANIMAL_STEM_PATTERN = /^T(\d)_FARM_(OX|HORSE|CHICKEN|GOAT|GOOSE|SHEEP|PIG|COW)_(BABY|GROWN)$/;
const HORSE_OX_STEMS = new Set(["OX", "HORSE"]);

function resolveLoot(lootByName, lootListName) {
  const entries = lootByName.get(lootListName) ?? [];
  if (entries.length === 0) return { main: null, bonus: [] };
  const sorted = [...entries].sort((a, b) => b.chance - a.chance);
  const [main, ...bonus] = sorted;
  return { main, bonus };
}

function buildPlantRecipes(farmables, nameByUniqueName, lootByName) {
  const recipes = [];
  for (const entry of farmables) {
    if (entry["@kind"] !== "plant") continue;

    const seedUniqueName = entry["@uniquename"];
    const name = nameByUniqueName.get(seedUniqueName);
    const harvest = entry.harvest;
    if (!name || !harvest) continue;

    const { main: crop, bonus } = resolveLoot(lootByName, harvest["@lootlist"]);
    if (!crop) continue;

    recipes.push({
      kind: "crop", // overridden by classifyPlantKind() in main() once herb stems are known
      seedUniqueName,
      name,
      tier: parseInt(entry["@tier"], 10),
      growTimeSeconds: parseInt(harvest["@growtime"], 10),
      baseFocusCost: parseInt(entry["@activefarmfocuscost"], 10),
      maxFocusBonus: parseFloat(entry["@activefarmbonus"]),
      // At spec 0, chance of getting your planted seed back (tier-driven, e.g.
      // 0% for T1, rising with tier); nurturing (spec-driven, up to
      // maxFocusBonus) adds on top of this at full spec.
      baseSeedReturnChance: parseFloat(harvest.seed?.["@chance"] ?? "0"),
      fame: parseInt(harvest["@fame"], 10),
      outputUniqueName: crop.uniqueName,
      outputName: nameByUniqueName.get(crop.uniqueName) ?? crop.uniqueName,
      outputAmountMin: crop.amountMin,
      outputAmountMax: crop.amountMax,
      bonusLoot: bonus.map((b) => ({
        uniqueName: b.uniqueName,
        name: nameByUniqueName.get(b.uniqueName) ?? b.uniqueName,
        chance: b.chance,
        amountMin: b.amountMin,
        amountMax: b.amountMax,
      })),
    });
  }
  return recipes;
}

// Herbs and crops are both `@kind: "plant"` with no distinguishing flag in
// items.json itself — the only structural difference is their uniqueName stem
// (herb seed names: AGARIC/COMFREY/BURDOCK/TEASEL/FOXGLOVE/MULLEIN/YARROW,
// cross-checked against wiki.albiononline.com/wiki/Farming's Herb table).
const HERB_STEMS = new Set([
  "AGARIC",
  "COMFREY",
  "BURDOCK",
  "TEASEL",
  "FOXGLOVE",
  "MULLEIN",
  "YARROW",
]);

function classifyPlantKind(seedUniqueName) {
  for (const stem of HERB_STEMS) {
    if (seedUniqueName.includes(`_${stem}_`)) return "herb";
  }
  return "crop";
}

function buildAnimalRecipes(farmables, nameByUniqueName, lootByName) {
  const recipes = [];
  for (const entry of farmables) {
    if (entry["@kind"] !== "animal") continue;

    const babyUniqueName = entry["@uniquename"];
    const match = babyUniqueName.match(ANIMAL_STEM_PATTERN);
    if (!match || match[3] !== "BABY") continue; // GROWN entries handled via grownitem below

    const name = nameByUniqueName.get(babyUniqueName);
    const grown = entry.grownitem;
    if (!name || !grown) continue;

    const grownUniqueName = grown["@uniquename"];
    const grownEntry = farmables.find((f) => f["@uniquename"] === grownUniqueName);

    // Two distinct food-consumption contexts exist in the raw data: the BABY
    // entry's `consumption` is what's fed to grow it to adulthood; the GROWN
    // entry's own (separate, sometimes absent) `consumption` is what's fed per
    // recurring product cycle (milk/eggs/wool) once mature.
    const growthConsumption = entry.consumption?.food;
    const productConsumption = grownEntry?.consumption?.food;

    const recipe = {
      kind: "animal",
      isHorseOrOx: HORSE_OX_STEMS.has(match[2]),
      babyUniqueName,
      name,
      tier: parseInt(entry["@tier"], 10),
      growTimeSeconds: parseInt(grown["@growtime"], 10),
      baseFocusCost: parseInt(entry["@activefarmfocuscost"], 10),
      maxFocusBonus: parseFloat(entry["@activefarmbonus"]),
      // Same shape as a plant's baseSeedReturnChance, but for offspring.
      baseOffspringChance: parseFloat(grown.offspring?.["@chance"] ?? "0"),
      fame: parseInt(grown["@fame"], 10),
      grownUniqueName,
      grownName: nameByUniqueName.get(grownUniqueName) ?? grownUniqueName,
      growthFood: growthConsumption
        ? {
            foodCategory: growthConsumption.acceptedfood?.["@foodcategory"] ?? null,
            nutritionMax: parseInt(growthConsumption["@nutritionmax"], 10),
            secondsPerNutrition: parseInt(growthConsumption["@secondspernutrition"], 10),
          }
        : null,
      product: null,
    };

    const product = grownEntry?.products?.product;
    if (product) {
      const { main } = resolveLoot(lootByName, product["@lootlist"]);
      if (main) {
        recipe.product = {
          productionTimeSeconds: parseInt(product["@productiontime"], 10),
          fame: parseInt(product["@fame"], 10),
          outputUniqueName: main.uniqueName,
          outputName: nameByUniqueName.get(main.uniqueName) ?? main.uniqueName,
          outputAmountMin: main.amountMin,
          outputAmountMax: main.amountMax,
          food: productConsumption
            ? {
                foodCategory: productConsumption.acceptedfood?.["@foodcategory"] ?? null,
                nutritionMax: parseInt(productConsumption["@nutritionmax"], 10),
                secondsPerNutrition: parseInt(productConsumption["@secondspernutrition"], 10),
              }
            : null,
        };
      }
    }

    recipes.push(recipe);
  }
  return recipes;
}

function buildFoodIndex(rawItems, nameByUniqueName) {
  const foods = [];
  for (const entry of asArray(rawItems.items.simpleitem)) {
    const foodCategory = entry["@foodcategory"];
    if (!foodCategory) continue;
    const uniqueName = entry["@uniquename"];
    const name = nameByUniqueName.get(uniqueName);
    if (!name) continue;
    foods.push({
      uniqueName,
      name,
      tier: entry["@tier"] ? parseInt(entry["@tier"], 10) : null,
      foodCategory,
      nutrition: parseInt(entry["@nutrition"], 10),
    });
  }
  return foods;
}

function buildLocalizationIndex(tmx) {
  const textByTag = new Map();
  for (const tu of tmx.body.tu) {
    const tuv = Array.isArray(tu.tuv)
      ? tu.tuv.find((t) => t["@xml:lang"] === "EN-US") ?? tu.tuv[0]
      : tu.tuv;
    if (tu["@tuid"] && tuv?.seg) {
      textByTag.set(tu["@tuid"], tuv.seg);
    }
  }
  return textByTag;
}

function buildSpecs(achievementsData, textByTag) {
  const specs = [];
  for (const entry of asArray(achievementsData.achievements.templateachievement)) {
    if (entry["@category"] !== "farming") continue;
    const id = entry["@id"];
    if (!/^FARM_(CROPS|ANIMALS|HERBS)/.test(id)) continue;

    const titleTag = entry.title?.["@tag"];
    const name = titleTag ? (textByTag.get(titleTag) ?? id) : id;

    const bonus = asArray(entry.baserewards?.bonus).find(
      (b) => b["@type"] === "farmingfocuscostreduction",
    );

    const parentIds = asArray(entry.parentachievements?.achievement).map((p) => p["@id"]);
    const group = id.startsWith("FARM_CROPS")
      ? "crops"
      : id.startsWith("FARM_ANIMALS")
        ? "animals"
        : "herbs";

    specs.push({
      id,
      name,
      group,
      isCategoryRoot: id === "FARM_CROPS" || id === "FARM_ANIMALS" || id === "FARM_HERBS",
      parentId: parentIds.find((p) => p.startsWith("FARM_")) ?? null,
      focusCostReductionWeight: bonus ? parseFloat(bonus["@bonus"]) : 0,
    });
  }
  specs.sort((a, b) => a.group.localeCompare(b.group) || a.id.localeCompare(b.id));
  return specs;
}

async function main() {
  console.log("Fetching ao-bin-dumps farming data (items, loot, achievements, localization)...");
  const [rawItems, formattedItems, lootData, achievementsData, localizationData] =
    await Promise.all([
      fetchJson(RAW_ITEMS_URL),
      fetchJson(FORMATTED_ITEMS_URL),
      fetchJson(LOOT_URL),
      fetchJson(ACHIEVEMENTS_URL),
      fetchJson(LOCALIZATION_URL),
    ]);

  const nameByUniqueName = buildNameIndex(formattedItems);
  const lootByName = buildLootIndex(lootData);
  const farmables = asArray(rawItems.items.farmableitem);

  const plantRecipes = buildPlantRecipes(farmables, nameByUniqueName, lootByName).map((r) => ({
    ...r,
    kind: classifyPlantKind(r.seedUniqueName),
  }));
  const animalRecipes = buildAnimalRecipes(farmables, nameByUniqueName, lootByName);
  const foods = buildFoodIndex(rawItems, nameByUniqueName);

  const textByTag = buildLocalizationIndex(localizationData.tmx);
  const specs = buildSpecs(achievementsData, textByTag);

  const catalog = {
    recipes: [...plantRecipes, ...animalRecipes],
    foods,
    specs,
  };

  writeFileSync(OUTPUT_PATH, JSON.stringify(catalog), "utf-8");
  console.log(
    `Wrote ${plantRecipes.length} plant + ${animalRecipes.length} animal recipes, ` +
      `${foods.length} foods, ${specs.length} specs to ${OUTPUT_PATH}`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
