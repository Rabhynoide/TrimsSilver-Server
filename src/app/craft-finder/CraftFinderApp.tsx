"use client";

import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { CITIES } from "../market-prices/types";
import type { CatalogItem, PriceRow } from "../market-prices/types";
import { readJsonResponse } from "@/lib/http";
import { craftItemId, type CraftItem } from "../crafting/calc";
import {
  CRAFT_FINDER_NODE_CATEGORIES,
  CRAFT_FINDER_CATEGORY_LABELS_FR,
  CRAFT_FINDER_ITEM_TYPES_BY_WORKSHOP,
  CRAFT_FINDER_ITEM_TYPE_LABELS_FR,
  defaultReturnRateForCity,
  type CraftFinderNodeCategory,
  type CraftFinderWorkshop,
} from "@/data/craft-finder-constants";
import {
  evaluateFinalItem,
  itemTierFromUniqueName,
  type EvalContext,
  type FinalItemResult,
  type MarketSnapshot,
  type ResourceRecipe,
  type ResourceTreeNode,
} from "./calc";
import {
  defaultCraftFinderConfig,
  salesTaxRateFor,
  setupFeeRateFor,
  type CityCategoryRates,
  type CraftFinderConfig,
  type PriceMode,
  type ResourceSourceMode,
} from "./types";
import { signInWithDiscord } from "./actions";
import RankingTable from "./RankingTable";
import MakeOrBuyTree from "./MakeOrBuyTree";

const PRICE_MODE_LABELS: Record<PriceMode, string> = {
  current: "AODP Actuel",
  average: "AODP Moyen",
  manual: "Manuel",
};

const CHEAPEST_MODE_LABEL = "N'importe où (moins cher)";

// Shared two-button toggle for the two independent "this city only vs
// cheapest of all 8" choices (resourceSourceMode for buying, saleCityMode
// for selling — see types.ts's ResourceSourceMode) — same shape, same
// styling, just a different config field and label behind each.
function CityModeToggle({
  value,
  onChange,
  simulationCity,
  cityLabel,
}: {
  value: ResourceSourceMode;
  onChange: (mode: ResourceSourceMode) => void;
  simulationCity: string;
  cityLabel: string;
}) {
  return (
    <div className="flex gap-2">
      {(["simulationCity", "cheapest"] as ResourceSourceMode[]).map((mode) => (
        <button
          key={mode}
          type="button"
          onClick={() => onChange(mode)}
          aria-pressed={value === mode}
          className={`rounded border px-2 py-1 text-xs ${
            value === mode
              ? "border-gold-500 bg-gold-500 text-navy-950"
              : "border-navy-600 text-navy-200 hover:bg-navy-700"
          }`}
        >
          {mode === "simulationCity" ? `${cityLabel} (${simulationCity})` : CHEAPEST_MODE_LABEL}
        </button>
      ))}
    </div>
  );
}

export default function CraftFinderApp({ isSignedIn }: { isSignedIn: boolean }) {
  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
  const [equipment, setEquipment] = useState<CraftItem[]>([]);
  const [resources, setResources] = useState<ResourceRecipe[]>([]);
  const [config, setConfig] = useState<CraftFinderConfig>(defaultCraftFinderConfig());
  const [prices, setPrices] = useState<PriceRow[]>([]);
  const [pricesLoading, setPricesLoading] = useState(false);
  const [pricesError, setPricesError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [expandedWorkshops, setExpandedWorkshops] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetch("/api/market/items")
      .then((res) => res.json())
      .then((data) => setCatalog(data.items ?? []))
      .catch(() => setCatalog([]));
    fetch("/api/craft-finder/catalog")
      .then((res) => res.json())
      .then((data) => {
        setEquipment(data.equipment ?? []);
        setResources(data.resources ?? []);
      })
      .catch(() => {
        setEquipment([]);
        setResources([]);
      });
  }, []);

  useEffect(() => {
    if (!isSignedIn) return;
    fetch("/api/craft-finder/settings")
      .then((res) => res.json())
      .then((data) => {
        if (data.settings?.config) setConfig((c) => ({ ...c, ...data.settings.config }));
      })
      .catch(() => {});
  }, [isSignedIn]);

  const resourceByUniqueName = useMemo(
    () => new Map(resources.map((r) => [r.uniqueName, r])),
    [resources],
  );

  // Fetches Craft Finder's entire price universe (equipment at the selected
  // enchant + the whole resource-refining catalog) in ONE request via
  // /api/craft-finder/prices, which computes that item list itself
  // server-side. Deliberately NOT the chunked /api/market/prices +
  // fetchMarketPrices() pattern every other feature uses — reproduced live
  // against production that Craft Finder's ~19-23 chunked browser requests
  // per refresh (needed for a catalog this size) escalate through
  // BunkerWeb's anti-abuse handling (403 → 429 → 502, worsening across the
  // burst) purely from request *count*, regardless of each request's own
  // content or size. See src/app/api/craft-finder/prices/route.ts and
  // PROJECT_STATUS.md for the full diagnosis.
  async function fetchPrices() {
    setPricesLoading(true);
    setPricesError(null);
    try {
      const url = `/api/craft-finder/prices?enchants=${config.enchants.join(",")}&averageDays=${config.averageDays}`;
      const res = await fetch(url);
      const data = await readJsonResponse<{ prices?: PriceRow[]; error?: string; detail?: string }>(res);
      if (!res.ok) throw new Error(data.detail ?? data.error ?? `Échec de la requête (${res.status})`);
      setPrices(data.prices ?? []);
    } catch (err) {
      setPricesError(err instanceof Error ? err.message : "Erreur réseau");
      setPrices([]);
    } finally {
      setPricesLoading(false);
    }
  }

  const fetchKey = `${config.enchants.join(",")}|${config.averageDays}`;
  const lastFetchedKeyRef = useRef<string | null>(null);
  useEffect(() => {
    if (lastFetchedKeyRef.current === fetchKey) return;
    lastFetchedKeyRef.current = fetchKey;
    fetchPrices();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchKey]);

  async function saveSettings() {
    setSaving(true);
    try {
      await fetch("/api/craft-finder/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ config }),
      });
    } finally {
      setSaving(false);
    }
  }

  const priceRowsById = useMemo(() => {
    const map = new Map<string, PriceRow[]>();
    for (const row of prices) {
      const list = map.get(row.itemId);
      if (list) list.push(row);
      else map.set(row.itemId, [row]);
    }
    return map;
  }, [prices]);

  // The sell side always compares all 8 cities and takes whichever is best
  // (priciest to sell) — see types.ts: only crafting/refining fees stay tied
  // to the selected simulation city, and this feature's own scope
  // deliberately doesn't model transport cost between the buy/sell/craft
  // cities. The buy side does the same UNLESS resourceSourceMode restricts it
  // to simulationCity's own market only (restrictToCity below), see
  // ResourceSourceMode's own comment in types.ts. Quality is always 1 —
  // Craft Finder's own scope, per the user.
  function bestAcrossCities(
    marketId: string,
    pick: (a: PriceRow, b: PriceRow) => PriceRow,
    restrictToCity?: string,
  ): MarketSnapshot {
    if (config.priceMode === "manual") {
      const manual = config.manualPrices[marketId];
      return { price: manual ?? null, priceAge: null, avgAmount: null, city: null };
    }
    let rows = (priceRowsById.get(marketId) ?? []).filter((r) => r.quality === 1 && r.sellPriceMin > 0);
    if (restrictToCity) rows = rows.filter((r) => r.city === restrictToCity);
    if (rows.length === 0) return { price: null, priceAge: null, avgAmount: null, city: null };
    const best = rows.reduce(pick);
    const price = config.priceMode === "average" ? best.avgPrice ?? null : best.sellPriceMin;
    return { price, priceAge: best.sellPriceMinDate, avgAmount: best.avgAmount ?? null, city: best.city };
  }

  const marketOf = useMemo(() => {
    const restrictToCity = config.resourceSourceMode === "simulationCity" ? config.simulationCity : undefined;
    return (marketId: string): MarketSnapshot =>
      bestAcrossCities(marketId, (a, b) => (a.sellPriceMin <= b.sellPriceMin ? a : b), restrictToCity);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [priceRowsById, config.priceMode, config.manualPrices, config.resourceSourceMode, config.simulationCity]);

  const outputPriceOf = useMemo(() => {
    const restrictToCity = config.saleCityMode === "simulationCity" ? config.simulationCity : undefined;
    return (uniqueName: string, enchant: number): MarketSnapshot =>
      bestAcrossCities(
        craftItemId(uniqueName, enchant),
        (a, b) => (a.sellPriceMin >= b.sellPriceMin ? a : b),
        restrictToCity,
      );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [priceRowsById, config.priceMode, config.manualPrices, config.saleCityMode, config.simulationCity]);

  function netSellRateOf(gross: number): number {
    return gross * (1 - salesTaxRateFor(config.premium) - setupFeeRateFor(config.premium));
  }

  // Return Rate and the station's Nutrition-fee rate both come from the
  // currently selected simulation city's row in cityCategoryConfig — the
  // one config table this feature has that genuinely varies by city (see
  // types.ts).
  const ctx: EvalContext = useMemo(() => {
    const cityRates = config.cityCategoryConfig[config.simulationCity];
    const cityItemTypeRates = config.itemTypeReturnRates[config.simulationCity];
    return {
      resourceByUniqueName,
      marketOf,
      returnRateFor: (category) => cityRates?.[category]?.returnRate ?? 0,
      simulationCity: config.simulationCity,
      itemTypeReturnRateFor: (craftingCategory) =>
        craftingCategory ? cityItemTypeRates?.[craftingCategory] : undefined,
      nutritionFeeRateFor: (category) => cityRates?.[category]?.stationFeeSilverPer100Nutrition ?? 0,
      useFocusFor: (category) => config.useFocus[category] ?? true,
      minSaleRatePerDay: config.minSaleRatePerDay,
      maxDepth: 8,
    };
  }, [
    resourceByUniqueName,
    marketOf,
    config.cityCategoryConfig,
    config.itemTypeReturnRates,
    config.simulationCity,
    config.useFocus,
    config.minSaleRatePerDay,
  ]);

  const rankedRows = useMemo(() => {
    const rows: FinalItemResult[] = [];
    // One shared memo for the whole ranking pass — safe because every item
    // in this pass shares the same ctx (config doesn't vary per item), see
    // calc.ts's evaluateEquipmentCraft doc.
    const memo = new Map<string, ResourceTreeNode>();
    for (const item of equipment) {
      const tier = itemTierFromUniqueName(item.uniqueName);
      if (tier < config.tierMin || tier > config.tierMax) continue;
      for (const enchant of config.enchants) {
        const recipe = item.recipes.find((r) => r.enchant === enchant);
        if (!recipe) continue;
        const result = evaluateFinalItem(item, recipe, ctx, outputPriceOf, netSellRateOf, memo);
        if (config.onlyLiquid && result.liquidityOk === false) continue;
        if (config.minMarginPct != null && (result.marginPct == null || result.marginPct < config.minMarginPct)) {
          continue;
        }
        rows.push(result);
      }
    }
    return rows;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    equipment,
    config.enchants,
    config.tierMin,
    config.tierMax,
    config.onlyLiquid,
    config.minMarginPct,
    ctx,
    outputPriceOf,
    config.premium,
  ]);

  const selectedItem = useMemo(
    () => equipment.find((i) => i.uniqueName === config.selectedUniqueName) ?? null,
    [equipment, config.selectedUniqueName],
  );
  const selectedRecipe = selectedItem
    ? selectedItem.recipes.find((r) => r.enchant === config.selectedEnchant) ?? null
    : null;

  // A fresh memo whenever the selected item/recipe/pricing context changes —
  // the map itself never reads these deps, it's just the reset trigger.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const selectedMemo = useMemo(() => new Map<string, ResourceTreeNode>(), [selectedItem, selectedRecipe, ctx]);

  function nameOf(uniqueName: string): string {
    return catalog.find((i) => i.uniqueName === uniqueName)?.name ?? uniqueName;
  }

  function onManualPriceChange(marketId: string, value: number) {
    setConfig((c) => ({ ...c, manualPrices: { ...c.manualPrices, [marketId]: value } }));
  }

  function openTree(uniqueName: string, enchant: number) {
    setConfig((c) => ({ ...c, selectedUniqueName: uniqueName, selectedEnchant: enchant }));
  }

  // Edits the currently selected simulation city's row only — switching
  // "Ville de simulation" switches which city's numbers these fields show
  // and edit, rather than needing a separate city picker just for this table.
  function updateCityCategoryValue(
    field: keyof CityCategoryRates,
    category: CraftFinderNodeCategory,
    value: number,
  ) {
    setConfig((c) => ({
      ...c,
      cityCategoryConfig: {
        ...c.cityCategoryConfig,
        [c.simulationCity]: {
          ...c.cityCategoryConfig[c.simulationCity],
          [category]: { ...c.cityCategoryConfig[c.simulationCity][category], [field]: value },
        },
      },
    }));
  }

  // Resets only Return Rate for the selected simulation city, back to
  // Albion's own Local Production Bonus formula (see
  // defaultReturnRateForCity's comment) — station fee is left untouched
  // since, unlike Return Rate, it has no derivable default to reset to.
  function resetReturnRatesToGameDefaults() {
    setConfig((c) => {
      const city = c.simulationCity;
      const current = c.cityCategoryConfig[city];
      const reset = {} as typeof current;
      for (const category of CRAFT_FINDER_NODE_CATEGORIES) {
        reset[category] = { ...current[category], returnRate: defaultReturnRateForCity(city, category) };
      }
      return { ...c, cityCategoryConfig: { ...c.cityCategoryConfig, [city]: reset } };
    });
  }

  function toggleCategoryFocus(category: CraftFinderNodeCategory) {
    setConfig((c) => ({ ...c, useFocus: { ...c.useFocus, [category]: !c.useFocus[category] } }));
  }

  function toggleWorkshopExpanded(workshop: string) {
    setExpandedWorkshops((prev) => {
      const next = new Set(prev);
      if (next.has(workshop)) next.delete(workshop);
      else next.add(workshop);
      return next;
    });
  }

  // `value: null` clears the override for this item type (back to the
  // workshop-level rate + automatic city-specialty bump) — a real number
  // (including 0) is a genuine user-entered Return Rate, so "unset" needs
  // its own distinct signal rather than defaulting to 0, same reasoning as
  // minMarginPct elsewhere in this config.
  function updateItemTypeReturnRate(craftingCategory: string, value: number | null) {
    setConfig((c) => {
      const cityRates = { ...(c.itemTypeReturnRates[c.simulationCity] ?? {}) };
      if (value == null) delete cityRates[craftingCategory];
      else cityRates[craftingCategory] = value;
      return { ...c, itemTypeReturnRates: { ...c.itemTypeReturnRates, [c.simulationCity]: cityRates } };
    });
  }

  const priceModes: PriceMode[] = ["current", "average", "manual"];

  return (
    <main className="flex flex-1 flex-col gap-6 p-8 w-full">
      <h1 className="text-2xl font-semibold text-navy-100">Quoi fabriquer pour gagner de l&apos;argent</h1>
      <p className="text-sm text-navy-400">
        Classement des équipements, nourritures et potions les plus rentables à fabriquer, ressource par
        ressource jusqu&apos;à la matière première — filtré par volume de vente réel pour écarter les prix peu
        fiables. Serveur Europe uniquement.
      </p>

      {pricesError && (
        <p className="rounded border border-red-800 bg-red-950/40 px-3 py-2 text-sm text-red-300">
          Échec du chargement des prix : {pricesError}
        </p>
      )}

      <section className="rounded-lg border border-navy-700 bg-navy-850 p-4">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-navy-400">Paramètres</h2>
        <div className="flex flex-wrap items-end gap-4">
          <label className="flex flex-col gap-1 text-sm text-navy-300">
            Ville de simulation (craft/raffinage)
            <select
              value={config.simulationCity}
              onChange={(e) => setConfig((c) => ({ ...c, simulationCity: e.target.value }))}
              className="rounded border border-navy-600 bg-navy-900 px-2 py-1 text-navy-100"
            >
              {CITIES.map((city) => (
                <option key={city} value={city}>
                  {city}
                </option>
              ))}
            </select>
          </label>
          <fieldset className="flex flex-col gap-1 text-sm text-navy-300">
            <legend>Enchantements inclus</legend>
            <div className="flex gap-3">
              {[0, 1, 2, 3, 4].map((e) => (
                <label key={e} className="flex items-center gap-1" title={e === 0 ? "Mis en cache" : "Prix en direct"}>
                  <input
                    type="checkbox"
                    checked={config.enchants.includes(e)}
                    onChange={(ev) =>
                      setConfig((c) => ({
                        ...c,
                        enchants: ev.target.checked
                          ? [...c.enchants, e].sort()
                          : c.enchants.filter((x) => x !== e),
                      }))
                    }
                  />
                  {e}
                </label>
              ))}
            </div>
          </fieldset>
          <label className="flex flex-col gap-1 text-sm text-navy-300">
            Mode de prix
            <select
              value={config.priceMode}
              onChange={(e) => setConfig((c) => ({ ...c, priceMode: e.target.value as PriceMode }))}
              className="rounded border border-navy-600 bg-navy-900 px-2 py-1 text-navy-100"
            >
              {priceModes.map((mode) => (
                <option key={mode} value={mode}>
                  {PRICE_MODE_LABELS[mode]}
                </option>
              ))}
            </select>
          </label>
          <fieldset className="flex flex-col gap-1 text-sm text-navy-300">
            <legend>Ressources en entrée depuis</legend>
            <CityModeToggle
              value={config.resourceSourceMode}
              onChange={(mode) => setConfig((c) => ({ ...c, resourceSourceMode: mode }))}
              simulationCity={config.simulationCity}
              cityLabel="Ville de fabrication"
            />
          </fieldset>
          <fieldset className="flex flex-col gap-1 text-sm text-navy-300">
            <legend>Vente de l&apos;objet fini vers</legend>
            <CityModeToggle
              value={config.saleCityMode}
              onChange={(mode) => setConfig((c) => ({ ...c, saleCityMode: mode }))}
              simulationCity={config.simulationCity}
              cityLabel="Ville de fabrication"
            />
          </fieldset>
          {config.priceMode === "average" && (
            <label className="flex flex-col gap-1 text-sm text-navy-300">
              Jours moyens
              <input
                type="number"
                min={1}
                max={30}
                value={config.averageDays}
                onChange={(e) => setConfig((c) => ({ ...c, averageDays: parseInt(e.target.value, 10) || 1 }))}
                className="w-20 rounded border border-navy-600 bg-navy-900 px-2 py-1 text-navy-100"
              />
            </label>
          )}
          <label className="flex flex-col gap-1 text-sm text-navy-300">
            Seuil de liquidité (ventes/jour, T1-T4)
            <input
              type="number"
              min={0}
              step={0.5}
              value={config.minSaleRatePerDay}
              onChange={(e) =>
                setConfig((c) => ({ ...c, minSaleRatePerDay: parseFloat(e.target.value) || 0 }))
              }
              className="w-28 rounded border border-navy-600 bg-navy-900 px-2 py-1 text-navy-100"
            />
          </label>
          <label className="flex items-center gap-2 text-sm text-navy-300">
            <input
              type="checkbox"
              checked={config.onlyLiquid}
              onChange={(e) => setConfig((c) => ({ ...c, onlyLiquid: e.target.checked }))}
            />
            N&apos;afficher que les items liquides
          </label>
          <label className="flex flex-col gap-1 text-sm text-navy-300">
            Marge % minimale
            <input
              type="number"
              step={1}
              placeholder="aucun filtre"
              value={config.minMarginPct != null ? Math.round(config.minMarginPct * 1000) / 10 : ""}
              onChange={(e) =>
                setConfig((c) => ({
                  ...c,
                  minMarginPct: e.target.value === "" ? null : (parseFloat(e.target.value) || 0) / 100,
                }))
              }
              className="w-24 rounded border border-navy-600 bg-navy-900 px-2 py-1 text-navy-100"
            />
          </label>
          <label className="flex items-center gap-2 text-sm text-navy-300">
            <input
              type="checkbox"
              checked={config.premium}
              onChange={(e) => setConfig((c) => ({ ...c, premium: e.target.checked }))}
            />
            Premium
          </label>
        </div>

        <div className="mt-4 flex flex-wrap items-end gap-4">
          <label className="flex flex-col gap-1 text-sm text-navy-300">
            Tier min
            <input
              type="number"
              min={1}
              max={8}
              value={config.tierMin}
              onChange={(e) => setConfig((c) => ({ ...c, tierMin: parseInt(e.target.value, 10) || 1 }))}
              className="w-16 rounded border border-navy-600 bg-navy-900 px-2 py-1 text-navy-100"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm text-navy-300">
            Tier max
            <input
              type="number"
              min={1}
              max={8}
              value={config.tierMax}
              onChange={(e) => setConfig((c) => ({ ...c, tierMax: parseInt(e.target.value, 10) || 8 }))}
              className="w-16 rounded border border-navy-600 bg-navy-900 px-2 py-1 text-navy-100"
            />
          </label>
        </div>

        <p className="mt-3 text-xs text-navy-400">
          Taxe de vente {(salesTaxRateFor(config.premium) * 100).toFixed(2)}% / Frais de placement{" "}
          {(setupFeeRateFor(config.premium) * 100).toFixed(2)}%, selon le statut Premium.{" "}
          {config.resourceSourceMode === "simulationCity"
            ? `L'achat des matières est restreint au marché de ${config.simulationCity}`
            : "L'achat des matières compare les 8 villes"}{" "}
          (voir la ville indiquée à côté de chaque prix d&apos;achat dans l&apos;arbre acheter/fabriquer) ;{" "}
          {config.saleCityMode === "simulationCity"
            ? `la vente de l'objet fini est restreinte au marché de ${config.simulationCity}`
            : "la vente de l'objet fini compare aussi les 8 villes"}{" "}
          (voir la ville indiquée à côté de « Vente nette »). Transport et profondeur du carnet d&apos;ordres non modélisés (v1) — voir le taux de vente pour le
          signal de liquidité. &quot;Volume max/jour&quot; = 25% des ventes/jour (règle empirique pour éviter
          de saturer vos propres annonces et repayer les frais de placement à chaque re-listing) ; &quot;Gain
          estimé/jour&quot; = marge unitaire × ce volume.
        </p>

        <details className="mt-4">
          <summary className="cursor-pointer text-sm font-medium text-navy-300">
            Taux de retour / frais de station / Focus par catégorie — {config.simulationCity}
          </summary>
          <div className="mt-2 flex items-center justify-between">
            <span className="text-xs text-navy-500">
              Valeurs de base : +18% (toutes villes) + bonus de spécialisation de {config.simulationCity} —
              corrigez si vous avez de la spé ou des bonus de production actifs.
            </span>
            <button
              type="button"
              onClick={resetReturnRatesToGameDefaults}
              className="shrink-0 rounded border border-navy-600 px-2 py-1 text-xs text-navy-200 hover:bg-navy-700"
            >
              Réinitialiser les taux de retour aux valeurs de base
            </button>
          </div>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[640px] table-fixed border-collapse text-sm">
              <thead>
                <tr className="divide-x divide-navy-700 bg-navy-850 text-navy-300">
                  <th className="w-56 px-2 py-1.5 text-left text-xs uppercase tracking-wide">Catégorie</th>
                  <th className="w-32 px-2 py-1.5 text-xs uppercase tracking-wide">Taux de retour %</th>
                  <th className="w-40 px-2 py-1.5 text-xs uppercase tracking-wide">Argent / 100 Nutrition</th>
                  <th className="w-24 px-2 py-1.5 text-xs uppercase tracking-wide">Focus</th>
                </tr>
              </thead>
              <tbody>
                {CRAFT_FINDER_NODE_CATEGORIES.map((category) => {
                  const rates = config.cityCategoryConfig[config.simulationCity]?.[category];
                  const itemTypes = CRAFT_FINDER_ITEM_TYPES_BY_WORKSHOP[category as CraftFinderWorkshop];
                  const isExpanded = expandedWorkshops.has(category);
                  const cityItemTypeRates = config.itemTypeReturnRates[config.simulationCity] ?? {};
                  return (
                    <Fragment key={category}>
                      <tr className="border-b border-navy-800">
                        <td className="px-2 py-1.5 text-navy-300">
                          <span className="flex items-center gap-1.5">
                            {itemTypes && (
                              <button
                                type="button"
                                onClick={() => toggleWorkshopExpanded(category)}
                                className="w-4 shrink-0 text-navy-400 hover:text-navy-100"
                                title="Détailler par type d'arme/armure"
                              >
                                {isExpanded ? "▾" : "▸"}
                              </button>
                            )}
                            {CRAFT_FINDER_CATEGORY_LABELS_FR[category]}
                          </span>
                        </td>
                        <td className="px-2 py-1.5">
                          <input
                            type="number"
                            min={0}
                            max={100}
                            step={0.1}
                            value={Math.round((rates?.returnRate ?? 0) * 1000) / 10}
                            onChange={(e) =>
                              updateCityCategoryValue("returnRate", category, (parseFloat(e.target.value) || 0) / 100)
                            }
                            className="w-20 rounded border border-navy-600 bg-navy-900 px-1.5 py-0.5 text-navy-100"
                          />
                        </td>
                        <td className="px-2 py-1.5">
                          <input
                            type="number"
                            min={0}
                            step={10}
                            value={rates?.stationFeeSilverPer100Nutrition ?? 0}
                            onChange={(e) =>
                              updateCityCategoryValue(
                                "stationFeeSilverPer100Nutrition",
                                category,
                                parseFloat(e.target.value) || 0,
                              )
                            }
                            className="w-24 rounded border border-navy-600 bg-navy-900 px-1.5 py-0.5 text-navy-100"
                          />
                        </td>
                        <td className="px-2 py-1.5">
                          <input
                            type="checkbox"
                            checked={config.useFocus[category]}
                            onChange={() => toggleCategoryFocus(category)}
                          />
                        </td>
                      </tr>
                      {isExpanded &&
                        itemTypes?.map((itemType) => {
                          const override = cityItemTypeRates[itemType];
                          return (
                            <tr key={`${category}-${itemType}`} className="border-b border-navy-800 bg-navy-900/40">
                              <td className="py-1 pl-8 pr-2 text-xs text-navy-400">
                                {CRAFT_FINDER_ITEM_TYPE_LABELS_FR[itemType] ?? itemType}
                              </td>
                              <td className="px-2 py-1">
                                <input
                                  type="number"
                                  min={0}
                                  max={100}
                                  step={0.1}
                                  placeholder={(Math.round((rates?.returnRate ?? 0) * 1000) / 10).toString()}
                                  value={override != null ? Math.round(override * 1000) / 10 : ""}
                                  onChange={(e) => {
                                    const raw = e.target.value;
                                    updateItemTypeReturnRate(itemType, raw === "" ? null : (parseFloat(raw) || 0) / 100);
                                  }}
                                  className="w-20 rounded border border-navy-700 bg-navy-950 px-1.5 py-0.5 text-navy-200"
                                />
                              </td>
                              <td className="px-2 py-1 text-xs text-navy-600" colSpan={2}>
                                {override != null ? "Valeur saisie" : "Hérite de l'atelier + spécialité de ville"}
                              </td>
                            </tr>
                          );
                        })}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-xs text-navy-400">
            Valeurs pour {config.simulationCity} — changez la ville de simulation ci-dessus pour éditer une
            autre ville, chacune a ses propres valeurs. Le taux de retour et l&apos;argent par 100 Nutrition se
            lisent directement en jeu (fenêtre de fabrication / survol de la station) ; le frais de station
            réel = valeur de l&apos;objet fabriqué × 0,1125 / 100 × ce taux. Cliquez sur ▸ à côté d&apos;un
            atelier pour saisir le taux de retour réel par type d&apos;arme/armure (spé, bonus du jour, Focus
            inclus — le seul moyen de capturer leur effet, non calculé automatiquement) ; laissez vide pour
            revenir au taux de l&apos;atelier + bonus de spécialité de ville automatique.
          </p>
        </details>

        <div className="mt-4 flex items-center gap-3">
          <button
            type="button"
            onClick={saveSettings}
            disabled={!isSignedIn || saving}
            title={!isSignedIn ? "Connectez-vous avec Discord pour enregistrer les paramètres" : undefined}
            className="rounded border border-navy-600 px-4 py-2 text-sm text-navy-200 hover:bg-navy-700 disabled:opacity-50"
          >
            {saving ? "Enregistrement…" : "Enregistrer les paramètres"}
          </button>
          {!isSignedIn && (
            <button
              type="button"
              onClick={signInWithDiscord}
              className="rounded bg-[#5865F2] px-4 py-2 text-sm text-white hover:bg-[#4752C4]"
            >
              Se connecter avec Discord
            </button>
          )}
          <button
            type="button"
            onClick={fetchPrices}
            disabled={pricesLoading}
            className="rounded bg-gold-500 px-3 py-1.5 text-sm font-medium text-navy-950 hover:bg-gold-400 disabled:opacity-50"
          >
            {pricesLoading ? "Chargement…" : "Rafraîchir les prix"}
          </button>
        </div>
      </section>

      {selectedItem && selectedRecipe ? (
        <MakeOrBuyTree
          item={selectedItem}
          recipe={selectedRecipe}
          ctx={ctx}
          nameOf={nameOf}
          outputPriceOf={outputPriceOf}
          netSellRateOf={netSellRateOf}
          memo={selectedMemo}
          onManualPriceChange={onManualPriceChange}
          manualPrices={config.manualPrices}
          priceMode={config.priceMode}
          onClose={() => setConfig((c) => ({ ...c, selectedUniqueName: null }))}
        />
      ) : (
        <p className="text-sm text-navy-400">
          Cliquez sur « Voir l&apos;arbre » dans le classement pour explorer la chaîne de fabrication d&apos;un
          objet.
        </p>
      )}

      <RankingTable rows={rankedRows} nameOf={nameOf} config={config} onOpenTree={openTree} />
    </main>
  );
}
