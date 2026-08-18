"use client";

import { useMemo, useState } from "react";
import {
  cheapestFood,
  evaluateRecipe,
  isAnimalRecipe,
  isPlantRecipe,
  nutritionNeeded,
  specLevelForRecipe,
  type EvalResult,
  type FarmingRecipe,
  type FarmingSpecDef,
  type FoodItem,
  type PriceLookup,
} from "./calc";
import type { FarmingConfig } from "./types";

function recipeKey(recipe: FarmingRecipe): string {
  return isPlantRecipe(recipe) ? recipe.seedUniqueName : recipe.babyUniqueName;
}

function recipeIconId(recipe: FarmingRecipe): string {
  return recipeKey(recipe);
}

type SortKey = "name" | "tier" | "profitPerDay" | "profitPerFocus" | "famePerDay";

function money(value: number): string {
  return Math.round(value).toLocaleString();
}

function FoodBreakdown({
  food,
  cycleSeconds,
  foods,
  buyPriceOf,
}: {
  food: { foodCategory: string | null; nutritionMax: number; secondsPerNutrition: number };
  cycleSeconds: number;
  foods: FoodItem[];
  buyPriceOf: PriceLookup;
}) {
  const nutrition = nutritionNeeded(food, cycleSeconds);
  const cheapest = cheapestFood(foods, food.foodCategory, buyPriceOf);
  if (!cheapest) {
    return (
      <p className="text-xs text-navy-400">
        No {food.foodCategory ?? "food"} price available to compute the cheapest feed.
      </p>
    );
  }
  // Whole units you'd actually buy (ceiled) as a human-readable quantity, but
  // the cost shown matches the exact expected-value cost used in Cost/Cycle
  // above (nutrition * cost-per-nutrition, not ceiled) to avoid the two
  // numbers disagreeing.
  const units = Math.ceil(nutrition / cheapest.food.nutrition);
  const cost = nutrition * cheapest.costPerNutrition;
  return (
    <p className="text-xs text-navy-300">
      Cheapest food: {cheapest.food.name} × {units} ({money(cost)} silver)
    </p>
  );
}

function RecipeRow({
  recipe,
  result,
  config,
  foods,
  buyPriceOf,
  expanded,
  onToggle,
  onManualPriceChange,
}: {
  recipe: FarmingRecipe;
  result: EvalResult;
  config: FarmingConfig;
  foods: FoodItem[];
  buyPriceOf: PriceLookup;
  expanded: boolean;
  onToggle: () => void;
  onManualPriceChange: (uniqueName: string, value: number) => void;
}) {
  const hasMissingPrices = result.missingPrices.length > 0;

  return (
    <>
      <tr
        onClick={onToggle}
        className="cursor-pointer divide-x divide-navy-700 border-b border-navy-800 hover:bg-navy-800/50"
      >
        <td className="px-2 py-1.5">
          <div className="flex items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`https://render.albiononline.com/v1/item/${recipeIconId(recipe)}.png`}
              alt=""
              className="h-7 w-7"
            />
            <span className="text-sm text-navy-100">{recipe.name}</span>
            {hasMissingPrices && (
              <span
                title={`Missing price data: ${result.missingPrices.join(", ")}`}
                className="rounded bg-amber-800 px-1 text-[10px] text-amber-100"
              >
                !
              </span>
            )}
          </div>
        </td>
        <td className="px-2 py-1.5 text-center text-sm text-navy-300">{recipe.tier}</td>
        <td className="px-2 py-1.5 text-right text-sm text-navy-300">{money(result.costPerCycle)}</td>
        <td className="px-2 py-1.5 text-right text-sm text-navy-300">{money(result.revenuePerCycle)}</td>
        <td
          className={`px-2 py-1.5 text-right text-sm font-semibold ${
            result.profitPerDay >= 0 ? "text-green-400" : "text-red-400"
          }`}
        >
          {money(result.profitPerDay)}
        </td>
        <td className="px-2 py-1.5 text-right text-sm text-navy-300">
          {result.profitPerFocus != null ? result.profitPerFocus.toFixed(2) : "-"}
        </td>
        <td className="px-2 py-1.5 text-right text-sm text-navy-300">{money(result.famePerDay)}</td>
      </tr>
      {expanded && (
        <tr className="border-b border-navy-800 bg-navy-900/60">
          <td colSpan={7} className="px-4 py-3">
            <div className="flex flex-col gap-1">
              <p className="text-xs text-navy-400">
                Focus per cycle: {result.focusCostPerCycle} · Cycles/day: {result.cyclesPerDay.toFixed(2)}
              </p>
              {isAnimalRecipe(recipe) && recipe.growthFood && (
                <FoodBreakdown
                  food={recipe.growthFood}
                  cycleSeconds={recipe.growTimeSeconds}
                  foods={foods}
                  buyPriceOf={buyPriceOf}
                />
              )}
              {isAnimalRecipe(recipe) && recipe.product?.food && (
                <FoodBreakdown
                  food={recipe.product.food}
                  cycleSeconds={recipe.product.productionTimeSeconds}
                  foods={foods}
                  buyPriceOf={buyPriceOf}
                />
              )}
              {hasMissingPrices && config.priceMode === "manual" && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {result.missingPrices
                    .filter((name) => !name.startsWith("food:"))
                    .map((uniqueName) => (
                      <label key={uniqueName} className="flex items-center gap-1 text-xs text-navy-300">
                        {uniqueName}
                        <input
                          type="number"
                          min={0}
                          value={config.manualPrices[uniqueName] ?? ""}
                          onChange={(e) => onManualPriceChange(uniqueName, parseInt(e.target.value, 10) || 0)}
                          className="w-24 rounded border border-navy-600 bg-navy-900 px-1.5 py-0.5 text-navy-100"
                        />
                      </label>
                    ))}
                </div>
              )}
              {hasMissingPrices && config.priceMode !== "manual" && (
                <p className="text-xs text-amber-400">
                  Missing price: {result.missingPrices.filter((n) => !n.startsWith("food:")).join(", ")}
                </p>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

export default function ResultsTable({
  recipes,
  specs,
  config,
  onChange,
  buyPriceOf,
  sellPriceOf,
  foods,
  loading,
  onRefresh,
}: {
  recipes: FarmingRecipe[];
  specs: FarmingSpecDef[];
  config: FarmingConfig;
  onChange: (updater: (c: FarmingConfig) => FarmingConfig) => void;
  buyPriceOf: PriceLookup;
  sellPriceOf: PriceLookup;
  foods: FoodItem[];
  loading: boolean;
  onRefresh: () => void;
}) {
  const [sortKey, setSortKey] = useState<SortKey>("profitPerDay");
  const [sortDesc, setSortDesc] = useState(true);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const rows = useMemo(() => {
    return recipes.map((recipe) => {
      const specLevel = specLevelForRecipe(recipe, config.specs, specs);
      const result = evaluateRecipe(recipe, {
        specLevel,
        location: config.location,
        premium: config.premium,
        sellPriceOf,
        buyPriceOf,
        foods,
      });
      return { recipe, result };
    });
  }, [recipes, specs, config.specs, config.location, config.premium, sellPriceOf, buyPriceOf, foods]);

  const sorted = useMemo(() => {
    const copy = [...rows];
    copy.sort((a, b) => {
      let cmp = 0;
      if (sortKey === "name") cmp = a.recipe.name.localeCompare(b.recipe.name);
      else if (sortKey === "tier") cmp = a.recipe.tier - b.recipe.tier;
      else if (sortKey === "profitPerDay") cmp = a.result.profitPerDay - b.result.profitPerDay;
      else if (sortKey === "profitPerFocus")
        cmp = (a.result.profitPerFocus ?? -Infinity) - (b.result.profitPerFocus ?? -Infinity);
      else if (sortKey === "famePerDay") cmp = a.result.famePerDay - b.result.famePerDay;
      return sortDesc ? -cmp : cmp;
    });
    return copy;
  }, [rows, sortKey, sortDesc]);

  function toggleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDesc((d) => !d);
    } else {
      setSortKey(key);
      setSortDesc(true);
    }
  }

  function toggleExpanded(key: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function onManualPriceChange(uniqueName: string, value: number) {
    onChange((c) => ({ ...c, manualPrices: { ...c.manualPrices, [uniqueName]: value } }));
  }

  const headers: { key: SortKey | null; label: string; align: string }[] = [
    { key: "name", label: "Item", align: "text-left" },
    { key: "tier", label: "Tier", align: "text-center" },
    { key: null, label: "Cost/Cycle", align: "text-right" },
    { key: null, label: "Revenue/Cycle", align: "text-right" },
    { key: "profitPerDay", label: "Profit/Day", align: "text-right" },
    { key: "profitPerFocus", label: "Profit/Focus", align: "text-right" },
    { key: "famePerDay", label: "Fame/Day", align: "text-right" },
  ];

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onRefresh}
          disabled={loading}
          className="rounded bg-gold-500 px-3 py-1.5 text-sm font-medium text-navy-950 hover:bg-gold-400 disabled:opacity-50"
        >
          Refresh Prices
        </button>
        {loading && <p className="text-sm text-navy-300">Loading prices…</p>}
      </div>

      <div className="overflow-x-auto rounded-lg border border-navy-700">
        <table className="w-full border-collapse">
          <thead>
            <tr className="divide-x divide-navy-700 bg-navy-850 text-navy-300">
              {headers.map((h) => (
                <th
                  key={h.label}
                  onClick={h.key ? () => toggleSort(h.key as SortKey) : undefined}
                  className={`px-2 py-2 text-xs font-medium uppercase tracking-wide ${h.align} ${
                    h.key ? "cursor-pointer hover:text-navy-100" : ""
                  }`}
                >
                  {h.label}
                  {h.key && sortKey === h.key ? (sortDesc ? " ▼" : " ▲") : ""}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map(({ recipe, result }) => (
              <RecipeRow
                key={recipeKey(recipe)}
                recipe={recipe}
                result={result}
                config={config}
                foods={foods}
                buyPriceOf={buyPriceOf}
                expanded={expanded.has(recipeKey(recipe))}
                onToggle={() => toggleExpanded(recipeKey(recipe))}
                onManualPriceChange={onManualPriceChange}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
