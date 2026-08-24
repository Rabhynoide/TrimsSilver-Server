import type { AodpRegion } from "@/lib/aodp";
import { DEFAULT_RETURN_RATE } from "@/data/crafting-constants";
import { DEFAULT_SALES_TAX, DEFAULT_SETUP_FEE } from "@/data/market-constants";

export const REGION_SERVER_ID: Record<AodpRegion, number> = {
  Americas: 1,
  Asia: 2,
  Europe: 3,
};

// No "emv" mode here (unlike Farming) — EMV is stored per quality-1 only
// today (see /api/farming/emv), which is correct for farmables but wrong for
// equipment that varies 1-5. Wiring that correctly is a deferred follow-up,
// not a V1 blocker (see the Crafting Calculator plan).
export type PriceMode = "current" | "average" | "manual";

export type CraftingConfig = {
  region: AodpRegion;
  // The item + enchant currently being evaluated. Persisted so "Save
  // Settings" restores your last calculation, not just your preferences.
  selectedUniqueName: string | null;
  selectedEnchant: number;
  // Which market quality (1-5) to price the crafted output at — a choice of
  // which price to read, not a modeled quality-roll probability (the roll
  // odds aren't cleanly documented). Resources you buy are always quality 1.
  outputQuality: number;
  batchSize: number;
  buyFrom: string;
  sellTo: string;
  premium: boolean;
  // Whether to show Focus cost / Profit-per-Focus at all. The raw per-craft
  // Focus cost comes straight from game data (recipe.focusCost) and is shown
  // as-is — Focus Cost Efficiency from specialization mastery is a multi-node
  // formula the wiki documents as a scrollable table, not a clean 0-100
  // curve like Farming's; modeling it precisely was judged too risky to get
  // right, so it's deliberately NOT applied as a reduction here (see plan).
  useFocus: boolean;
  // Resource Return Rate, 0-1, manual entry — see crafting-constants.ts for
  // why this isn't auto-calculated.
  returnRate: number;
  // Purely a record-keeping checkbox: reminds you whether the Return Rate you
  // typed above already accounts for a city's station bonus. Has no separate
  // effect on the calculation — see the plan's "deliberately scoped out"
  // section for why no city->bonus-category table is hardcoded.
  returnRateIncludesStationBonus: boolean;
  // % of total resource cost taken as a station usage fee (0 if you own the
  // station or have a free-use arrangement).
  stationFeeRate: number;
  priceMode: PriceMode;
  averageDays: number;
  characterName: string | null;
  // Raw combat specialization levels (0-100) per COMBAT_* achievement id —
  // display-only context (see useFocus above for why it isn't applied as a
  // cost reduction), auto-fillable from a synced character via
  // /api/crafting/specs.
  specs: Record<string, number>;
  manualPrices: Record<string, number>;
};

export function defaultCraftingConfig(): CraftingConfig {
  return {
    region: "Europe",
    selectedUniqueName: null,
    selectedEnchant: 0,
    outputQuality: 1,
    batchSize: 1,
    buyFrom: "Caerleon",
    sellTo: "Caerleon",
    premium: true,
    useFocus: true,
    returnRate: DEFAULT_RETURN_RATE,
    returnRateIncludesStationBonus: false,
    stationFeeRate: 0,
    priceMode: "current",
    averageDays: 15,
    characterName: null,
    specs: {},
    manualPrices: {},
  };
}

export function salesTaxRateFor(premium: boolean): number {
  return premium ? DEFAULT_SALES_TAX.premium : DEFAULT_SALES_TAX.standard;
}

export function setupFeeRateFor(premium: boolean): number {
  return premium ? DEFAULT_SETUP_FEE.premium : DEFAULT_SETUP_FEE.standard;
}

export type SpecCharacter = {
  characterName: string;
  serverId: number;
  updatedAt: string;
  specs: Record<string, number>;
};
