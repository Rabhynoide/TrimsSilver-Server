import { DEFAULT_SALES_TAX, DEFAULT_SETUP_FEE } from "@/data/market-constants";
import { CITIES } from "../market-prices/types";
import {
  CRAFT_FINDER_CACHED_ENCHANT,
  CRAFT_FINDER_NODE_CATEGORIES,
  DEFAULT_MIN_SALE_RATE_PER_DAY,
  defaultReturnRateForCity,
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

// One Return Rate + station-fee-rate slot per (city, node category) pair —
// unlike the Focus toggle below, these genuinely vary by city (a city's
// crafting-station specialization bonus, and its stations' own posted
// Nutrition Cost rate, are both per-city live values). stationFeeSilverPer100Nutrition
// is silver per 100 Nutrition, read directly off the station's UI in-game —
// see craft-finder-constants.ts's NUTRITION_COST_PER_ITEM_VALUE for how
// that combines with an item's own Item Value into an actual silver fee.
export type CityCategoryRates = {
  returnRate: number;
  stationFeeSilverPer100Nutrition: number;
};

export type CraftFinderConfig = {
  // The single city where crafting/refining is simulated — this is also
  // which row of cityCategoryConfig below is read for every node in the
  // tree. Buying always compares all 8 cities regardless of this setting
  // (see calc.ts's evaluateResourceNode, which is handed already-cheapest
  // prices).
  simulationCity: string;
  premium: boolean;
  priceMode: PriceMode;
  averageDays: number;
  // Which enchant levels to rank, simultaneously — each produces its own
  // separate rows, never aggregated together (same "never aggregate"
  // principle as quality below). 0 is served from the price cache; 1-4 are
  // live-proxied on demand (see craft-finder-constants.ts).
  enchants: number[];
  minSaleRatePerDay: number;
  cityCategoryConfig: Record<string, Record<CraftFinderNodeCategory, CityCategoryRates>>;
  // Optional per-item-type Return Rate overrides, keyed by
  // [city][craftingCategory] (e.g. "sword", "plate_helmet" — see
  // craft-finder-constants.ts's CRAFT_FINDER_ITEM_TYPES_BY_WORKSHOP), one
  // level finer than cityCategoryConfig's per-workshop rate. A missing key
  // means "not overridden" — falls back to cityCategoryConfig's workshop
  // rate plus the automatic city-specialty bump (see calc.ts's
  // effectiveReturnRateFor). This is the only way to capture what a
  // player's own spec level, an active daily production bonus, or Focus
  // usage actually do to a *specific* weapon/armor type's Return Rate —
  // none of those are derived automatically (see craft-finder-constants.ts).
  itemTypeReturnRates: Record<string, Record<string, number>>;
  useFocus: Record<CraftFinderNodeCategory, boolean>;
  // Filters for the ranking table.
  tierMin: number;
  tierMax: number;
  onlyLiquid: boolean;
  // Minimum margin %, as a fraction (0.1 = 10%), a row must clear to be
  // shown. null = no filter — a numeric 0 would itself be a meaningful
  // filter (hide unprofitable items), so "no filter" needs its own distinct
  // value rather than defaulting to 0.
  minMarginPct: number | null;
  manualPrices: Record<string, number>;
  // The item currently open in the make-or-buy tree drill-down, if any.
  // Quality is always 1 (see `enchants` above — this feature only ranks
  // quality 1, matching the user's own stated scope), so there's no
  // separate selectedQuality field to track.
  selectedUniqueName: string | null;
  selectedEnchant: number;
};

// Station fee has no derivable default (a live player-set value, see
// CityCategoryRates' own comment) so it stays 0 until the user fills it in;
// Return Rate does have one — Albion's own "Local Production Bonus" formula
// — so new configs start from that instead of a blank 0, see
// defaultReturnRateForCity's comment for sourcing and its known limits.
function defaultRatesPerCategory(city: string): Record<CraftFinderNodeCategory, CityCategoryRates> {
  const out = {} as Record<CraftFinderNodeCategory, CityCategoryRates>;
  for (const category of CRAFT_FINDER_NODE_CATEGORIES) {
    out[category] = { returnRate: defaultReturnRateForCity(city, category), stationFeeSilverPer100Nutrition: 0 };
  }
  return out;
}

function defaultCityCategoryConfig(): Record<string, Record<CraftFinderNodeCategory, CityCategoryRates>> {
  const out: Record<string, Record<CraftFinderNodeCategory, CityCategoryRates>> = {};
  for (const city of CITIES) out[city] = defaultRatesPerCategory(city);
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
    enchants: [CRAFT_FINDER_CACHED_ENCHANT],
    minSaleRatePerDay: DEFAULT_MIN_SALE_RATE_PER_DAY,
    cityCategoryConfig: defaultCityCategoryConfig(),
    itemTypeReturnRates: {},
    useFocus: truePerCategory(),
    tierMin: 1,
    tierMax: 8,
    onlyLiquid: false,
    minMarginPct: null,
    manualPrices: {},
    selectedUniqueName: null,
    selectedEnchant: 0,
  };
}

export function salesTaxRateFor(premium: boolean): number {
  return premium ? DEFAULT_SALES_TAX.premium : DEFAULT_SALES_TAX.standard;
}

export function setupFeeRateFor(premium: boolean): number {
  return premium ? DEFAULT_SETUP_FEE.premium : DEFAULT_SETUP_FEE.standard;
}
