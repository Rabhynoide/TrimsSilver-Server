import type { CatalogItem } from "./types";

// Human-friendly grouping on top of the raw shopcategory/shopsubcategory1 game
// data fields, used to drive the Shop Categories tree (CategoryTree.tsx).
// Order here is display order.
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
  "Cosmétiques",
  "Équipement de récolte",
  "Artefacts",
  "Agriculture",
  "Meubles",
  "Matériaux & Ressources",
  "Grimoires",
  "Trophées",
  "Contrats d'ouvriers",
  "Autre",
] as const;

export function topCategoryOf(item: CatalogItem): string {
  switch (item.shopCategory) {
    case "melee":
    case "magic":
    case "ranged":
      return "Armes";
    case "armor":
      if (item.shopSubCategory1?.endsWith("_armor")) return "Armure de torse";
      if (item.shopSubCategory1?.endsWith("_helmet")) return "Armure de tête";
      if (item.shopSubCategory1?.endsWith("_shoes")) return "Armure de pieds";
      return "Autre";
    case "offhand":
      return "Armes secondaires";
    case "accessories":
      if (item.shopSubCategory1 === "cape") return "Capes";
      if (item.shopSubCategory1 === "bag") return "Sacs";
      return "Autre";
    case "mounts":
      return "Montures";
    case "consumables":
      return item.shopSubCategory1 === "vanity" ? "Cosmétiques" : "Consommables";
    case "gatherergear":
    case "tools":
      return "Équipement de récolte";
    case "artefacts":
      return "Artefacts";
    case "farmables":
      return "Agriculture";
    case "furniture":
      return "Meubles";
    case "resources":
    case "materials":
    case "products":
      return "Matériaux & Ressources";
    case "skillbooks":
      return "Grimoires";
    case "trophies":
      return "Trophées";
    case "labourers":
      return "Contrats d'ouvriers";
    default:
      return "Autre";
  }
}

// French labels for the raw shopsubcategory1/shopcategory game-data codes,
// derived by sampling a real catalog item in each bucket and translating
// what it actually is (see PROJECT_STATUS.md) rather than guessing blind.
// Codes not listed here (rare/new ones) fall back to a capitalized version
// of the raw code, same as before this map existed.
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
  hammer: "Marteaux",
  knuckles: "Poings américains",
  dagger: "Dagues",
  axe: "Haches",
  spear: "Lances",
  mace: "Masses",
  demolitionhammer: "Marteaux de démolition",
  // Off-hand / artifacts
  shield: "Boucliers",
  torch: "Torches",
  horn: "Cor",
  orb: "Orbes",
  totem: "Totems",
  essence: "Essences",
  soul: "Âmes",
  relic: "Reliques",
  rune: "Runes",
  banner: "Bannières",
  book: "Livres",
  maps: "Cartes",
  beastheart: "Cœurs de bête",
  treeheart: "Cœurs d'arbre",
  mountainheart: "Cœurs de montagne",
  rockheart: "Cœurs de roche",
  vineheart: "Cœurs de vigne",
  blackheart: "Cœurs noirs",
  armor_artefact: "Artéfacts d'armure",
  magic_artefact: "Artéfacts magiques",
  melee_artefact: "Artéfacts de mêlée",
  ranged_artefact: "Artéfacts à distance",
  offhand_artefact: "Artéfacts d'arme secondaire",
  // Armor sets
  cloth_armor: "Robes",
  cloth_helmet: "Capuchons",
  cloth_shoes: "Sandales",
  leather_armor: "Vestes",
  leather_helmet: "Capuches",
  leather_shoes: "Chaussures",
  plate_armor: "Armures",
  plate_helmet: "Casques",
  plate_shoes: "Bottes",
  unique_shoes: "Chaussures spéciales",
  // Bags / capes
  bag: "Sacs",
  cape: "Capes",
  // Mounts
  armoredhorse: "Chevaux de guerre",
  battle_mount: "Montures de combat",
  direbear: "Ours",
  direboar: "Sangliers",
  direwolf: "Loups",
  giantstag: "Cerfs géants",
  mule: "Mulets",
  ox: "Bœufs",
  rare_mount: "Montures rares",
  ridinghorse: "Chevaux de monte",
  swampdragon: "Dragons des marais",
  // Gathering gear sets
  fibergatherer_armor: "Tenues de récolteur de fibres",
  fibergatherer_backpack: "Sacs à dos de récolteur de fibres",
  fibergatherer_helmet: "Casquettes de récolteur de fibres",
  fibergatherer_shoes: "Bottes de récolteur de fibres",
  fishgatherer_armor: "Tenues de pêcheur",
  fishgatherer_backpack: "Sacs à dos de pêcheur",
  fishgatherer_helmet: "Casquettes de pêcheur",
  fishgatherer_shoes: "Bottes de pêcheur",
  hidegatherer_armor: "Tenues de dépeceur",
  hidegatherer_backpack: "Sacs à dos de dépeceur",
  hidegatherer_helmet: "Casquettes de dépeceur",
  hidegatherer_shoes: "Bottes de dépeceur",
  oregatherer_armor: "Tenues de mineur",
  oregatherer_backpack: "Sacs à dos de mineur",
  oregatherer_helmet: "Casquettes de mineur",
  oregatherer_shoes: "Bottes de mineur",
  rockgatherer_armor: "Tenues de piocheur",
  rockgatherer_backpack: "Sacs à dos de piocheur",
  rockgatherer_helmet: "Casquettes de piocheur",
  rockgatherer_shoes: "Bottes de piocheur",
  woodgatherer_armor: "Tenues de bûcheron",
  woodgatherer_backpack: "Sacs à dos de bûcheron",
  woodgatherer_helmet: "Casquettes de bûcheron",
  woodgatherer_shoes: "Bottes de bûcheron",
  // Laborer contracts
  fibercontract: "Contrats de moissonneur",
  fishingcontract: "Contrats de pêcheur",
  hidecontract: "Contrats de garde-forestier",
  huntercontract: "Contrats d'archer",
  magecontract: "Contrats d'imprégnateur",
  mercenarycontract: "Contrats de mercenaire",
  orecontract: "Contrats de chercheur",
  stonecontract: "Contrats de tailleur de pierre",
  toolmakercontract: "Contrats de bricoleur",
  warriorcontract: "Contrats de forgeron",
  woodcontract: "Contrats de bûcheron",
  // Trophies
  fibertrophy: "Trophées de fibre",
  fishtrophy: "Trophées de pêche",
  generaltrophy: "Trophées généraux",
  hidetrophy: "Trophées de peau",
  mercenarytrophy: "Trophées de mercenaire",
  oretrophy: "Trophées de minerai",
  rocktrophy: "Trophées de pierre",
  woodtrophy: "Trophées de bois",
  // Skillbooks
  skillbook: "Grimoires",
  skillbook_fiber: "Tomes de récolteur de fibres",
  skillbook_hide: "Tomes de dépeceur",
  skillbook_ore: "Tomes de mineur",
  skillbook_rock: "Tomes de tailleur de pierre",
  skillbook_wood: "Tomes de bûcheron",
  // Journals
  journal: "Registres",
  // Farming / food / raw resources
  animals: "Animaux",
  farming: "Denrées agricoles",
  seed: "Graines",
  cooked: "Plats cuisinés",
  fish: "Poissons",
  fishingbait: "Appâts",
  potion: "Potions",
  repairkit: "Kits de réparation",
  fiber: "Fibre",
  hide: "Peau",
  metalbar: "Barres de métal",
  ore: "Minerai",
  planks: "Planches",
  rock: "Pierre",
  wood: "Bois",
  cloth: "Tissu",
  leather: "Cuir",
  stoneblock: "Blocs de pierre",
  // Avalonian gathering tools
  pickaxe: "Pioches",
  sickle: "Faucilles",
  skinningknife: "Couteaux à dépecer",
  stonehammer: "Masses de pierre",
  woodaxe: "Haches de bûcheron",
  // Furniture
  decoration_furniture: "Décorations",
  heretic_furniture: "Meubles hérétiques",
  keeper_furniture: "Meubles gardiens",
  morgana_furniture: "Meubles de Morgana",
  bed: "Lits",
  chest: "Coffres",
  table: "Tables",
  flag: "Drapeaux",
  bridgewatch: "Décorations de Bridgewatch",
  caerleon: "Décorations de Caerleon",
  fortsterling: "Décorations de Fort Sterling",
  lymhurst: "Décorations de Lymhurst",
  martlock: "Décorations de Martlock",
  thetford: "Décorations de Thetford",
  // Misc
  any: "Divers",
  event: "Objets d'événement",
  kill_emotes: "Émotes de victoire",
  other: "Autre",
  trash: "Déchets",
  unique: "Objets uniques",
  vanity: "Apparences",
  arenasigils: "Sceaux d'arène",
  royalsigils: "Bons royaux",
};

export function subCategoryLabel(item: CatalogItem): string {
  const raw = item.shopSubCategory1 ?? item.shopCategory;
  if (SUB_CATEGORY_LABELS[raw]) return SUB_CATEGORY_LABELS[raw];
  return raw
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

// Gear names follow "{line name} {du/de l'} {tier rank}" in French, e.g.
// "Épée large de l'adepte" (T4) / "Épée large du sage" (T8) — the line name
// ("Épée large") is what actually distinguishes item types; the tier rank
// duplicates the Tiers filter. Stripping it lets the category tree's last
// level show one row per type instead of one per (type, tier) combination.
// Items that don't follow the convention (mounts, resources, furniture, etc.)
// are returned unchanged and stay their own line. Rank words verified against
// the game's own French item names in item-catalog.json (e.g. T2/T3/.../T8
// of "Sac"/"Casque de soldat"/"Épée large" all follow this exact suffix set).
const TIER_RANK_SUFFIX =
  / (?:du (?:débutant|compagnon|maître|grand maître|sage)|de l'(?:apprenti|adepte|expert))$/;

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
