import type { CatalogItem } from "./types";

// Human-friendly grouping on top of the raw shopCategory/shopSubCategory1 game
// data fields, used to drive the Shop Categories tree (CategoryTree.tsx).
// Order here is display order.
//
// IMPORTANT: commit 541c284 switched the catalog's raw data source (the old
// broderickhyman/ao-bin-dumps repo had been archived/frozen since Jan 2023 —
// see PROJECT_STATUS.md's "Stale data source discovered and fixed"), and the
// new source uses an entirely different shopCategory/shopSubCategory1
// vocabulary. This file's mapping wasn't updated at the time, so every case
// below silently stopped matching anything except a handful of values that
// happened to still be spelled the same ("mounts", "consumables",
// "artefacts", "furniture") — roughly 57% of the catalog (6,046 of 10,265
// item×enchant variants) was falling into "Autre" undetected. Rebuilt here
// against the actual current values (verified via `node -e` against
// src/data/item-catalog.json, not guessed).
//
// Top-level buckets are matched 1:1 to AFM's own Price Checker
// (albionfreemarket.com/pricecheck > Select Items > Shop Categories,
// inspected live): 16 top categories — and conveniently, the new data
// source's own top-level shopCategory values (weapons/armors/head/shoes/
// offhands/capes/bags/mounts/consumables/gathering/crafting/artefacts/
// farming/furniture/vanity/other) already correspond one-to-one to AFM's 16
// buckets by construction, so no shopSubCategory1-based special-casing is
// needed anymore the way the old (wrong) mapping required.
const TOP_CATEGORY_ORDER = [
  "Armes",
  "Armure de torse",
  "Armure de tête",
  "Armure de pieds",
  "Armes secondaires",
  "Capes",
  "Sacs",
  "Montures",
  "Consommables",
  "Équipement de récolte",
  "Artisanat",
  "Artefacts",
  "Agriculture",
  "Meubles",
  "Cosmétiques",
  "Autre",
] as const;

const TOP_CATEGORY_BY_RAW: Record<string, string> = {
  weapons: "Armes",
  armors: "Armure de torse",
  head: "Armure de tête",
  shoes: "Armure de pieds",
  offhands: "Armes secondaires",
  capes: "Capes",
  bags: "Sacs",
  mounts: "Montures",
  consumables: "Consommables",
  gathering: "Équipement de récolte",
  crafting: "Artisanat",
  artefacts: "Artefacts",
  farming: "Agriculture",
  furniture: "Meubles",
  vanity: "Cosmétiques",
  other: "Autre",
};

export function topCategoryOf(item: CatalogItem): string {
  return TOP_CATEGORY_BY_RAW[item.shopCategory] ?? "Autre";
}

// French labels for the raw shopSubCategory1 codes, sampled directly from
// the current catalog (src/data/item-catalog.json) rather than carried over
// from the old data source's vocabulary — see the note above topCategoryOf.
// Codes not listed here (rare/new ones) fall back to a capitalized version
// of the raw code.
const SUB_CATEGORY_LABELS: Record<string, string> = {
  // Weapons
  sword: "Épées",
  crossbow: "Arbalètes",
  bow: "Arcs",
  firestaff: "Bâtons de feu",
  quarterstaff: "Bâtons",
  holystaff: "Bâtons sacrés",
  cursestaff: "Bâtons maudits",
  naturestaff: "Bâtons de nature",
  froststaff: "Bâtons de givre",
  arcanestaff: "Bâtons arcaniques",
  shapeshifterstaff: "Bâtons de métamorphe",
  hammer: "Marteaux",
  knuckles: "Poings américains",
  dagger: "Dagues",
  axe: "Haches",
  spear: "Lances",
  mace: "Masses",
  // Armor sets (Chest/Head/Foot are now separate top categories, each with
  // the same three material subcategories)
  cloth_armor: "Robes",
  cloth_helmet: "Capuchons",
  cloth_shoes: "Sandales",
  leather_armor: "Vestes",
  leather_helmet: "Capuches",
  leather_shoes: "Chaussures",
  plate_armor: "Armures",
  plate_helmet: "Casques",
  plate_shoes: "Bottes",
  // Off-hands
  booktype: "Livres",
  shieldtype: "Boucliers",
  torchtype: "Torches",
  // Capes (per-city + faction, a new level of detail vs. the old data)
  accessoires_capes_capes: "Capes royales",
  accessoires_capes_avalon: "Capes d'Avalon",
  accessoires_capes_brecilien: "Capes de Brecilien",
  accessoires_capes_bridgewatch: "Capes de Bridgewatch",
  accessoires_capes_caerleon: "Capes de Caerleon",
  accessoires_capes_demon: "Capes démoniaques",
  accessoires_capes_fortsterling: "Capes de Fort Sterling",
  accessoires_capes_heretic: "Capes hérétiques",
  accessoires_capes_keeper: "Capes gardiennes",
  accessoires_capes_lymhurst: "Capes de Lymhurst",
  accessoires_capes_martlock: "Capes de Martlock",
  accessoires_capes_morgana: "Capes de Morgana",
  accessoires_capes_smuggler: "Capes de contrebandier",
  accessoires_capes_thetford: "Capes de Thetford",
  accessoires_capes_undead: "Capes des morts-vivants",
  // Bags
  bags: "Sacs",
  satchels: "Besaces",
  // Mounts
  basemounts: "Montures de base",
  battle_mount: "Montures de combat",
  raremounts: "Montures rares",
  // Consumables
  food: "Nourriture",
  potions: "Potions",
  silverbag: "Bourses d'argent",
  tomes: "Grimoires",
  // Gathering equipment
  fiber: "Fibre",
  hide: "Peau",
  ore: "Minerai",
  rock: "Pierre",
  wood: "Bois",
  tracking: "Pistage",
  // Crafting (raw/refined materials, alchemy & fishing ingredients, tokens)
  alchemy: "Alchimie",
  cityresources: "Ressources urbaines",
  refinedresources: "Ressources raffinées",
  resources: "Ressources",
  tokens: "Jetons",
  favor: "Faveur",
  fragments: "Fragments",
  // Farming
  farm: "Champ",
  farmingproducts: "Produits agricoles",
  herbgarden: "Jardin d'herbes",
  kennel: "Chenil",
  pasture: "Pâturage",
  // Furniture
  chest: "Coffres",
  house: "Maison",
  island: "Île",
  repairkit: "Kits de réparation",
  world: "Monde",
  // Other
  guilds: "Guildes",
  labourers: "Ouvriers",
  lootitem: "Butin",
  luxurygoods: "Biens de luxe",
  maps: "Cartes",
  questitems: "Objets de quête",
  trash: "Déchets",
  // Shared/misc — safe to share the same label across top categories
  // (verified: no other code below this point is ambiguous, unlike the
  // slot-type codes right above, which needed the compound-key overrides).
  other: "Autre",
  fish: "Pêche",
};

// Six raw subcategory codes (armors/capes/head/offhands/shoes/weapons) are
// reused with different meanings depending on the top category: under
// "Artefacts" they're crafting-requirement items grouped by which equipment
// slot they craft into ("Artéfacts d'armure"), under "Vanity" they're
// cosmetic-only appearance skins for that same slot ("Apparences
// d'armure") — a flat code->label map would mislabel one as the other.
// Verified via `node -e` against item-catalog.json that these are the only
// shopSubCategory1 codes reused across top categories with genuinely
// different meanings (a few others, like "fish"/"tokens"/"other", are also
// reused but the same label reads fine in both contexts).
const COMPOUND_SUB_CATEGORY_LABELS: Record<string, string> = {
  "artefacts:armors": "Artéfacts d'armure",
  "artefacts:capes": "Artéfacts de cape",
  "artefacts:head": "Artéfacts de casque",
  "artefacts:offhands": "Artéfacts d'arme secondaire",
  "artefacts:shoes": "Artéfacts de chaussures",
  "artefacts:weapons": "Artéfacts d'arme",
  "vanity:armors": "Apparences d'armure",
  "vanity:capes": "Apparences de cape",
  "vanity:head": "Apparences de casque",
  "vanity:offhands": "Apparences d'arme secondaire",
  "vanity:shoes": "Apparences de chaussures",
  "vanity:weapons": "Apparences d'arme",
  "vanity:mounts": "Apparences de monture",
};

export function subCategoryLabel(item: CatalogItem): string {
  const compound = COMPOUND_SUB_CATEGORY_LABELS[`${item.shopCategory}:${item.shopSubCategory1}`];
  if (compound) return compound;
  const raw = item.shopSubCategory1 ?? item.shopCategory;
  if (SUB_CATEGORY_LABELS[raw]) return SUB_CATEGORY_LABELS[raw];
  return raw
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

// Gear names follow "{line name} {du/de l'} {tier rank}" in French, e.g.
// "Épée large de l'Adepte" (T4) / "Épée large du Sage" (T8) — the line name
// ("Épée large") is what actually distinguishes item types; the tier rank
// duplicates the Tiers filter. Stripping it lets the category tree's last
// level show one row per type instead of one per (type, tier) combination.
// Items that don't follow the convention (mounts, resources, furniture, etc.)
// are returned unchanged and stay their own line. Case-insensitive because
// the post-541c284 data source capitalizes the rank word ("de l'Adepte")
// where the old one didn't ("de l'adepte") — verified via `node -e` against
// item-catalog.json that the /i flag alone recovers ~160 previously-missed
// items catalog-wide without introducing any false-positive matches.
const TIER_RANK_SUFFIX =
  / (?:du (?:débutant|compagnon|maître|grand maître|sage)|de l'(?:apprenti|adepte|expert))$/i;

export function hasTierRankPrefix(item: CatalogItem): boolean {
  return TIER_RANK_SUFFIX.test(item.name);
}

export function lineNameOf(item: CatalogItem): string {
  return item.name.replace(TIER_RANK_SUFFIX, "");
}

export type CategoryTreeNode = {
  label: string;
  items: CatalogItem[];
  children: Map<string, CategoryTreeNode>;
};

export function buildCategoryTree(catalog: CatalogItem[]): Map<string, CategoryTreeNode> {
  const tree = new Map<string, CategoryTreeNode>();

  for (const item of catalog) {
    const top = topCategoryOf(item);
    const sub = subCategoryLabel(item);

    if (!tree.has(top)) {
      tree.set(top, { label: top, items: [], children: new Map() });
    }
    const topNode = tree.get(top)!;
    topNode.items.push(item);

    if (!topNode.children.has(sub)) {
      topNode.children.set(sub, { label: sub, items: [], children: new Map() });
    }
    topNode.children.get(sub)!.items.push(item);
  }

  for (const node of tree.values()) {
    node.items.sort((a, b) => a.tier - b.tier || a.name.localeCompare(b.name));
    for (const child of node.children.values()) {
      child.items.sort((a, b) => a.tier - b.tier || a.name.localeCompare(b.name));
    }
  }

  return new Map(
    [...tree.entries()].sort((a, b) => {
      const ai = TOP_CATEGORY_ORDER.indexOf(a[0] as (typeof TOP_CATEGORY_ORDER)[number]);
      const bi = TOP_CATEGORY_ORDER.indexOf(b[0] as (typeof TOP_CATEGORY_ORDER)[number]);
      return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
    }),
  );
}
