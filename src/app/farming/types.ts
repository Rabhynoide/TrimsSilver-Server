import type { AodpRegion } from "@/lib/aodp";
import { DEFAULT_SALES_TAX, DEFAULT_SETUP_FEE, FARMING_LOCATIONS, type FarmingLocation } from "@/data/farming-constants";

export type { FarmingLocation };

export const REGION_SERVER_ID: Record<AodpRegion, number> = {
  Americas: 1,
  Asia: 2,
  Europe: 3,
};

export type PriceMode = "current" | "average" | "emv" | "manual";

export type FarmingConfig = {
  region: AodpRegion;
  location: FarmingLocation;
  premium: boolean;
  // Whether to spend Focus watering/nurturing (uses the Specs levels below for
  // extra yield, at a Focus cost); when off, only the tier base yield and the
  // location bonus apply, at zero Focus cost.
  useFocus: boolean;
  // Total production slots available (a Farm/Herb Garden/Pasture/Kennel plot
  // holds 9 each) — used only to scale Profit/Day into a "Total Profit/Day"
  // figure in Results, assuming every slot runs the same item. Doesn't affect
  // the per-slot numbers at all.
  slots: number;
  buyFrom: string;
  sellTo: string;
  priceMode: PriceMode;
  averageDays: number;
  characterName: string | null;
  specs: Record<string, number>;
  manualPrices: Record<string, number>;
};

export function defaultFarmingConfig(): FarmingConfig {
  return {
    region: "Europe",
    location: "Lymhurst",
    premium: true,
    useFocus: true,
    slots: 9,
    buyFrom: "Caerleon",
    sellTo: "Caerleon",
    priceMode: "current",
    averageDays: 15,
    characterName: null,
    specs: {},
    manualPrices: {},
  };
}

// Sales tax is deducted from sale proceeds; setup fee is paid upfront to list
// a sell order (non-refundable). Both derived from Premium status, matching
// AFM's own read-only "Sales tax %.%% / Setup fee %.%%" display rather than
// separate editable inputs. Premium values confirmed against the user's own
// screenshot.
export function salesTaxRateFor(premium: boolean): number {
  return premium ? DEFAULT_SALES_TAX.premium : DEFAULT_SALES_TAX.standard;
}

export function setupFeeRateFor(premium: boolean): number {
  return premium ? DEFAULT_SETUP_FEE.premium : DEFAULT_SETUP_FEE.standard;
}

export { FARMING_LOCATIONS };

export type SpecCharacter = {
  characterName: string;
  serverId: number;
  updatedAt: string;
  specs: Record<string, number>;
};
