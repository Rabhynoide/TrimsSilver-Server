import {
  FOCUS_COST_FLOOR,
  FOCUS_COST_SPEC_MAX,
  LOCATION_BONUS_FRACTION,
  PREMIUM_FAME_MULTIPLIER,
  PREMIUM_GROW_TIME_MULTIPLIER,
  PREMIUM_YIELD_MULTIPLIER,
  hasLocationBonus,
  type FarmingLocation,
} from "@/data/farming-constants";

export type FoodRequirement = {
  foodCategory: string | null;
  nutritionMax: number;
  secondsPerNutrition: number;
};

export type LootDrop = { uniqueName: string; name: string; chance: number; amountMin: number; amountMax: number };

export type PlantRecipe = {
  kind: "crop" | "herb";
  seedUniqueName: string;
  name: string;
  tier: number;
  growTimeSeconds: number;
  baseFocusCost: number;
  maxFocusBonus: number;
  baseSeedReturnChance: number;
  npcPrice: number | null;
  fame: number;
  outputUniqueName: string;
  outputName: string;
  outputAmountMin: number;
  outputAmountMax: number;
  bonusLoot: LootDrop[];
};

export type AnimalProduct = {
  productionTimeSeconds: number;
  fame: number;
  outputUniqueName: string;
  outputName: string;
  outputAmountMin: number;
  outputAmountMax: number;
  food: FoodRequirement | null;
};

export type AnimalRecipe = {
  kind: "animal";
  isHorseOrOx: boolean;
  babyUniqueName: string;
  name: string;
  tier: number;
  growTimeSeconds: number;
  baseFocusCost: number;
  maxFocusBonus: number;
  baseOffspringChance: number;
  npcPrice: number | null;
  fame: number;
  grownUniqueName: string;
  grownName: string;
  growthFood: FoodRequirement | null;
  product: AnimalProduct | null;
};

export type FarmingRecipe = PlantRecipe | AnimalRecipe;

export type FoodItem = {
  uniqueName: string;
  name: string;
  tier: number | null;
  foodCategory: string;
  nutrition: number;
};

export type FarmingSpecDef = {
  id: string;
  name: string;
  group: "crops" | "animals" | "herbs";
  isCategoryRoot: boolean;
  parentId: string | null;
  focusCostReductionWeight: number;
};

export function isPlantRecipe(recipe: FarmingRecipe): recipe is PlantRecipe {
  return recipe.kind === "crop" || recipe.kind === "herb";
}

export function isAnimalRecipe(recipe: FarmingRecipe): recipe is AnimalRecipe {
  return recipe.kind === "animal";
}

function clampSpec(specLevel: number): number {
  return Math.max(0, Math.min(FOCUS_COST_SPEC_MAX, specLevel));
}

// Interpolates from the recipe's own base cost (spec 0) down to the universal
// floor (spec 100). See farming-constants.ts for why this is linear.
export function focusCost(baseFocusCost: number, specLevel: number): number {
  const t = clampSpec(specLevel) / FOCUS_COST_SPEC_MAX;
  return Math.round(baseFocusCost - (baseFocusCost - FOCUS_COST_FLOOR) * t);
}

// Seed/offspring return fraction: the tier-based base chance, plus the
// item's full watering bonus if watering happened this cycle (a flat amount,
// NOT scaled by spec level — see farming-constants.ts). No location/city term
// here: the Royal-city bonus applies to output amount, not return chance.
// Values above 1 mean "guaranteed 1 plus a chance at a 2nd" — for
// expected-value purposes that construction's expected value is simply the
// fraction itself, so no branching is needed here.
export function returnFraction(baseChance: number, maxFocusBonus: number, watered: boolean): number {
  return baseChance + (watered ? maxFocusBonus : 0);
}

// The Royal-city "Local" bonus (+10%) and Premium (+100%) both apply to the
// harvested/produced output amount, stacking additively on the base amount
// (confirmed live in-game — see farming-constants.ts).
export function averageAmount(
  min: number,
  max: number,
  premium: boolean,
  locationBonus: boolean,
): number {
  const avg = (min + max) / 2;
  const multiplier =
    1 + (premium ? PREMIUM_YIELD_MULTIPLIER - 1 : 0) + (locationBonus ? LOCATION_BONUS_FRACTION : 0);
  return avg * multiplier;
}

export function cyclesPerDay(growTimeSeconds: number, premium: boolean): number {
  const effectiveSeconds = premium ? growTimeSeconds * PREMIUM_GROW_TIME_MULTIPLIER : growTimeSeconds;
  return 86400 / effectiveSeconds;
}

export function fameAmount(baseFame: number, premium: boolean): number {
  return premium ? baseFame * PREMIUM_FAME_MULTIPLIER : baseFame;
}

// Total nutrition points consumed feeding across one full cycle.
export function nutritionNeeded(food: FoodRequirement, cycleSeconds: number): number {
  return cycleSeconds / food.secondsPerNutrition;
}

export type PriceLookup = (uniqueName: string) => number | null;

// Hours since the price was last updated (null when the current price mode
// has no meaningful single "age" — averages, manual entries, EMV).
export type AgeLookup = (uniqueName: string) => number | null;

function maxAge(...ages: (number | null)[]): number | null {
  const known = ages.filter((a): a is number => a != null);
  return known.length > 0 ? Math.max(...known) : null;
}

export type CheapestFood = { food: FoodItem; costPerNutrition: number };

export function cheapestFood(
  foods: FoodItem[],
  category: string | null,
  priceOf: PriceLookup,
): CheapestFood | null {
  if (!category) return null;
  let best: CheapestFood | null = null;
  for (const food of foods) {
    if (food.foodCategory !== category) continue;
    const price = priceOf(food.uniqueName);
    if (price == null) continue;
    const costPerNutrition = price / food.nutrition;
    if (!best || costPerNutrition < best.costPerNutrition) best = { food, costPerNutrition };
  }
  return best;
}

export type EvalContext = {
  specLevel: number;
  // Whether to spend Focus watering/nurturing each cycle. When false, the
  // spec-driven nurture bonus and its Focus cost are both zeroed out — only
  // the tier-based base yield and the (Focus-independent) location bonus
  // still apply.
  useFocus: boolean;
  location: FarmingLocation;
  premium: boolean;
  sellPriceOf: PriceLookup;
  buyPriceOf: PriceLookup;
  sellPriceAgeOf: AgeLookup;
  buyPriceAgeOf: AgeLookup;
  foods: FoodItem[];
};

export type InputPriceSource = "market" | "npc" | null;

export type EvalResult = {
  focusCostPerCycle: number;
  cyclesPerDay: number;
  revenuePerCycle: number;
  costPerCycle: number;
  profitPerCycle: number;
  profitPerDay: number;
  profitPerFocus: number | null;
  famePerDay: number;
  missingPrices: string[];
  // Where the seed/baby input price came from — the live market (via
  // buyPriceOf) if available, otherwise the fixed NPC farming-merchant price
  // baked into the game data (see npcPrice on the recipe). Null only if
  // neither is available.
  inputPriceSource: InputPriceSource;
  // The raw per-unit seed/baby price actually used (before multiplying by net
  // units consumed) — kept separate from costPerCycle so the UI can show it.
  inputPrice: number | null;
  // Chance of getting the planted seed/bred baby back "for free" (tier base +
  // nurture bonus + location bonus). This only ever discounts the input cost
  // — it's never added to revenue, since the returned seed/baby isn't itself
  // sold, only replanted/rebred for the next cycle.
  inputReturnFraction: number | null;
  netInputUnitsConsumed: number | null;
  // Oldest age (hours) among the market prices actually used for this row's
  // cost/revenue, ignoring prices with no age concept (NPC, manual, EMV,
  // averages). Null if no market-sourced price was used at all.
  maxPriceAgeHours: number | null;
};

// Market price wins when available; otherwise fall back to the NPC merchant's
// fixed price so a cost estimate always exists when a real one can be had.
function resolveInputPrice(
  marketPrice: number | null,
  npcPrice: number | null,
): { price: number | null; source: InputPriceSource } {
  if (marketPrice != null) return { price: marketPrice, source: "market" };
  if (npcPrice != null) return { price: npcPrice, source: "npc" };
  return { price: null, source: null };
}

function evaluatePlant(recipe: PlantRecipe, ctx: EvalContext): EvalResult {
  const missingPrices: string[] = [];

  const { price: seedPrice, source: inputPriceSource } = resolveInputPrice(
    ctx.buyPriceOf(recipe.seedUniqueName),
    recipe.npcPrice,
  );
  if (seedPrice == null) missingPrices.push(recipe.seedUniqueName);

  const cropPrice = ctx.sellPriceOf(recipe.outputUniqueName);
  if (cropPrice == null) missingPrices.push(recipe.outputUniqueName);

  const fraction = returnFraction(recipe.baseSeedReturnChance, recipe.maxFocusBonus, ctx.useFocus);
  // Net seeds consumed per cycle = 1 planted - expected seeds returned.
  const netSeedsConsumed = Math.max(0, 1 - fraction);

  const locationBonus = hasLocationBonus(recipe.seedUniqueName, ctx.location);
  const cropAmount = averageAmount(
    recipe.outputAmountMin,
    recipe.outputAmountMax,
    ctx.premium,
    locationBonus,
  );
  let revenuePerCycle = cropPrice != null ? cropPrice * cropAmount : 0;

  for (const bonus of recipe.bonusLoot) {
    const bonusPrice = ctx.sellPriceOf(bonus.uniqueName);
    if (bonusPrice == null) continue;
    // Bonus drops (e.g. Earthworm) aren't "the product" the Local city bonus
    // names, so only Premium applies to their amount.
    const bonusAmount = averageAmount(bonus.amountMin, bonus.amountMax, ctx.premium, false);
    revenuePerCycle += bonusPrice * bonus.chance * bonusAmount;
  }

  const costPerCycle = seedPrice != null ? seedPrice * netSeedsConsumed : 0;
  const cycles = cyclesPerDay(recipe.growTimeSeconds, ctx.premium);
  const focusPerCycle = ctx.useFocus ? focusCost(recipe.baseFocusCost, ctx.specLevel) : 0;
  const profitPerCycle = revenuePerCycle - costPerCycle;

  const priceAge = maxAge(
    inputPriceSource === "market" ? ctx.buyPriceAgeOf(recipe.seedUniqueName) : null,
    ctx.sellPriceAgeOf(recipe.outputUniqueName),
  );

  return {
    focusCostPerCycle: focusPerCycle,
    cyclesPerDay: cycles,
    revenuePerCycle,
    costPerCycle,
    profitPerCycle,
    profitPerDay: profitPerCycle * cycles,
    profitPerFocus: focusPerCycle > 0 ? profitPerCycle / focusPerCycle : null,
    famePerDay: fameAmount(recipe.fame, ctx.premium) * cycles,
    missingPrices,
    inputPriceSource,
    inputPrice: seedPrice,
    inputReturnFraction: fraction,
    netInputUnitsConsumed: netSeedsConsumed,
    maxPriceAgeHours: priceAge,
  };
}

function evaluateAnimal(recipe: AnimalRecipe, ctx: EvalContext): EvalResult {
  const missingPrices: string[] = [];

  const { price: babyPrice, source: inputPriceSource } = resolveInputPrice(
    ctx.buyPriceOf(recipe.babyUniqueName),
    recipe.npcPrice,
  );
  if (babyPrice == null) missingPrices.push(recipe.babyUniqueName);

  const grownPrice = ctx.sellPriceOf(recipe.grownUniqueName);
  if (grownPrice == null) missingPrices.push(recipe.grownUniqueName);

  const fraction = returnFraction(recipe.baseOffspringChance, recipe.maxFocusBonus, ctx.useFocus);

  let foodCostGrowth = 0;
  if (recipe.growthFood) {
    const nutrition = nutritionNeeded(recipe.growthFood, recipe.growTimeSeconds);
    const cheapest = cheapestFood(ctx.foods, recipe.growthFood.foodCategory, ctx.buyPriceOf);
    if (cheapest) {
      foodCostGrowth = nutrition * cheapest.costPerNutrition;
    } else {
      missingPrices.push(`food:${recipe.growthFood.foodCategory}`);
    }
  }

  // Raising a baby to adulthood yields exactly 1 grown animal (guaranteed),
  // which is the only thing sold — an expected `fraction` of the next cycle's
  // baby is bred back "for free" instead, so (like a plant's seed return)
  // that only discounts the input cost, never adds to revenue.
  const netBabiesConsumed = Math.max(0, 1 - fraction);
  const revenuePerGrowthCycle = grownPrice ?? 0;
  const costPerGrowthCycle = (babyPrice ?? 0) * netBabiesConsumed + foodCostGrowth;
  const growthCycles = cyclesPerDay(recipe.growTimeSeconds, ctx.premium);
  const growthFocusPerCycle = ctx.useFocus ? focusCost(recipe.baseFocusCost, ctx.specLevel) : 0;
  const growthProfitPerCycle = revenuePerGrowthCycle - costPerGrowthCycle;

  if (!recipe.product) {
    const priceAge = maxAge(
      inputPriceSource === "market" ? ctx.buyPriceAgeOf(recipe.babyUniqueName) : null,
      ctx.sellPriceAgeOf(recipe.grownUniqueName),
    );
    return {
      focusCostPerCycle: growthFocusPerCycle,
      cyclesPerDay: growthCycles,
      revenuePerCycle: revenuePerGrowthCycle,
      costPerCycle: costPerGrowthCycle,
      profitPerCycle: growthProfitPerCycle,
      profitPerDay: growthProfitPerCycle * growthCycles,
      profitPerFocus: growthFocusPerCycle > 0 ? growthProfitPerCycle / growthFocusPerCycle : null,
      famePerDay: fameAmount(recipe.fame, ctx.premium) * growthCycles,
      missingPrices,
      inputPriceSource,
      inputPrice: babyPrice,
      inputReturnFraction: fraction,
      netInputUnitsConsumed: netBabiesConsumed,
      maxPriceAgeHours: priceAge,
    };
  }

  // Once grown, the ongoing product loop (milk/eggs/wool) is what's typically
  // profitable long-term — report that instead of the one-time growth cycle.
  const product = recipe.product;
  const productPrice = ctx.sellPriceOf(product.outputUniqueName);
  if (productPrice == null) missingPrices.push(product.outputUniqueName);

  let foodCostProduct = 0;
  if (product.food) {
    const nutrition = nutritionNeeded(product.food, product.productionTimeSeconds);
    const cheapest = cheapestFood(ctx.foods, product.food.foodCategory, ctx.buyPriceOf);
    if (cheapest) {
      foodCostProduct = nutrition * cheapest.costPerNutrition;
    } else {
      missingPrices.push(`food:${product.food.foodCategory}`);
    }
  }

  const productAmount = averageAmount(
    product.outputAmountMin,
    product.outputAmountMax,
    ctx.premium,
    hasLocationBonus(recipe.babyUniqueName, ctx.location),
  );
  const revenuePerCycle = productPrice != null ? productPrice * productAmount : 0;
  const cycles = 86400 / product.productionTimeSeconds;
  const profitPerCycle = revenuePerCycle - foodCostProduct;

  return {
    focusCostPerCycle: 0,
    cyclesPerDay: cycles,
    revenuePerCycle,
    costPerCycle: foodCostProduct,
    profitPerCycle,
    profitPerDay: profitPerCycle * cycles,
    profitPerFocus: null,
    famePerDay: fameAmount(product.fame, ctx.premium) * cycles,
    missingPrices,
    // No seed/baby purchase happens in the recurring product cycle itself
    // (it assumes an already-grown animal), so there's no input price to
    // attribute here.
    inputPriceSource: null,
    inputPrice: null,
    inputReturnFraction: null,
    netInputUnitsConsumed: null,
    maxPriceAgeHours: ctx.sellPriceAgeOf(product.outputUniqueName),
  };
}

export function evaluateRecipe(recipe: FarmingRecipe, ctx: EvalContext): EvalResult {
  return isPlantRecipe(recipe) ? evaluatePlant(recipe, ctx) : evaluateAnimal(recipe, ctx);
}

function specGroupOf(recipe: FarmingRecipe): FarmingSpecDef["group"] {
  if (recipe.kind === "animal") return "animals";
  return recipe.kind === "herb" ? "herbs" : "crops";
}

// The achievement tree has a category-wide spec (e.g. "Crop Farmer") and a
// per-item spec (e.g. "Carrot Farmer"), each independently levelled 0-100 with
// its own focusCostReductionWeight (1 for category, 2 for item — see
// achievements.json's templateachievement bucket). The wiki documents the
// overall 0-100 -> focus-cost-floor formula but not how these two combine, so
// this takes the higher of the two as the effective spec level — a documented
// approximation, same spirit as the linear focus-cost interpolation above.
export function specLevelForRecipe(
  recipe: FarmingRecipe,
  specs: Record<string, number>,
  specDefs: FarmingSpecDef[],
): number {
  const group = specGroupOf(recipe);
  const uniqueName = isPlantRecipe(recipe) ? recipe.seedUniqueName : recipe.babyUniqueName;

  let level = 0;
  for (const def of specDefs) {
    if (def.group !== group) continue;
    if (def.isCategoryRoot) {
      level = Math.max(level, specs[def.id] ?? 0);
      continue;
    }
    const stem = def.id.replace(/^FARM_(CROPS|ANIMALS|HERBS)_/, "");
    if (uniqueName.includes(`_${stem}`)) {
      level = Math.max(level, specs[def.id] ?? 0);
    }
  }
  return level;
}
