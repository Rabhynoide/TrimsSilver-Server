import type { AodpRegion } from "@/lib/aodp";
import { DEFAULT_SALES_TAX } from "@/data/market-constants";
import type { SelectedItem } from "../market-prices/types";

export const REGION_SERVER_ID: Record<AodpRegion, number> = {
  Americas: 1,
  Asia: 2,
  Europe: 3,
};

export type FlipperConfig = {
  region: AodpRegion;
  premium: boolean;
  sellOrderMaxAgeMinutes: number;
  buyOrderMaxAgeMinutes: number;
  showBlackMarketFlips: boolean;
  showCityToCityFlips: boolean;
  minTotalProfit: number;
  // Private flips (own scanned orders) and public flips (AODP's current-price
  // snapshot, no sign-in or scanning required) are independent, toggleable
  // sources — see calc.ts's findFlips() vs findPublicFlips() for why they're
  // shaped too differently to merge into one list.
  showPrivateFlips: boolean;
  showPublicFlips: boolean;
  publicPriceMaxAgeHours: number;
  selectedItems: SelectedItem[];
};

export function defaultFlipperConfig(): FlipperConfig {
  return {
    region: "Europe",
    premium: true,
    sellOrderMaxAgeMinutes: 180,
    buyOrderMaxAgeMinutes: 45,
    showBlackMarketFlips: true,
    showCityToCityFlips: true,
    minTotalProfit: 0,
    showPrivateFlips: true,
    showPublicFlips: true,
    publicPriceMaxAgeHours: 24,
    selectedItems: [],
  };
}

// A flip fulfills two orders that already exist (an instant buy off a sell
// order, an instant sell into a buy order) rather than placing a new one of
// your own, so unlike Crafting/Farming's sell price there's no Setup Fee
// here — that's only charged to whoever originally placed the order. Sales
// Tax still applies to the silver you receive, same as any other sale.
export function salesTaxRateFor(premium: boolean): number {
  return premium ? DEFAULT_SALES_TAX.premium : DEFAULT_SALES_TAX.standard;
}
