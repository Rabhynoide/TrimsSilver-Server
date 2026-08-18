"use client";

import { useEffect, useRef, useState } from "react";
import ItemPicker from "./ItemPicker";
import PriceGrid from "./PriceGrid";
import FavoritesTab from "./FavoritesTab";
import { signInWithDiscord } from "./actions";
import {
  CITIES,
  CITY_COLORS,
  defaultConfig,
  itemId,
  QUALITY_LEVELS,
} from "./types";
import type { CatalogItem, Favorite, PriceCheckerConfig, PriceRow, SelectedItem } from "./types";
import { readJsonResponse } from "@/lib/http";

type Tab = "checker" | "favorites";

export default function MarketPricesApp({ isSignedIn }: { isSignedIn: boolean }) {
  const [tab, setTab] = useState<Tab>("checker");
  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
  const [config, setConfig] = useState<PriceCheckerConfig>(defaultConfig());
  const [selectedItems, setSelectedItems] = useState<SelectedItem[]>([]);
  const [prices, setPrices] = useState<PriceRow[]>([]);
  const [pricesLoading, setPricesLoading] = useState(false);
  const [pricesError, setPricesError] = useState<string | null>(null);
  const [favorites, setFavorites] = useState<Favorite[]>([]);
  const [favoritesLoading, setFavoritesLoading] = useState(false);
  const [favoriteName, setFavoriteName] = useState("");
  const [favoriteNote, setFavoriteNote] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/market/items")
      .then((res) => res.json())
      .then((data) => setCatalog(data.items ?? []))
      .catch(() => setCatalog([]));
  }, []);

  useEffect(() => {
    if (!isSignedIn) return;
    refreshFavorites();
  }, [isSignedIn]);

  async function refreshFavorites() {
    setFavoritesLoading(true);
    try {
      const res = await fetch("/api/market/favorites");
      const data = await res.json();
      setFavorites(data.favorites ?? []);
    } finally {
      setFavoritesLoading(false);
    }
  }

  async function doFetchPrices(items: SelectedItem[], cfg: PriceCheckerConfig) {
    if (items.length === 0) {
      setPrices([]);
      return;
    }
    setPricesLoading(true);
    setPricesError(null);
    try {
      const params = new URLSearchParams({
        items: items.map(itemId).join(","),
        locations: cfg.cities.join(","),
        qualities: QUALITY_LEVELS.join(","),
        region: cfg.region,
      });
      if (cfg.showAverages) {
        params.set("averageDays", String(cfg.averageDays));
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

  function fetchPrices() {
    return doFetchPrices(selectedItems, config);
  }

  // First time the user selects anything, load prices automatically so the
  // grid isn't just empty dashes; after that it's manual via Refresh Prices,
  // so picking more items doesn't spam requests. A ref (not state) tracks
  // whether this already fired, since it shouldn't itself trigger a render.
  const hasAutoFetchedRef = useRef(false);
  useEffect(() => {
    if (hasAutoFetchedRef.current || selectedItems.length === 0) return;
    hasAutoFetchedRef.current = true;
    doFetchPrices(selectedItems, config);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedItems]);

  function reset() {
    setConfig(defaultConfig());
    setSelectedItems([]);
    setPrices([]);
  }

  function exportCsv() {
    const header = [
      "item",
      "tier",
      "enchant",
      "city",
      "quality",
      "sellPriceMin",
      "sellPriceMax",
      "buyPriceMin",
      "buyPriceMax",
      "avgPrice",
    ];
    const lines = [header.join(",")];

    for (const item of selectedItems) {
      const id = itemId(item);
      for (const row of prices.filter((p) => p.itemId === id)) {
        lines.push(
          [
            JSON.stringify(item.name),
            item.tier,
            item.enchant,
            row.city,
            row.quality,
            row.sellPriceMin,
            row.sellPriceMax,
            row.buyPriceMin,
            row.buyPriceMax,
            row.avgPrice ?? "",
          ].join(","),
        );
      }
    }

    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "market-prices.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  function toggleCity(city: string) {
    setConfig((c) => ({
      ...c,
      cities: c.cities.includes(city) ? c.cities.filter((x) => x !== city) : [...c.cities, city],
    }));
  }

  async function saveFavorite() {
    if (!favoriteName.trim() || selectedItems.length === 0) return;
    setSaving(true);
    try {
      await fetch("/api/market/favorites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: favoriteName.trim(),
          note: favoriteNote.trim() || null,
          config: { checker: config, items: selectedItems },
        }),
      });
      setFavoriteName("");
      setFavoriteNote("");
      await refreshFavorites();
    } finally {
      setSaving(false);
    }
  }

  function loadFavorite(favorite: Favorite) {
    setConfig(favorite.config.checker);
    setSelectedItems(favorite.config.items);
    setTab("checker");
  }

  async function duplicateFavorite(favorite: Favorite) {
    await fetch("/api/market/favorites", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: `${favorite.name} (copy)`,
        note: favorite.note,
        config: favorite.config,
      }),
    });
    await refreshFavorites();
  }

  async function deleteFavorite(favorite: Favorite) {
    await fetch(`/api/market/favorites/${favorite.id}`, { method: "DELETE" });
    await refreshFavorites();
  }

  return (
    <main className="flex flex-1 flex-col gap-6 p-8 w-full">
      <h1 className="text-2xl font-semibold text-navy-100">Market Prices</h1>

      <div className="flex gap-4 border-b border-navy-700">
        {(["checker", "favorites"] as Tab[]).map((t) => (
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
            {t === "checker" ? "Price Checker" : "Favorites"}
          </button>
        ))}
      </div>

      {tab === "checker" ? (
        <>
          <section className="flex flex-wrap items-end gap-4 rounded-lg border border-navy-700 bg-navy-850 p-4">
            <label className="flex flex-col gap-1 text-sm text-navy-300">
              Region
              <select
                value={config.region}
                onChange={(e) =>
                  setConfig((c) => ({ ...c, region: e.target.value as PriceCheckerConfig["region"] }))
                }
                className="rounded border border-navy-600 bg-navy-900 px-2 py-1 text-navy-100"
              >
                <option value="Europe">Europe</option>
                <option value="Americas">Americas</option>
                <option value="Asia">Asia</option>
              </select>
            </label>

            <label className="flex flex-col gap-1 text-sm text-navy-300">
              Price Type
              <select
                value={config.priceType}
                onChange={(e) =>
                  setConfig((c) => ({ ...c, priceType: e.target.value as PriceCheckerConfig["priceType"] }))
                }
                className="rounded border border-navy-600 bg-navy-900 px-2 py-1 text-navy-100"
              >
                <option value="sell">Sell Order</option>
                <option value="buy">Buy Order</option>
              </select>
            </label>

            <label className="flex flex-col gap-1 text-sm text-navy-300">
              Average Days
              <input
                type="number"
                min={1}
                max={90}
                value={config.averageDays}
                onChange={(e) =>
                  setConfig((c) => ({ ...c, averageDays: parseInt(e.target.value, 10) || 1 }))
                }
                className="w-20 rounded border border-navy-600 bg-navy-900 px-2 py-1 text-navy-100"
              />
            </label>

            <label className="flex items-center gap-2 pb-1.5 text-sm text-navy-300">
              <input
                type="checkbox"
                checked={config.showAverages}
                onChange={(e) => setConfig((c) => ({ ...c, showAverages: e.target.checked }))}
              />
              Show averages
            </label>

            <button
              type="button"
              onClick={fetchPrices}
              disabled={selectedItems.length === 0 || pricesLoading}
              className="rounded bg-gold-500 px-3 py-1.5 text-sm font-medium text-navy-950 hover:bg-gold-400 disabled:opacity-50"
            >
              Refresh Prices
            </button>
            <button
              type="button"
              onClick={reset}
              className="rounded border border-navy-600 px-3 py-1.5 text-sm text-navy-200 hover:bg-navy-700"
            >
              Reset
            </button>
            <button
              type="button"
              onClick={exportCsv}
              disabled={prices.length === 0}
              className="rounded border border-navy-600 px-3 py-1.5 text-sm text-navy-200 hover:bg-navy-700 disabled:opacity-50"
            >
              Export CSV
            </button>
          </section>

          {pricesError && (
            <p className="rounded border border-red-800 bg-red-950/40 px-3 py-2 text-sm text-red-300">
              Failed to load prices: {pricesError}
            </p>
          )}

          <fieldset className="flex flex-wrap gap-2">
            <legend className="mb-1 w-full text-xs text-navy-400">Cities</legend>
            {CITIES.map((city) => {
              const active = config.cities.includes(city);
              return (
                <button
                  key={city}
                  type="button"
                  onClick={() => toggleCity(city)}
                  style={
                    active
                      ? { backgroundColor: `${CITY_COLORS[city]}33`, borderColor: CITY_COLORS[city] }
                      : undefined
                  }
                  className={`rounded-full border px-3 py-1 text-sm ${
                    active ? "text-navy-100" : "border-navy-600 text-navy-400 hover:text-navy-200"
                  }`}
                >
                  {city}
                </button>
              );
            })}
          </fieldset>

          <ItemPicker catalog={catalog} selectedItems={selectedItems} onChange={setSelectedItems} />

          <section className="flex flex-wrap items-end gap-2">
            <h2 className="w-full text-sm font-semibold uppercase tracking-wide text-navy-400">
              Save Favorite
            </h2>
            <input
              type="text"
              placeholder="Favorite Name"
              value={favoriteName}
              onChange={(e) => setFavoriteName(e.target.value)}
              className="rounded border border-navy-600 bg-navy-900 px-3 py-1.5 text-sm text-navy-100 placeholder:text-navy-500"
            />
            <input
              type="text"
              placeholder="Note (optional)"
              value={favoriteNote}
              onChange={(e) => setFavoriteNote(e.target.value)}
              className="rounded border border-navy-600 bg-navy-900 px-3 py-1.5 text-sm text-navy-100 placeholder:text-navy-500"
            />
            <button
              type="button"
              onClick={saveFavorite}
              disabled={!isSignedIn || saving || !favoriteName.trim() || selectedItems.length === 0}
              title={!isSignedIn ? "Sign in with Discord to save favorites" : undefined}
              className="rounded border border-navy-600 px-3 py-1.5 text-sm text-navy-200 hover:bg-navy-700 disabled:opacity-50"
            >
              Save Favorite
            </button>
          </section>

          <section>
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-navy-400">
              Prices
            </h2>
            <PriceGrid
              selectedItems={selectedItems}
              prices={prices}
              config={config}
              loading={pricesLoading}
            />
          </section>
        </>
      ) : (
        <FavoritesTab
          isSignedIn={isSignedIn}
          favorites={favorites}
          loading={favoritesLoading}
          onLoad={loadFavorite}
          onDuplicate={duplicateFavorite}
          onDelete={deleteFavorite}
          onSignIn={signInWithDiscord}
        />
      )}
    </main>
  );
}
