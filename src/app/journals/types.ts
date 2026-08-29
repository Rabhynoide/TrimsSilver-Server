import type { AodpRegion } from "@/lib/aodp";
import { DEFAULT_SALES_TAX, DEFAULT_SETUP_FEE } from "@/data/market-constants";

export const REGION_SERVER_ID: Record<AodpRegion, number> = {
  Americas: 1,
  Asia: 2,
  Europe: 3,
};

// Buy Full, Sell Mats: buy a full journal on the market, deliver it, sell the
// returned empty journal + reward materials.
// Buy Empty, Sell Mats: buy an empty journal, fill it yourself, deliver it,
// sell the returned empty journal + reward materials.
// Buy Empty, Sell Full: buy an empty journal, fill it yourself, resell it as
// a full journal on the market — no delivery, no reward loot table at all.
export type Scenario = "buyFullSellMats" | "buyEmptySellMats" | "buyEmptySellFull";

// "Sell Order"/"Buy Order" name which side of the order book you're on, not
// which direction you're trading — mirrors AFM's own Buy/Sell Price Type
// dropdowns. Taking the instant opposite-side order costs no setup fee;
// placing your own resting order at your own side does. See calc.ts's
// setup-fee rule for the exact mapping. "Average"/"Manual"/"EMV" are treated
// as already-realized prices — sales tax still applies (you still owe
// Albion's cut on any sale), but no setup fee (no real order is being
// modeled). "EMV" (signed-in only) reads the desktop client's own synced
// ItemEstimatedMarketValue data via /api/journals/emv — journals and their
// reward materials/fill resources are all quality 1, so unlike Crafting's
// EMV gap (quality 1-5 equipment) this is a clean fit — see server issue #16.
export type PriceType = "sellOrder" | "buyOrder" | "average" | "emv" | "manual";

export type JournalsConfig = {
  region: AodpRegion;
  scenario: Scenario;
  amount: number;
  // Laborer yield %, per wiki.albiononline.com/wiki/Laborer's
  // Yield = min(150, happiness/2) — these are the two yield numbers directly
  // (0-150), not the raw "happiness" stat. Split in two because a max-tier
  // laborer's own house/trophy setup commonly gives T8 a different realistic
  // ceiling than T2-T7, matching AFM's own two-field layout.
  happiness: number;
  happinessT8: number;
  buyFrom: string;
  sellTo: string;
  buyPriceType: PriceType;
  sellPriceType: PriceType;
  premium: boolean;
  averageDays: number;
  // Which fillOptions[] entry (by uniqueName) to gather for each "gathering"
  // kind journal, keyed by the journal's own uniqueName. Defaults to
  // fillOptions[0] (same tier, enchant 0) when unset.
  fillChoice: Record<string, string>;
  // Manual fill cost (silver per journal) for "manual-fill" kind journals —
  // see journal-constants.ts for why these can't be auto-computed from a
  // market price. Keyed by journal uniqueName.
  manualFillCost: Record<string, number>;
  // Manual price override, used when buyPriceType/sellPriceType is "manual".
  // Keyed by the AODP market id (journalMarketId() for journals, plain
  // uniqueName for reward materials).
  manualPrices: Record<string, number>;
};

export function defaultJournalsConfig(): JournalsConfig {
  return {
    region: "Europe",
    scenario: "buyFullSellMats",
    amount: 1,
    happiness: 150,
    happinessT8: 142.5,
    buyFrom: "Caerleon",
    sellTo: "Caerleon",
    buyPriceType: "sellOrder",
    sellPriceType: "sellOrder",
    premium: true,
    averageDays: 15,
    fillChoice: {},
    manualFillCost: {},
    manualPrices: {},
  };
}

export function salesTaxRateFor(premium: boolean): number {
  return premium ? DEFAULT_SALES_TAX.premium : DEFAULT_SALES_TAX.standard;
}

export function setupFeeRateFor(premium: boolean): number {
  return premium ? DEFAULT_SETUP_FEE.premium : DEFAULT_SETUP_FEE.standard;
}

export function yieldPctFor(tier: number, config: JournalsConfig): number {
  return tier >= 8 ? config.happinessT8 : config.happiness;
}
