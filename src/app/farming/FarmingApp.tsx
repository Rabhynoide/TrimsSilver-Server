"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CITIES } from "../market-prices/types";
import type { PriceRow } from "../market-prices/types";
import { readJsonResponse } from "@/lib/http";
import type { FoodItem, FarmingRecipe, FarmingSpecDef } from "./calc";
import { isAnimalRecipe, isPlantRecipe } from "./calc";
import {
  defaultFarmingConfig,
  REGION_SERVER_ID,
  salesTaxRateFor,
  setupFeeRateFor,
  type FarmingConfig,
  type SpecCharacter,
} from "./types";
import { signInWithDiscord } from "./actions";
import SettingsPanel from "./SettingsPanel";
import ResultsTable from "./ResultsTable";

type Tab = "settings" | "results";

type Catalog = { recipes: FarmingRecipe[]; foods: FoodItem[]; specs: FarmingSpecDef[] };

function ageHours(dateStr: string): number | null {
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime()) || date.getTime() === 0) return null;
  const hours = (Date.now() - date.getTime()) / (1000 * 60 * 60);
  return hours >= 0 ? hours : null;
}

function collectPricedItems(catalog: Catalog): string[] {
  const names = new Set<string>();
  for (const recipe of catalog.recipes) {
    if (isPlantRecipe(recipe)) {
      names.add(recipe.seedUniqueName);
      names.add(recipe.outputUniqueName);
      for (const bonus of recipe.bonusLoot) names.add(bonus.uniqueName);
    } else if (isAnimalRecipe(recipe)) {
      names.add(recipe.babyUniqueName);
      names.add(recipe.grownUniqueName);
      if (recipe.product) names.add(recipe.product.outputUniqueName);
    }
  }
  for (const food of catalog.foods) names.add(food.uniqueName);
  return [...names];
}

export default function FarmingApp({ isSignedIn }: { isSignedIn: boolean }) {
  const [tab, setTab] = useState<Tab>("settings");
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [config, setConfig] = useState<FarmingConfig>(defaultFarmingConfig());
  const [characters, setCharacters] = useState<SpecCharacter[]>([]);
  const [prices, setPrices] = useState<PriceRow[]>([]);
  const [pricesLoading, setPricesLoading] = useState(false);
  const [pricesError, setPricesError] = useState<string | null>(null);
  const [emv, setEmv] = useState<Map<string, number>>(new Map());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/farming/recipes")
      .then((res) => res.json())
      .then((data) => setCatalog({ recipes: data.recipes ?? [], foods: data.foods ?? [], specs: data.specs ?? [] }))
      .catch(() => setCatalog({ recipes: [], foods: [], specs: [] }));
  }, []);

  useEffect(() => {
    if (!isSignedIn) return;
    refreshSpecs();
    fetch("/api/farming/settings")
      .then((res) => res.json())
      .then((data) => {
        if (data.settings?.config) {
          setConfig((c) => ({ ...c, ...data.settings.config }));
        }
      })
      .catch(() => {});
  }, [isSignedIn]);

  async function refreshSpecs() {
    const res = await fetch("/api/farming/specs");
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

  async function fetchPrices() {
    if (!catalog || catalog.recipes.length === 0) return;
    setPricesLoading(true);
    setPricesError(null);
    try {
      const items = collectPricedItems(catalog);
      const locations = [...new Set([config.buyFrom, config.sellTo])];
      const params = new URLSearchParams({
        items: items.join(","),
        locations: locations.join(","),
        qualities: "1",
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

  async function fetchEmv() {
    if (!isSignedIn || !catalog) return;
    const items = collectPricedItems(catalog);
    const params = new URLSearchParams({
      items: items.join(","),
      serverId: String(REGION_SERVER_ID[config.region]),
    });
    const res = await fetch(`/api/farming/emv?${params.toString()}`);
    if (!res.ok) return;
    const data = await res.json();
    setEmv(new Map((data.emv ?? []).map((row: { itemUniqueName: string; emv: number }) => [row.itemUniqueName, row.emv])));
  }

  // Auto-fetch once the catalog is ready, so Results isn't just empty dashes;
  // after that it's manual via Refresh, same pattern as Market Prices' Price
  // Checker (see MarketPricesApp.tsx's hasAutoFetchedRef).
  const hasAutoFetchedRef = useRef(false);
  useEffect(() => {
    if (hasAutoFetchedRef.current || !catalog || catalog.recipes.length === 0) return;
    hasAutoFetchedRef.current = true;
    fetchPrices();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [catalog]);

  useEffect(() => {
    if (config.priceMode !== "emv") return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- price-mode-driven refetch; fetchEmv guards itself on isSignedIn/catalog
    fetchEmv();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config.priceMode, config.region]);

  async function saveSettings() {
    setSaving(true);
    try {
      await fetch("/api/farming/settings", {
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
      if (config.priceMode === "emv") return emv.get(uniqueName) ?? null;
      const row = prices.find(
        (p) => p.itemId === uniqueName && p.city === config.buyFrom && p.quality === 1,
      );
      if (!row) return null;
      if (config.priceMode === "average") return row.avgPrice;
      return row.sellPriceMin > 0 ? row.sellPriceMin : null;
    };
  }, [config, prices, emv]);

  const sellPriceOf = useMemo(() => {
    return (uniqueName: string): number | null => {
      let raw: number | null;
      if (config.priceMode === "manual") {
        raw = config.manualPrices[uniqueName] ?? null;
      } else if (config.priceMode === "emv") {
        raw = emv.get(uniqueName) ?? null;
      } else {
        const row = prices.find(
          (p) => p.itemId === uniqueName && p.city === config.sellTo && p.quality === 1,
        );
        raw = !row ? null : config.priceMode === "average" ? row.avgPrice : row.sellPriceMin > 0 ? row.sellPriceMin : null;
      }
      if (raw == null) return null;
      return raw * (1 - salesTaxRateFor(config.premium) - setupFeeRateFor(config.premium));
    };
  }, [config, prices, emv]);

  // Hours since the price was last updated — only meaningful in "current"
  // mode (a single live quote with its own timestamp); averages, manual
  // entries and EMV have no equivalent single "age", so those return null and
  // simply don't show a staleness badge.
  const buyPriceAgeOf = useMemo(() => {
    return (uniqueName: string): number | null => {
      if (config.priceMode !== "current") return null;
      const row = prices.find(
        (p) => p.itemId === uniqueName && p.city === config.buyFrom && p.quality === 1,
      );
      if (!row || row.sellPriceMin <= 0) return null;
      return ageHours(row.sellPriceMinDate);
    };
  }, [config.priceMode, config.buyFrom, prices]);

  const sellPriceAgeOf = useMemo(() => {
    return (uniqueName: string): number | null => {
      if (config.priceMode !== "current") return null;
      const row = prices.find(
        (p) => p.itemId === uniqueName && p.city === config.sellTo && p.quality === 1,
      );
      if (!row || row.sellPriceMin <= 0) return null;
      return ageHours(row.sellPriceMinDate);
    };
  }, [config.priceMode, config.sellTo, prices]);

  return (
    <main className="flex flex-1 flex-col gap-6 p-8 w-full">
      <h1 className="text-2xl font-semibold text-navy-100">Farming &amp; Breeding Calculator</h1>

      <div className="flex gap-4 border-b border-navy-700">
        {(["settings", "results"] as Tab[]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`px-3 py-2 text-sm ${
              tab === t
                ? "border-b-2 border-gold-500 font-semibold text-gold-400"
                : "text-navy-300 hover:text-navy-100"
            }`}
          >
            {t === "settings" ? "Settings" : "Results"}
          </button>
        ))}
      </div>

      {pricesError && (
        <p className="rounded border border-red-800 bg-red-950/40 px-3 py-2 text-sm text-red-300">
          Failed to load prices: {pricesError}
        </p>
      )}

      {tab === "settings" ? (
        <SettingsPanel
          config={config}
          onChange={setConfig}
          isSignedIn={isSignedIn}
          characters={characters}
          specs={catalog?.specs ?? []}
          recipes={catalog?.recipes ?? []}
          onSelectCharacter={applyCharacterSpecs}
          onRefreshSpecs={refreshSpecs}
          onSave={saveSettings}
          saving={saving}
          onSignIn={signInWithDiscord}
          cities={CITIES}
        />
      ) : (
        <ResultsTable
          recipes={catalog?.recipes ?? []}
          specs={catalog?.specs ?? []}
          config={config}
          onChange={setConfig}
          buyPriceOf={buyPriceOf}
          sellPriceOf={sellPriceOf}
          buyPriceAgeOf={buyPriceAgeOf}
          sellPriceAgeOf={sellPriceAgeOf}
          foods={catalog?.foods ?? []}
          loading={pricesLoading}
          onRefresh={fetchPrices}
        />
      )}
    </main>
  );
}
