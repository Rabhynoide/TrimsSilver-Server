"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CITIES } from "../market-prices/types";
import type { CatalogItem, PriceRow } from "../market-prices/types";
import { readJsonResponse } from "@/lib/http";
import { craftItemId, type CraftItem } from "../crafting/calc";
import {
  CRAFT_FINDER_NODE_CATEGORIES,
  CRAFT_FINDER_CATEGORY_LABELS_FR,
  type CraftFinderNodeCategory,
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
} from "./types";
import { signInWithDiscord } from "./actions";
import RankingTable from "./RankingTable";
import MakeOrBuyTree from "./MakeOrBuyTree";

const PRICE_MODE_LABELS: Record<PriceMode, string> = {
  current: "AODP Actuel",
  average: "AODP Moyen",
  manual: "Manuel",
};

export default function CraftFinderApp({ isSignedIn }: { isSignedIn: boolean }) {
  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
  const [equipment, setEquipment] = useState<CraftItem[]>([]);
  const [resources, setResources] = useState<ResourceRecipe[]>([]);
  const [config, setConfig] = useState<CraftFinderConfig>(defaultCraftFinderConfig());
  const [prices, setPrices] = useState<PriceRow[]>([]);
  const [pricesLoading, setPricesLoading] = useState(false);
  const [pricesError, setPricesError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

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

  // Both the buy side and the sell side compare all 8 cities and take
  // whichever is best (cheapest to buy, priciest to sell) — see types.ts:
  // only crafting/refining fees stay tied to the selected simulation city,
  // and this feature's own scope deliberately doesn't model transport cost
  // between the buy/sell/craft cities. Quality is always 1 — Craft Finder's
  // own scope, per the user.
  function bestAcrossCities(marketId: string, pick: (a: PriceRow, b: PriceRow) => PriceRow): MarketSnapshot {
    if (config.priceMode === "manual") {
      const manual = config.manualPrices[marketId];
      return { price: manual ?? null, priceAge: null, avgAmount: null };
    }
    const rows = (priceRowsById.get(marketId) ?? []).filter((r) => r.quality === 1 && r.sellPriceMin > 0);
    if (rows.length === 0) return { price: null, priceAge: null, avgAmount: null };
    const best = rows.reduce(pick);
    const price = config.priceMode === "average" ? best.avgPrice ?? null : best.sellPriceMin;
    return { price, priceAge: best.sellPriceMinDate, avgAmount: best.avgAmount ?? null };
  }

  const marketOf = useMemo(() => {
    return (marketId: string): MarketSnapshot =>
      bestAcrossCities(marketId, (a, b) => (a.sellPriceMin <= b.sellPriceMin ? a : b));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [priceRowsById, config.priceMode, config.manualPrices]);

  const outputPriceOf = useMemo(() => {
    return (uniqueName: string, enchant: number): MarketSnapshot =>
      bestAcrossCities(craftItemId(uniqueName, enchant), (a, b) => (a.sellPriceMin >= b.sellPriceMin ? a : b));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [priceRowsById, config.priceMode, config.manualPrices]);

  function netSellRateOf(gross: number): number {
    return gross * (1 - salesTaxRateFor(config.premium) - setupFeeRateFor(config.premium));
  }

  // Return Rate and the station's Nutrition-fee rate both come from the
  // currently selected simulation city's row in cityCategoryConfig — the
  // one config table this feature has that genuinely varies by city (see
  // types.ts).
  const ctx: EvalContext = useMemo(() => {
    const cityRates = config.cityCategoryConfig[config.simulationCity];
    return {
      resourceByUniqueName,
      marketOf,
      returnRateFor: (category) => cityRates?.[category]?.returnRate ?? 0,
      nutritionFeeRateFor: (category) => cityRates?.[category]?.stationFeeSilverPer100Nutrition ?? 0,
      useFocusFor: (category) => config.useFocus[category] ?? true,
      minSaleRatePerDay: config.minSaleRatePerDay,
      maxDepth: 8,
    };
  }, [resourceByUniqueName, marketOf, config.cityCategoryConfig, config.simulationCity, config.useFocus, config.minSaleRatePerDay]);

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

  function toggleCategoryFocus(category: CraftFinderNodeCategory) {
    setConfig((c) => ({ ...c, useFocus: { ...c.useFocus, [category]: !c.useFocus[category] } }));
  }

  const priceModes: PriceMode[] = ["current", "average", "manual"];

  return (
    <main className="flex flex-1 flex-col gap-6 p-8 w-full">
      <h1 className="text-2xl font-semibold text-navy-100">Quoi fabriquer pour gagner de l&apos;argent</h1>
      <p className="text-sm text-navy-400">
        Classement des équipements les plus rentables à fabriquer, ressource par ressource jusqu&apos;à la
        matière première — filtré par volume de vente réel pour écarter les prix peu fiables. Serveur Europe
        uniquement.
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
          {(setupFeeRateFor(config.premium) * 100).toFixed(2)}% (selon le statut Premium), appliqués au
          meilleur prix de vente parmi les 8 villes. L&apos;achat des matières compare aussi les 8 villes.
          Transport et profondeur du carnet d&apos;ordres non modélisés (v1) — voir le taux de vente pour le
          signal de liquidité. &quot;Volume max/jour&quot; = 25% des ventes/jour (règle empirique pour éviter
          de saturer vos propres annonces et repayer les frais de placement à chaque re-listing) ; &quot;Gain
          estimé/jour&quot; = marge unitaire × ce volume.
        </p>

        <details className="mt-4">
          <summary className="cursor-pointer text-sm font-medium text-navy-300">
            Taux de retour / frais de station / Focus par atelier — {config.simulationCity}
          </summary>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[640px] table-fixed border-collapse text-sm">
              <thead>
                <tr className="divide-x divide-navy-700 bg-navy-850 text-navy-300">
                  <th className="w-56 px-2 py-1.5 text-left text-xs uppercase tracking-wide">Atelier</th>
                  <th className="w-32 px-2 py-1.5 text-xs uppercase tracking-wide">Taux de retour %</th>
                  <th className="w-40 px-2 py-1.5 text-xs uppercase tracking-wide">Argent / 100 Nutrition</th>
                  <th className="w-24 px-2 py-1.5 text-xs uppercase tracking-wide">Focus</th>
                </tr>
              </thead>
              <tbody>
                {CRAFT_FINDER_NODE_CATEGORIES.map((category) => {
                  const rates = config.cityCategoryConfig[config.simulationCity]?.[category];
                  return (
                    <tr key={category} className="border-b border-navy-800">
                      <td className="px-2 py-1.5 text-navy-300">{CRAFT_FINDER_CATEGORY_LABELS_FR[category]}</td>
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
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-xs text-navy-400">
            Valeurs pour {config.simulationCity} — changez la ville de simulation ci-dessus pour éditer une
            autre ville, chacune a ses propres valeurs. Le taux de retour et l&apos;argent par 100 Nutrition se
            lisent directement en jeu (fenêtre de fabrication / survol de la station) ; le frais de station
            réel = valeur de l&apos;objet fabriqué × 0,1125 / 100 × ce taux.
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
