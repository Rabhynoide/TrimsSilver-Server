import { DEFAULT_SALES_TAX, DEFAULT_SETUP_FEE } from "@/data/market-constants";
import {
  CRAFT_FINDER_CACHED_ENCHANT,
  CRAFT_FINDER_NODE_CATEGORIES,
  DEFAULT_MIN_SALE_RATE_PER_DAY,
  type CraftFinderNodeCategory,
} from "@/data/craft-finder-constants";

// Craft Finder is deliberately Europe-only (per the feature's own scope —
// unlike Farming/Crafting/Journals, which let the user pick any AODP
// region), so there's no region selector in the config at all, matching how
// this page never asks AODP for anything outside "Europe".
export const CRAFT_FINDER_REGION = "Europe" as const;

// No "average"-only restriction here beyond what /crafting already has — no
// EMV mode (equipment varies quality 1-5, EMV is stored quality-1 only
// today, the same documented gap as /crafting, server issue #11).
export type PriceMode = "current" | "average" | "manual";

export type CraftFinderConfig = {
  // The single city where crafting/refining is simulated — taxes/fees and
  // the "craft" side of every make-or-buy comparison all use this one city.
  // Buying always compares all 8 cities regardless of this setting (see
  // calc.ts's evaluateResourceNode, which is handed already-cheapest prices).
  simulationCity: string;
  premium: boolean;
  priceMode: PriceMode;
  averageDays: number;
  // Which enchant level to rank. 0 is served from the price cache; 1-4 are
  // live-proxied on demand (see craft-finder-constants.ts).
  enchant: number;
  // Ranking never aggregates qualities — this just controls which quality
  // rows are computed/shown at once, not how they're combined.
  qualities: number[];
  minSaleRatePerDay: number;
  returnRates: Record<CraftFinderNodeCategory, number>;
  stationFeeRates: Record<CraftFinderNodeCategory, number>;
  useFocus: Record<CraftFinderNodeCategory, boolean>;
  // Filters for the ranking table.
  tierMin: number;
  tierMax: number;
  onlyLiquid: boolean;
  // Minimum net margin (silver) a row must clear to be shown. null = no
  // filter — a numeric 0 would itself be a meaningful filter (hide
  // unprofitable items), so "no filter" needs its own distinct value rather
  // than defaulting to 0.
  minMarginNet: number | null;
  manualPrices: Record<string, number>;
  // The item currently open in the make-or-buy tree drill-down, if any.
  selectedUniqueName: string | null;
  selectedEnchant: number;
  selectedQuality: number;
};

function zeroPerCategory(): Record<CraftFinderNodeCategory, number> {
  const out = {} as Record<CraftFinderNodeCategory, number>;
  for (const category of CRAFT_FINDER_NODE_CATEGORIES) out[category] = 0;
  return out;
}

function truePerCategory(): Record<CraftFinderNodeCategory, boolean> {
  const out = {} as Record<CraftFinderNodeCategory, boolean>;
  for (const category of CRAFT_FINDER_NODE_CATEGORIES) out[category] = true;
  return out;
}

export function defaultCraftFinderConfig(): CraftFinderConfig {
  return {
    simulationCity: "Caerleon",
    premium: true,
    priceMode: "current",
    averageDays: 7,
    enchant: CRAFT_FINDER_CACHED_ENCHANT,
    qualities: [1, 2, 3, 4, 5],
    minSaleRatePerDay: DEFAULT_MIN_SALE_RATE_PER_DAY,
    returnRates: zeroPerCategory(),
    stationFeeRates: zeroPerCategory(),
    useFocus: truePerCategory(),
    tierMin: 1,
    tierMax: 8,
    onlyLiquid: false,
    minMarginNet: null,
    manualPrices: {},
    selectedUniqueName: null,
    selectedEnchant: 0,
    selectedQuality: 1,
  };
}

export function salesTaxRateFor(premium: boolean): number {
  return premium ? DEFAULT_SALES_TAX.premium : DEFAULT_SALES_TAX.standard;
}

export function setupFeeRateFor(premium: boolean): number {
  return premium ? DEFAULT_SETUP_FEE.premium : DEFAULT_SETUP_FEE.standard;
}
