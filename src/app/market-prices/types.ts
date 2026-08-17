// Equipment addresses enchanted variants as "UNIQUENAME@N" (a nested variant of
// the same base item); resources address them as "UNIQUENAME_LEVELN" (each
// level is its own standalone item in the game data). See
// scripts/build-item-catalog.mjs for how this is determined per item.
export type EnchantSuffix = "@" | "_LEVEL";

export type CatalogItem = {
  uniqueName: string;
  name: string;
  tier: number;
  maxEnchant: number;
  enchantSuffix: EnchantSuffix;
  shopCategory: string;
  shopSubCategory1: string | null;
};

export type SelectedItem = {
  uniqueName: string;
  name: string;
  tier: number;
  enchant: number;
  enchantSuffix: EnchantSuffix;
};

export type PriceRow = {
  itemId: string;
  city: string;
  quality: number;
  sellPriceMin: number;
  sellPriceMinDate: string;
  sellPriceMax: number;
  sellPriceMaxDate: string;
  buyPriceMin: number;
  buyPriceMinDate: string;
  buyPriceMax: number;
  buyPriceMaxDate: string;
  avgPrice: number | null;
  avgAmount: number | null;
};

export type AodpRegion = "Americas" | "Asia" | "Europe";
export type PriceType = "sell" | "buy";

export type PriceCheckerConfig = {
  region: AodpRegion;
  priceType: PriceType;
  averageDays: number;
  showAverages: boolean;
  cities: string[];
};

export type Favorite = {
  id: string;
  name: string;
  note: string | null;
  config: {
    checker: PriceCheckerConfig;
    items: SelectedItem[];
  };
  createdAt: string;
};

export const CITIES = [
  "Black Market",
  "Bridgewatch",
  "Caerleon",
  "Fort Sterling",
  "Lymhurst",
  "Martlock",
  "Thetford",
  "Brecilien",
] as const;

export const QUALITY_LEVELS = [1, 2, 3, 4, 5] as const;

export const QUALITY_LABELS: Record<number, string> = {
  1: "Normal",
  2: "Good",
  3: "Outstanding",
  4: "Excellent",
  5: "Masterpiece",
};

export function itemId(item: SelectedItem): string {
  return item.enchant > 0 ? `${item.uniqueName}${item.enchantSuffix}${item.enchant}` : item.uniqueName;
}

export function selectedItemKey(item: SelectedItem): string {
  return itemId(item);
}

export function defaultConfig(): PriceCheckerConfig {
  return {
    region: "Europe",
    priceType: "sell",
    averageDays: 15,
    showAverages: true,
    cities: [...CITIES],
  };
}
