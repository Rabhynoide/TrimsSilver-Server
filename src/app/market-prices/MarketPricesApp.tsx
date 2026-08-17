"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import ItemPicker from "./ItemPicker";
import PriceGrid from "./PriceGrid";
import FavoritesTab from "./FavoritesTab";
import { signInWithDiscord } from "./actions";
import {
  CITIES,
  defaultConfig,
  itemId,
  QUALITY_LEVELS,
} from "./types";
import type { CatalogItem, Favorite, PriceCheckerConfig, PriceRow, SelectedItem } from "./types";

type Tab = "checker" | "favorites";

export default function MarketPricesApp({ isSignedIn }: { isSignedIn: boolean }) {
  const [tab, setTab] = useState<Tab>("checker");
  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
  const [config, setConfig] = useState<PriceCheckerConfig>(defaultConfig());
  const [selectedItems, setSelectedItems] = useState<SelectedItem[]>([]);
  const [prices, setPrices] = useState<PriceRow[]>([]);
  const [pricesLoading, setPricesLoading] = useState(false);
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

  async function fetchPrices() {
    if (selectedItems.length === 0) {
      setPrices([]);
      return;
    }
    setPricesLoading(true);
    try {
      const params = new URLSearchParams({
        items: selectedItems.map(itemId).join(","),
        locations: config.cities.join(","),
        qualities: QUALITY_LEVELS.join(","),
        region: config.region,
      });
      if (config.showAverages) {
        params.set("averageDays", String(config.averageDays));
      }
      const res = await fetch(`/api/market/prices?${params.toString()}`);
      const data = await res.json();
      setPrices(data.prices ?? []);
    } finally {
      setPricesLoading(false);
    }
  }

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
    <main className="flex flex-1 flex-col gap-6 p-8 max-w-6xl mx-auto w-full">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Market Prices</h1>
        <Link href="/" className="text-sm text-neutral-400 hover:text-neutral-100">
          ← TrimsSilver
        </Link>
      </div>

      <div className="flex gap-4 border-b border-neutral-800">
        {(["checker", "favorites"] as Tab[]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`px-3 py-2 text-sm ${
              tab === t
                ? "border-b-2 border-neutral-100 font-semibold"
                : "text-neutral-400 hover:text-neutral-200"
            }`}
          >
            {t === "checker" ? "Price Checker" : "Favorites"}
          </button>
        ))}
      </div>

      {tab === "checker" ? (
        <>
          <section className="flex flex-wrap items-end gap-4">
            <label className="flex flex-col gap-1 text-sm">
              Region
              <select
                value={config.region}
                onChange={(e) =>
                  setConfig((c) => ({ ...c, region: e.target.value as PriceCheckerConfig["region"] }))
                }
                className="rounded border border-neutral-700 bg-transparent px-2 py-1"
              >
                <option value="Europe">Europe</option>
                <option value="Americas">Americas</option>
                <option value="Asia">Asia</option>
              </select>
            </label>

            <label className="flex flex-col gap-1 text-sm">
              Price Type
              <select
                value={config.priceType}
                onChange={(e) =>
                  setConfig((c) => ({ ...c, priceType: e.target.value as PriceCheckerConfig["priceType"] }))
                }
                className="rounded border border-neutral-700 bg-transparent px-2 py-1"
              >
                <option value="sell">Sell Order</option>
                <option value="buy">Buy Order</option>
              </select>
            </label>

            <label className="flex flex-col gap-1 text-sm">
              Average Days
              <input
                type="number"
                min={1}
                max={90}
                value={config.averageDays}
                onChange={(e) =>
                  setConfig((c) => ({ ...c, averageDays: parseInt(e.target.value, 10) || 1 }))
                }
                className="w-20 rounded border border-neutral-700 bg-transparent px-2 py-1"
              />
            </label>

            <label className="flex items-center gap-2 text-sm pb-1.5">
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
              className="rounded bg-neutral-100 text-neutral-900 px-3 py-1.5 text-sm font-medium hover:bg-white disabled:opacity-50"
            >
              Refresh Prices
            </button>
            <button
              type="button"
              onClick={reset}
              className="rounded bg-neutral-800 px-3 py-1.5 text-sm hover:bg-neutral-700"
            >
              Reset
            </button>
            <button
              type="button"
              onClick={exportCsv}
              disabled={prices.length === 0}
              className="rounded bg-neutral-800 px-3 py-1.5 text-sm hover:bg-neutral-700 disabled:opacity-50"
            >
              Export CSV
            </button>
          </section>

          <fieldset className="flex flex-wrap gap-3">
            <legend className="text-xs text-neutral-400 mb-1">Cities</legend>
            {CITIES.map((city) => (
              <label key={city} className="flex items-center gap-1 text-sm">
                <input
                  type="checkbox"
                  checked={config.cities.includes(city)}
                  onChange={() => toggleCity(city)}
                />
                {city}
              </label>
            ))}
          </fieldset>

          <ItemPicker catalog={catalog} selectedItems={selectedItems} onChange={setSelectedItems} />

          <section className="flex flex-wrap items-end gap-2">
            <h2 className="w-full text-sm font-semibold text-neutral-400 uppercase tracking-wide">
              Save Favorite
            </h2>
            <input
              type="text"
              placeholder="Favorite Name"
              value={favoriteName}
              onChange={(e) => setFavoriteName(e.target.value)}
              className="rounded border border-neutral-700 bg-transparent px-3 py-1.5 text-sm"
            />
            <input
              type="text"
              placeholder="Note (optional)"
              value={favoriteNote}
              onChange={(e) => setFavoriteNote(e.target.value)}
              className="rounded border border-neutral-700 bg-transparent px-3 py-1.5 text-sm"
            />
            <button
              type="button"
              onClick={saveFavorite}
              disabled={!isSignedIn || saving || !favoriteName.trim() || selectedItems.length === 0}
              title={!isSignedIn ? "Sign in with Discord to save favorites" : undefined}
              className="rounded bg-neutral-800 px-3 py-1.5 text-sm hover:bg-neutral-700 disabled:opacity-50"
            >
              Save Favorite
            </button>
          </section>

          <section>
            <h2 className="text-sm font-semibold text-neutral-400 uppercase tracking-wide mb-2">
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
