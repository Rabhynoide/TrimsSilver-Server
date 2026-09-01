export type CraftResource = { uniqueName: string; count: number };

export type CraftRecipe = {
  enchant: number;
  silver: number;
  focusCost: number;
  resources: CraftResource[];
};

export type CraftItem = {
  uniqueName: string;
  specAchievementId: string | null;
  // The real Albion crafting building this item is made at (Warrior's
  // Forge, Hunter's Lodge, Mage's Tower, Toolmaker, or Workbench) —
  // added for Craft Finder's per-city, per-workshop Return
  // Rate/station-fee config; unused by this page's own calc.
  workshop: string;
  recipes: CraftRecipe[];
};

export function recipeForEnchant(item: CraftItem, enchant: number): CraftRecipe | null {
  return item.recipes.find((r) => r.enchant === enchant) ?? null;
}

// AODP addressing for a craft-relevant item at a given craft's enchant level.
// Works uniformly for both the crafted output (base uniqueName, e.g.
// "T4_MAIN_SWORD") and a recipe resource at enchant>0 (already carries its
// own "_LEVELN" infix from the raw game data, e.g. "T4_METALBAR_LEVEL1") —
// both just need "@N" appended once N>0, confirmed against the real AODP
// convention (see build-item-catalog.mjs's itemId()/market-prices/types.ts).
export function craftItemId(uniqueName: string, enchant: number): string {
  return enchant === 0 ? uniqueName : `${uniqueName}@${enchant}`;
}

export type PriceLookup = (uniqueName: string) => number | null;

export type EvalContext = {
  returnRate: number;
  stationFeeRate: number;
  batchSize: number;
  useFocus: boolean;
  buyPriceOf: PriceLookup;
  // Price for the crafted output at the selected enchant/quality — already
  // net of sales tax + setup fee, same convention as Farming's sellPriceOf.
  outputSellPriceOf: () => number | null;
};

export type ResourceLine = {
  uniqueName: string;
  count: number;
  netUnits: number;
  unitPrice: number | null;
  lineCost: number;
};

export type EvalResult = {
  resourceLines: ResourceLine[];
  resourceCostPerCraft: number;
  stationFeePerCraft: number;
  silverFeePerCraft: number;
  costPerCraft: number;
  revenuePerCraft: number;
  profitPerCraft: number;
  roi: number | null;
  costTotal: number;
  revenueTotal: number;
  profitTotal: number;
  focusCostPerCraft: number;
  profitPerFocus: number | null;
  missingPrices: string[];
};

// Return Rate discounts the resources actually consumed per craft — this is
// the core mechanic the calculator exists to surface: crafting N of a
// resource returns a fraction of it, so net consumption is N*(1-returnRate).
function netUnits(count: number, returnRate: number): number {
  return count * (1 - Math.max(0, Math.min(1, returnRate)));
}

export function evaluateCraft(recipe: CraftRecipe, ctx: EvalContext): EvalResult {
  const missingPrices: string[] = [];

  const resourceLines: ResourceLine[] = recipe.resources.map((r) => {
    const price = ctx.buyPriceOf(r.uniqueName);
    if (price == null) missingPrices.push(r.uniqueName);
    const units = netUnits(r.count, ctx.returnRate);
    return {
      uniqueName: r.uniqueName,
      count: r.count,
      netUnits: units,
      unitPrice: price,
      lineCost: price != null ? price * units : 0,
    };
  });

  const resourceCostPerCraft = resourceLines.reduce((sum, l) => sum + l.lineCost, 0);
  const stationFeePerCraft = resourceCostPerCraft * Math.max(0, ctx.stationFeeRate);
  const silverFeePerCraft = recipe.silver;
  const costPerCraft = resourceCostPerCraft + stationFeePerCraft + silverFeePerCraft;

  const outputPrice = ctx.outputSellPriceOf();
  if (outputPrice == null) missingPrices.push("output");
  const revenuePerCraft = outputPrice ?? 0;

  const profitPerCraft = revenuePerCraft - costPerCraft;
  const roi = costPerCraft > 0 ? profitPerCraft / costPerCraft : null;

  const focusCostPerCraft = ctx.useFocus ? recipe.focusCost : 0;

  return {
    resourceLines,
    resourceCostPerCraft,
    stationFeePerCraft,
    silverFeePerCraft,
    costPerCraft,
    revenuePerCraft,
    profitPerCraft,
    roi,
    costTotal: costPerCraft * ctx.batchSize,
    revenueTotal: revenuePerCraft * ctx.batchSize,
    profitTotal: profitPerCraft * ctx.batchSize,
    focusCostPerCraft,
    profitPerFocus: focusCostPerCraft > 0 ? profitPerCraft / focusCostPerCraft : null,
    missingPrices,
  };
}
