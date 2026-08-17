import type { CatalogItem } from "./types";

// Human-friendly grouping on top of the raw shopcategory/shopsubcategory1 game
// data fields, used to drive the Shop Categories tree (CategoryTree.tsx).
// Order here is display order.
const TOP_CATEGORY_ORDER = [
  "Weapons",
  "Chest Armor",
  "Head Armor",
  "Foot Armor",
  "Off-Hands",
  "Capes",
  "Bags",
  "Mounts",
  "Consumables",
  "Vanity",
  "Gathering Equipment",
  "Artifacts",
  "Farming",
  "Furniture",
  "Materials & Resources",
  "Skillbooks",
  "Trophies",
  "Labourer Contracts",
  "Other",
] as const;

export function topCategoryOf(item: CatalogItem): string {
  switch (item.shopCategory) {
    case "melee":
    case "magic":
    case "ranged":
      return "Weapons";
    case "armor":
      if (item.shopSubCategory1?.endsWith("_armor")) return "Chest Armor";
      if (item.shopSubCategory1?.endsWith("_helmet")) return "Head Armor";
      if (item.shopSubCategory1?.endsWith("_shoes")) return "Foot Armor";
      return "Other";
    case "offhand":
      return "Off-Hands";
    case "accessories":
      if (item.shopSubCategory1 === "cape") return "Capes";
      if (item.shopSubCategory1 === "bag") return "Bags";
      return "Other";
    case "mounts":
      return "Mounts";
    case "consumables":
      return item.shopSubCategory1 === "vanity" ? "Vanity" : "Consumables";
    case "gatherergear":
    case "tools":
      return "Gathering Equipment";
    case "artefacts":
      return "Artifacts";
    case "farmables":
      return "Farming";
    case "furniture":
      return "Furniture";
    case "resources":
    case "materials":
    case "products":
      return "Materials & Resources";
    case "skillbooks":
      return "Skillbooks";
    case "trophies":
      return "Trophies";
    case "labourers":
      return "Labourer Contracts";
    default:
      return "Other";
  }
}

export function subCategoryLabel(item: CatalogItem): string {
  const raw = item.shopSubCategory1 ?? item.shopCategory;
  return raw
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

// Gear names follow "{tier rank}'s {line name}", e.g. "Adept's Broadsword" (T4) /
// "Elder's Broadsword" (T8) — the line name ("Broadsword") is what actually
// distinguishes item types; the tier rank duplicates the Tiers filter. Stripping
// it lets the category tree's last level show one row per type instead of one
// per (type, tier) combination. Items that don't follow the convention (mounts,
// resources, furniture, etc.) are returned unchanged and stay their own line.
const TIER_RANK_PREFIX =
  /^(Beginner's|Novice's|Journeyman's|Adept's|Expert's|Master's|Grandmaster's|Elder's)\s+/;

export function lineNameOf(item: CatalogItem): string {
  return item.name.replace(TIER_RANK_PREFIX, "");
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
