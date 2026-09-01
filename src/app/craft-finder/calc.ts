// Pure, source-agnostic calculation engine for Craft Finder — same shape as
// the other calculators' evaluateX() functions (farming/calc.ts,
// crafting/calc.ts). Two new pieces neither of those needed:
//
// 1. A recursive make-or-buy evaluator that walks resource-catalog.json's
//    refining/transmutation chain down to a raw, unrefined resource,
//    memoized per resource uniqueName (a resource's own uniqueName already
//    fully encodes its enchant level — "T4_METALBAR_LEVEL1" — unlike
//    equipment, where the same base uniqueName is shared across enchants 0-4
//    via separate recipe entries; so only equipment needs an explicit
//    (uniqueName, enchant) pair, resources don't).
// 2. A liquidity/sale-rate signal per item (quality 1 only — Craft Finder's
//    own scope, per the user).
//
// Reuses crafting/calc.ts's CraftItem/CraftRecipe types and craftItemId()
// for the equipment layer (crafting-catalog.json) as-is, and
// journal-constants.ts's resourceMarketId() for addressing resource-catalog
// rows against AODP — both already solve exactly this problem, no need to
// re-derive either convention here.

import { craftItemId, type CraftItem, type CraftRecipe } from "../crafting/calc";
import { resourceMarketId } from "@/data/journal-constants";
import {
  minSaleRateForTier,
  type CraftFinderNodeCategory,
} from "@/data/craft-finder-constants";

export type ResourceRecipeOption = {
  silver: number;
  focusCost: number;
  resources: { uniqueName: string; count: number }[];
};

export type ResourceRecipe = {
  uniqueName: string;
  category: string;
  tier: number;
  enchant: number;
  options: ResourceRecipeOption[];
};

export type MarketSnapshot = {
  price: number | null;
  priceAge: string | null;
  avgAmount: number | null;
};

export type EvalContext = {
  resourceByUniqueName: Map<string, ResourceRecipe>;
  // Best (cheapest) current sell-order price for a market-addressed id
  // across whatever set of cities the caller already narrowed down to (see
  // bestBuyOption below) — already net of nothing, taxes/fees only apply at
  // the final sale of the crafted item, never on a purchase (Albion doesn't
  // tax buyers, same convention as every other calculator here).
  marketOf: (marketId: string) => MarketSnapshot;
  returnRateFor: (category: CraftFinderNodeCategory) => number;
  stationFeeRateFor: (category: CraftFinderNodeCategory) => number;
  useFocusFor: (category: CraftFinderNodeCategory) => boolean;
  minSaleRatePerDay: number;
  maxDepth: number;
};

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function netUnits(count: number, returnRate: number): number {
  return count * (1 - clamp01(returnRate));
}

export type ResourceChildLine = {
  uniqueName: string;
  count: number;
  netUnits: number;
  unitCost: number | null;
  lineCost: number | null;
  node: ResourceTreeNode;
};

export type ResourceCraftOption = {
  optionIndex: number;
  silver: number;
  focusCost: number;
  category: CraftFinderNodeCategory;
  stationFeeRate: number;
  stationFeeAmount: number;
  resourceCost: number;
  totalCost: number;
  children: ResourceChildLine[];
};

export type ResourceTreeNode = {
  uniqueName: string;
  category: string;
  tier: number;
  enchant: number;
  marketId: string;
  buyPrice: number | null;
  buyPriceAge: string | null;
  saleRate: number | null;
  liquidityOk: boolean | null; // null = no sale-rate data at all
  craftOptions: ResourceCraftOption[];
  bestCraftOption: ResourceCraftOption | null;
  chosen: "buy" | "craft" | "unavailable";
  chosenCost: number | null;
};

// Recursively evaluates the cheapest way to obtain one unit of `uniqueName`
// — buy it outright, or the cheapest of its recipe's alternative options
// (resource-catalog.json rows can carry more than one legitimate non-faction
// recipe, e.g. a tier-up transmutation vs a same-tier enchant transmutation
// — see build-resource-catalog.mjs). Memoized per uniqueName since the same
// resource (e.g. a T4 metal bar) is very often needed by several sibling
// branches of one item's tree, or across different items entirely within one
// ranking pass.
export function evaluateResourceNode(
  uniqueName: string,
  ctx: EvalContext,
  memo: Map<string, ResourceTreeNode>,
  depth: number,
): ResourceTreeNode {
  const cached = memo.get(uniqueName);
  if (cached) return cached;

  const entry = ctx.resourceByUniqueName.get(uniqueName);
  const marketId = resourceMarketId(uniqueName);
  const market = ctx.marketOf(marketId);
  const liquidityOk =
    market.avgAmount == null
      ? null
      : market.avgAmount >= minSaleRateForTier(entry?.tier ?? 1, ctx.minSaleRatePerDay);

  // A depth-guard placeholder, inserted before recursing into children, so a
  // corrupted/circular catalog can't recurse forever — real game data never
  // actually cycles (each recipe strictly consumes a lower tier and/or lower
  // enchant item), so this is defensive, not load-bearing in practice.
  const placeholder: ResourceTreeNode = {
    uniqueName,
    category: entry?.category ?? "unknown",
    tier: entry?.tier ?? 0,
    enchant: entry?.enchant ?? 0,
    marketId,
    buyPrice: market.price,
    buyPriceAge: market.priceAge,
    saleRate: market.avgAmount,
    liquidityOk,
    craftOptions: [],
    bestCraftOption: null,
    chosen: market.price != null ? "buy" : "unavailable",
    chosenCost: market.price,
  };
  memo.set(uniqueName, placeholder);

  let craftOptions: ResourceCraftOption[] = [];
  if (entry && depth < ctx.maxDepth) {
    const category = entry.category as CraftFinderNodeCategory;
    const returnRate = ctx.returnRateFor(category);
    const stationFeeRate = ctx.stationFeeRateFor(category);

    craftOptions = entry.options.map((option, optionIndex) => {
      const children: ResourceChildLine[] = option.resources.map((r) => {
        const childNode = evaluateResourceNode(r.uniqueName, ctx, memo, depth + 1);
        const units = netUnits(r.count, returnRate);
        return {
          uniqueName: r.uniqueName,
          count: r.count,
          netUnits: units,
          unitCost: childNode.chosenCost,
          lineCost: childNode.chosenCost != null ? childNode.chosenCost * units : null,
          node: childNode,
        };
      });
      const resourceCost = children.reduce((sum, c) => sum + (c.lineCost ?? 0), 0);
      const stationFeeAmount = resourceCost * Math.max(0, stationFeeRate);
      const totalCost = resourceCost + stationFeeAmount + option.silver;
      return {
        optionIndex,
        silver: option.silver,
        focusCost: option.focusCost,
        category,
        stationFeeRate,
        stationFeeAmount,
        resourceCost,
        totalCost,
        children,
      };
    });
  }

  const feasibleCraftOptions = craftOptions.filter((o) => o.children.every((c) => c.lineCost != null));
  const bestCraftOption =
    feasibleCraftOptions.length > 0
      ? feasibleCraftOptions.reduce((a, b) => (b.totalCost < a.totalCost ? b : a))
      : null;

  let chosen: ResourceTreeNode["chosen"] = "unavailable";
  let chosenCost: number | null = null;
  if (market.price != null && bestCraftOption != null) {
    if (bestCraftOption.totalCost < market.price) {
      chosen = "craft";
      chosenCost = bestCraftOption.totalCost;
    } else {
      chosen = "buy";
      chosenCost = market.price;
    }
  } else if (market.price != null) {
    chosen = "buy";
    chosenCost = market.price;
  } else if (bestCraftOption != null) {
    chosen = "craft";
    chosenCost = bestCraftOption.totalCost;
  }

  const node: ResourceTreeNode = {
    ...placeholder,
    craftOptions,
    bestCraftOption,
    chosen,
    chosenCost,
  };
  memo.set(uniqueName, node);
  return node;
}

export type EquipmentTreeResult = {
  uniqueName: string;
  enchant: number;
  focusCostPerCraft: number;
  silverFeePerCraft: number;
  stationFeeRate: number;
  stationFeeAmount: number;
  resourceCost: number;
  craftCost: number;
  children: ResourceChildLine[];
  missingPrices: string[];
};

// The equipment layer never recurses into other equipment (Albion gear
// recipes only ever consume refined resources, confirmed by inspecting
// crafting-catalog.json — no equipment uniqueName ever appears as a recipe
// resource), so this is a single flat pass over the recipe's resources, each
// handed off to the resource-level recursion above. One fresh memo per
// evaluation call — sharing a memo ACROSS different items in a ranking pass
// is intentionally NOT done here (see rankCraftableItems) since Return
// Rate/station fee/Focus config could differ, but in practice this function
// reuses one memo per catalog pass for performance, safe because the config
// closures passed via ctx are the same for every item in one ranking run.
export function evaluateEquipmentCraft(
  item: CraftItem,
  recipe: CraftRecipe,
  ctx: EvalContext,
  memo: Map<string, ResourceTreeNode>,
): EquipmentTreeResult {
  const returnRate = ctx.returnRateFor("equipment");
  const stationFeeRate = ctx.stationFeeRateFor("equipment");

  const children: ResourceChildLine[] = recipe.resources.map((r) => {
    const node = evaluateResourceNode(r.uniqueName, ctx, memo, 1);
    const units = netUnits(r.count, returnRate);
    return {
      uniqueName: r.uniqueName,
      count: r.count,
      netUnits: units,
      unitCost: node.chosenCost,
      lineCost: node.chosenCost != null ? node.chosenCost * units : null,
      node,
    };
  });

  const missingPrices = children.filter((c) => c.lineCost == null).map((c) => c.uniqueName);
  const resourceCost = children.reduce((sum, c) => sum + (c.lineCost ?? 0), 0);
  const stationFeeAmount = resourceCost * Math.max(0, stationFeeRate);
  const craftCost = resourceCost + stationFeeAmount + recipe.silver;

  return {
    uniqueName: item.uniqueName,
    enchant: recipe.enchant,
    focusCostPerCraft: recipe.focusCost,
    silverFeePerCraft: recipe.silver,
    stationFeeRate,
    stationFeeAmount,
    resourceCost,
    craftCost,
    children,
    missingPrices,
  };
}

// Sums the Focus cost actually "spent" across the whole tree — the root
// craft plus every node where the cheapest choice was to craft (a bought
// node has no Focus cost of its own) — gated per-category by useFocusFor,
// exactly like the single global useFocus toggle in /crafting, just applied
// per node's own category instead of uniformly.
export function totalFocusCost(craft: EquipmentTreeResult, ctx: EvalContext): number {
  let total = ctx.useFocusFor("equipment") ? craft.focusCostPerCraft : 0;
  function visit(node: ResourceTreeNode) {
    if (node.chosen !== "craft" || !node.bestCraftOption) return;
    const option = node.bestCraftOption;
    if (ctx.useFocusFor(option.category)) total += option.focusCost;
    for (const child of option.children) visit(child.node);
  }
  for (const child of craft.children) visit(child.node);
  return total;
}

export type FinalItemResult = {
  uniqueName: string;
  enchant: number;
  craft: EquipmentTreeResult;
  focusTotal: number;
  sellPriceGross: number | null;
  sellPriceNet: number | null;
  sellPriceAge: string | null;
  saleRate: number | null;
  liquidityOk: boolean | null;
  marginNet: number | null;
  marginPct: number | null;
  silverPerFocus: number | null;
  missingPrices: string[];
};

export type OutputPriceLookup = (uniqueName: string, enchant: number) => MarketSnapshot;

// Never aggregates across enchant — one call = one (item, enchant) pair.
// Quality is always 1 (Craft Finder's own scope, per the user — equipment
// quality 2-5 is out of scope entirely, not just deprioritized), so it's no
// longer a dimension this function takes or returns.
export function evaluateFinalItem(
  item: CraftItem,
  recipe: CraftRecipe,
  ctx: EvalContext,
  outputPriceOf: OutputPriceLookup,
  netSellRateOf: (grossPrice: number) => number,
  memo: Map<string, ResourceTreeNode>,
): FinalItemResult {
  const craft = evaluateEquipmentCraft(item, recipe, ctx, memo);
  const focusTotal = totalFocusCost(craft, ctx);

  const output = outputPriceOf(item.uniqueName, recipe.enchant);
  const sellPriceGross = output.price;
  const sellPriceNet = sellPriceGross != null ? netSellRateOf(sellPriceGross) : null;

  const outputMarketId = craftItemId(item.uniqueName, recipe.enchant);
  const liquidityOk =
    output.avgAmount == null
      ? null
      : output.avgAmount >= minSaleRateForTier(itemTierFromUniqueName(item.uniqueName), ctx.minSaleRatePerDay);

  const marginNet =
    sellPriceNet != null && craft.missingPrices.length === 0 ? sellPriceNet - craft.craftCost : null;
  const marginPct = marginNet != null && craft.craftCost > 0 ? marginNet / craft.craftCost : null;
  const silverPerFocus = marginNet != null && focusTotal > 0 ? marginNet / focusTotal : null;

  return {
    uniqueName: item.uniqueName,
    enchant: recipe.enchant,
    craft,
    focusTotal,
    sellPriceGross,
    sellPriceNet,
    sellPriceAge: output.priceAge,
    saleRate: output.avgAmount,
    liquidityOk,
    marginNet,
    marginPct,
    silverPerFocus,
    missingPrices: craft.missingPrices.length > 0 ? craft.missingPrices : sellPriceNet == null ? [outputMarketId] : [],
  };
}

// Tier isn't stored on CraftItem (crafting-catalog.json deliberately stores
// no display metadata — the UI joins against item-catalog.json for that,
// see build-crafting-catalog.mjs), but every Albion equipment uniqueName is
// prefixed "T{tier}_" — cheaper to parse here than to thread a whole catalog
// join through this pure calc module for a single integer.
export function itemTierFromUniqueName(uniqueName: string): number {
  const match = uniqueName.match(/^T(\d)_/);
  return match ? parseInt(match[1], 10) : 1;
}
