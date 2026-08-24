"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AODP_REGIONS } from "@/lib/aodp";
import { CITIES } from "../market-prices/types";
import type { CatalogItem, PriceRow } from "../market-prices/types";
import { readJsonResponse } from "@/lib/http";
import { craftItemId, evaluateCraft, recipeForEnchant, type CraftItem } from "./calc";
import {
  defaultCraftingConfig,
  salesTaxRateFor,
  setupFeeRateFor,
  type CraftingConfig,
  type PriceMode,
  type SpecCharacter,
} from "./types";
import { signInWithDiscord } from "./actions";
import ItemRecipePicker from "./ItemRecipePicker";
import ResultPanel from "./ResultPanel";

const PRICE_MODE_LABELS: Record<PriceMode, string> = {
  current: "AODP Current",
  average: "AODP Average",
  manual: "Manual",
};

export default function CraftingApp({ isSignedIn }: { isSignedIn: boolean }) {
  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
  const [craftItems, setCraftItems] = useState<CraftItem[]>([]);
  const [config, setConfig] = useState<CraftingConfig>(defaultCraftingConfig());
  const [characters, setCharacters] = useState<SpecCharacter[]>([]);
  const [prices, setPrices] = useState<PriceRow[]>([]);
  const [pricesLoading, setPricesLoading] = useState(false);
  const [pricesError, setPricesError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/market/items")
      .then((res) => res.json())
      .then((data) => setCatalog(data.items ?? []))
      .catch(() => setCatalog([]));
    fetch("/api/crafting/recipes")
      .then((res) => res.json())
      .then((data) => setCraftItems(data.items ?? []))
      .catch(() => setCraftItems([]));
  }, []);

  useEffect(() => {
    if (!isSignedIn) return;
    refreshSpecs();
    fetch("/api/crafting/settings")
      .then((res) => res.json())
      .then((data) => {
        if (data.settings?.config) {
          setConfig((c) => ({ ...c, ...data.settings.config }));
        }
      })
      .catch(() => {});
  }, [isSignedIn]);

  async function refreshSpecs() {
    const res = await fetch("/api/crafting/specs");
    if (!res.ok) return;
    const data = await res.json();
    setCharacters(data.characters ?? []);
  }

  function applyCharacterSpecs(characterName: string) {
    const character = characters.find((c) => c.characterName === characterName);
    setConfig((c) => ({
      ...c,
      characterName,
      specs: character ? { ...character.specs } : c.specs,
    }));
  }

  const selectedCraftItem = useMemo(
    () => craftItems.find((i) => i.uniqueName === config.selectedUniqueName) ?? null,
    [craftItems, config.selectedUniqueName],
  );
  const selectedRecipe = selectedCraftItem
    ? recipeForEnchant(selectedCraftItem, config.selectedEnchant)
    : null;

  async function fetchPrices() {
    if (!selectedCraftItem || !selectedRecipe) return;
    setPricesLoading(true);
    setPricesError(null);
    try {
      const items = new Set<string>();
      for (const r of selectedRecipe.resources) items.add(craftItemId(r.uniqueName, selectedRecipe.enchant));
      items.add(craftItemId(selectedCraftItem.uniqueName, selectedRecipe.enchant));

      const locations = [...new Set([config.buyFrom, config.sellTo])];
      const params = new URLSearchParams({
        items: [...items].join(","),
        locations: locations.join(","),
        qualities: "1,2,3,4,5",
        region: config.region,
      });
      if (config.priceMode === "average") {
        params.set("averageDays", String(config.averageDays));
      }
      const res = await fetch(`/api/market/prices?${params.toString()}`);
      const data = await readJsonResponse<{ prices?: PriceRow[]; error?: string; detail?: string }>(res);
      if (!res.ok) {
        setPricesError(data.detail ?? data.error ?? `Request failed (${res.status})`);
        setPrices([]);
        return;
      }
      setPrices(data.prices ?? []);
    } catch (err) {
      setPricesError(err instanceof Error ? err.message : "Network error");
      setPrices([]);
    } finally {
      setPricesLoading(false);
    }
  }

  // Auto-fetch whenever the selected recipe or the market settings that
  // affect which prices are needed change — unlike Farming (one catalog-wide
  // fetch), the priced item set here changes with every selection.
  const fetchKey = `${config.selectedUniqueName}|${config.selectedEnchant}|${config.buyFrom}|${config.sellTo}|${config.region}|${config.priceMode}|${config.averageDays}`;
  const lastFetchedKeyRef = useRef<string | null>(null);
  useEffect(() => {
    if (!selectedCraftItem || !selectedRecipe) return;
    if (lastFetchedKeyRef.current === fetchKey) return;
    lastFetchedKeyRef.current = fetchKey;
    fetchPrices();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchKey, selectedCraftItem, selectedRecipe]);

  async function saveSettings() {
    setSaving(true);
    try {
      await fetch("/api/crafting/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ config }),
      });
    } finally {
      setSaving(false);
    }
  }

  const buyPriceOf = useMemo(() => {
    return (uniqueName: string): number | null => {
      if (config.priceMode === "manual") return config.manualPrices[uniqueName] ?? null;
      const row = prices.find((p) => p.itemId === uniqueName && p.city === config.buyFrom && p.quality === 1);
      if (!row) return null;
      if (config.priceMode === "average") return row.avgPrice;
      return row.sellPriceMin > 0 ? row.sellPriceMin : null;
    };
  }, [config.priceMode, config.buyFrom, config.manualPrices, prices]);

  const outputSellPriceOf = useMemo(() => {
    return (): number | null => {
      if (!selectedCraftItem || !selectedRecipe) return null;
      const id = craftItemId(selectedCraftItem.uniqueName, selectedRecipe.enchant);
      let raw: number | null;
      if (config.priceMode === "manual") {
        raw = config.manualPrices[id] ?? null;
      } else {
        const row = prices.find(
          (p) => p.itemId === id && p.city === config.sellTo && p.quality === config.outputQuality,
        );
        raw = !row ? null : config.priceMode === "average" ? row.avgPrice : row.sellPriceMin > 0 ? row.sellPriceMin : null;
      }
      if (raw == null) return null;
      return raw * (1 - salesTaxRateFor(config.premium) - setupFeeRateFor(config.premium));
    };
  }, [config.priceMode, config.sellTo, config.outputQuality, config.premium, config.manualPrices, prices, selectedCraftItem, selectedRecipe]);

  const result = useMemo(() => {
    if (!selectedRecipe) return null;
    return evaluateCraft(selectedRecipe, {
      returnRate: config.returnRate,
      stationFeeRate: config.stationFeeRate,
      batchSize: config.batchSize,
      useFocus: config.useFocus,
      buyPriceOf,
      outputSellPriceOf,
    });
  }, [selectedRecipe, config.returnRate, config.stationFeeRate, config.batchSize, config.useFocus, buyPriceOf, outputSellPriceOf]);

  function onManualPriceChange(uniqueName: string, value: number) {
    setConfig((c) => ({ ...c, manualPrices: { ...c.manualPrices, [uniqueName]: value } }));
  }

  const priceModes: PriceMode[] = ["current", "average", "manual"];
  const selectedItemName =
    catalog.find((i) => i.uniqueName === config.selectedUniqueName)?.name ?? config.selectedUniqueName ?? "";

  return (
    <main className="flex flex-1 flex-col gap-6 p-8 w-full">
      <h1 className="text-2xl font-semibold text-navy-100">Crafting Calculator</h1>

      {pricesError && (
        <p className="rounded border border-red-800 bg-red-950/40 px-3 py-2 text-sm text-red-300">
          Failed to load prices: {pricesError}
        </p>
      )}

      <ItemRecipePicker
        catalog={catalog}
        craftItems={craftItems}
        selectedUniqueName={config.selectedUniqueName}
        selectedEnchant={config.selectedEnchant}
        outputQuality={config.outputQuality}
        onSelectItem={(uniqueName) =>
          setConfig((c) => ({ ...c, selectedUniqueName: uniqueName, selectedEnchant: 0 }))
        }
        onSelectEnchant={(enchant) => setConfig((c) => ({ ...c, selectedEnchant: enchant }))}
        onSelectQuality={(quality) => setConfig((c) => ({ ...c, outputQuality: quality }))}
      />

      <section className="rounded-lg border border-navy-700 bg-navy-850 p-4">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-navy-400">Settings</h2>
        <div className="flex flex-wrap items-end gap-4">
          <label className="flex flex-col gap-1 text-sm text-navy-300">
            Region
            <select
              value={config.region}
              onChange={(e) => setConfig((c) => ({ ...c, region: e.target.value as CraftingConfig["region"] }))}
              className="rounded border border-navy-600 bg-navy-900 px-2 py-1 text-navy-100"
            >
              {AODP_REGIONS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm text-navy-300">
            Buy From
            <select
              value={config.buyFrom}
              onChange={(e) => setConfig((c) => ({ ...c, buyFrom: e.target.value }))}
              className="rounded border border-navy-600 bg-navy-900 px-2 py-1 text-navy-100"
            >
              {CITIES.map((city) => (
                <option key={city} value={city}>
                  {city}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm text-navy-300">
            Sell To
            <select
              value={config.sellTo}
              onChange={(e) => setConfig((c) => ({ ...c, sellTo: e.target.value }))}
              className="rounded border border-navy-600 bg-navy-900 px-2 py-1 text-navy-100"
            >
              {CITIES.map((city) => (
                <option key={city} value={city}>
                  {city}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm text-navy-300">
            Price Mode
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
              Average Days
              <input
                type="number"
                min={1}
                max={90}
                value={config.averageDays}
                onChange={(e) => setConfig((c) => ({ ...c, averageDays: parseInt(e.target.value, 10) || 1 }))}
                className="w-20 rounded border border-navy-600 bg-navy-900 px-2 py-1 text-navy-100"
              />
            </label>
          )}
          <label className="flex flex-col gap-1 text-sm text-navy-300">
            Batch Size
            <input
              type="number"
              min={1}
              value={config.batchSize}
              onChange={(e) => setConfig((c) => ({ ...c, batchSize: parseInt(e.target.value, 10) || 1 }))}
              className="w-20 rounded border border-navy-600 bg-navy-900 px-2 py-1 text-navy-100"
            />
          </label>
        </div>

        <div className="mt-4 flex flex-wrap items-end gap-4">
          <label className="flex items-center gap-2 text-sm text-navy-300">
            <input
              type="checkbox"
              checked={config.premium}
              onChange={(e) => setConfig((c) => ({ ...c, premium: e.target.checked }))}
            />
            Premium
          </label>
          <label className="flex items-center gap-2 text-sm text-navy-300">
            <input
              type="checkbox"
              checked={config.useFocus}
              onChange={(e) => setConfig((c) => ({ ...c, useFocus: e.target.checked }))}
            />
            Show Focus cost
          </label>
          <label className="flex flex-col gap-1 text-sm text-navy-300">
            Return Rate %
            <input
              type="number"
              min={0}
              max={100}
              step={0.1}
              value={Math.round(config.returnRate * 1000) / 10}
              onChange={(e) =>
                setConfig((c) => ({ ...c, returnRate: (parseFloat(e.target.value) || 0) / 100 }))
              }
              className="w-24 rounded border border-navy-600 bg-navy-900 px-2 py-1 text-navy-100"
            />
          </label>
          <label className="flex items-center gap-2 text-sm text-navy-300">
            <input
              type="checkbox"
              checked={config.returnRateIncludesStationBonus}
              onChange={(e) =>
                setConfig((c) => ({ ...c, returnRateIncludesStationBonus: e.target.checked }))
              }
            />
            Return Rate already includes a station bonus
          </label>
          <label className="flex flex-col gap-1 text-sm text-navy-300">
            Station Fee %
            <input
              type="number"
              min={0}
              max={100}
              step={0.1}
              value={Math.round(config.stationFeeRate * 1000) / 10}
              onChange={(e) =>
                setConfig((c) => ({ ...c, stationFeeRate: (parseFloat(e.target.value) || 0) / 100 }))
              }
              className="w-24 rounded border border-navy-600 bg-navy-900 px-2 py-1 text-navy-100"
            />
          </label>
        </div>
        <p className="mt-2 text-xs text-navy-400">
          Return Rate and Station Fee are read off your own in-game crafting window — see the Crafting
          Calculator plan for why these aren&apos;t auto-calculated. Sales tax{" "}
          {(salesTaxRateFor(config.premium) * 100).toFixed(2)}% / Setup fee{" "}
          {(setupFeeRateFor(config.premium) * 100).toFixed(2)}% (from Premium status).
        </p>

        <div className="mt-4 flex flex-wrap items-end gap-3">
          {isSignedIn ? (
            <>
              <label className="flex flex-col gap-1 text-sm text-navy-300">
                Character
                <select
                  value={config.characterName ?? ""}
                  onChange={(e) => applyCharacterSpecs(e.target.value)}
                  className="w-48 rounded border border-navy-600 bg-navy-900 px-2 py-1 text-navy-100"
                >
                  <option value="" disabled>
                    Select a character
                  </option>
                  {characters.map((c) => (
                    <option key={c.characterName} value={c.characterName}>
                      {c.characterName}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                onClick={refreshSpecs}
                className="rounded border border-navy-600 px-3 py-1.5 text-sm text-navy-200 hover:bg-navy-700"
              >
                Refresh Specs
              </button>
              {selectedCraftItem?.specAchievementId && (
                <span className="text-xs text-navy-400">
                  Your spec ({selectedCraftItem.specAchievementId}):{" "}
                  {config.specs[selectedCraftItem.specAchievementId] ?? 0}
                </span>
              )}
            </>
          ) : (
            <p className="text-xs text-navy-400">
              Sign in with Discord to auto-fill your specialization level from TrimsSilver-Client synced
              characters (display only).
            </p>
          )}
        </div>

        <div className="mt-4 flex items-center gap-3">
          <button
            type="button"
            onClick={saveSettings}
            disabled={!isSignedIn || saving}
            title={!isSignedIn ? "Sign in with Discord to save settings" : undefined}
            className="rounded border border-navy-600 px-4 py-2 text-sm text-navy-200 hover:bg-navy-700 disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save Settings"}
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
            disabled={pricesLoading || !selectedRecipe}
            className="rounded bg-gold-500 px-3 py-1.5 text-sm font-medium text-navy-950 hover:bg-gold-400 disabled:opacity-50"
          >
            {pricesLoading ? "Loading…" : "Refresh Prices"}
          </button>
        </div>
      </section>

      {result ? (
        <ResultPanel
          itemName={selectedItemName}
          result={result}
          config={config}
          onManualPriceChange={onManualPriceChange}
        />
      ) : (
        <p className="text-sm text-navy-400">Pick an item above to see its crafting profit.</p>
      )}
    </main>
  );
}
