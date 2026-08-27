"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CITIES, itemId } from "../market-prices/types";
import type { CatalogItem, PriceRow } from "../market-prices/types";
import { readJsonResponse } from "@/lib/http";
import ItemPicker from "../market-prices/ItemPicker";
import { findFlips, findPublicFlips, type RawOrder } from "./calc";
import { defaultFlipperConfig, REGION_SERVER_ID, salesTaxRateFor, type FlipperConfig } from "./types";
import { signInWithDiscord } from "./actions";
import FlipResultsTable from "./FlipResultsTable";
import PublicFlipResultsTable from "./PublicFlipResultsTable";

const REGIONS: FlipperConfig["region"][] = ["Americas", "Asia", "Europe"];

export default function FlipperApp({ isSignedIn }: { isSignedIn: boolean }) {
  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
  const [orders, setOrders] = useState<RawOrder[]>([]);
  const [config, setConfig] = useState<FlipperConfig>(defaultFlipperConfig());
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [ordersError, setOrdersError] = useState<string | null>(null);
  const [publicPrices, setPublicPrices] = useState<PriceRow[]>([]);
  const [publicPricesLoading, setPublicPricesLoading] = useState(false);
  const [publicPricesError, setPublicPricesError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/market/items")
      .then((res) => res.json())
      .then((data) => setCatalog(data.items ?? []))
      .catch(() => setCatalog([]));
  }, []);

  async function fetchOrders() {
    if (!isSignedIn) return;
    setOrdersLoading(true);
    setOrdersError(null);
    try {
      const res = await fetch("/api/flipper/orders");
      if (!res.ok) {
        setOrdersError(`Request failed (${res.status})`);
        setOrders([]);
        return;
      }
      const data = await res.json();
      setOrders(data.orders ?? []);
    } catch (err) {
      setOrdersError(err instanceof Error ? err.message : "Network error");
      setOrders([]);
    } finally {
      setOrdersLoading(false);
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetchOrders guards itself on isSignedIn
    fetchOrders();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSignedIn]);

  async function fetchPublicPrices() {
    if (config.selectedItems.length === 0) {
      setPublicPrices([]);
      return;
    }
    setPublicPricesLoading(true);
    setPublicPricesError(null);
    try {
      const items = [...new Set(config.selectedItems.map(itemId))];
      const params = new URLSearchParams({
        items: items.join(","),
        locations: CITIES.join(","),
        qualities: "1,2,3,4,5",
        region: config.region,
      });
      const res = await fetch(`/api/market/prices?${params.toString()}`);
      const data = await readJsonResponse<{ prices?: PriceRow[]; error?: string; detail?: string }>(res);
      if (!res.ok) {
        setPublicPricesError(data.detail ?? data.error ?? `Request failed (${res.status})`);
        setPublicPrices([]);
        return;
      }
      setPublicPrices(data.prices ?? []);
    } catch (err) {
      setPublicPricesError(err instanceof Error ? err.message : "Network error");
      setPublicPrices([]);
    } finally {
      setPublicPricesLoading(false);
    }
  }

  // Auto-fetch the first time items are selected, manual (Refresh Public
  // Prices) after that — same convention as Market Prices' own Price Checker.
  const hasAutoFetchedRef = useRef(false);
  useEffect(() => {
    if (hasAutoFetchedRef.current || config.selectedItems.length === 0) return;
    hasAutoFetchedRef.current = true;
    fetchPublicPrices();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config.selectedItems]);

  const serverId = REGION_SERVER_ID[config.region];
  const ordersForServer = useMemo(() => orders.filter((o) => o.serverId === serverId), [orders, serverId]);

  const privateFlips = useMemo(() => {
    const all = findFlips(ordersForServer, {
      salesTaxRate: salesTaxRateFor(config.premium),
      sellOrderMaxAgeMinutes: config.sellOrderMaxAgeMinutes,
      buyOrderMaxAgeMinutes: config.buyOrderMaxAgeMinutes,
    });
    return all.filter((f) => {
      if (f.isBlackMarketFlip && !config.showBlackMarketFlips) return false;
      if (!f.isBlackMarketFlip && !config.showCityToCityFlips) return false;
      if (f.totalProfit < config.minTotalProfit) return false;
      return true;
    });
  }, [ordersForServer, config]);

  const publicFlips = useMemo(() => {
    const all = findPublicFlips(publicPrices, {
      salesTaxRate: salesTaxRateFor(config.premium),
      maxPriceAgeHours: config.publicPriceMaxAgeHours,
    });
    return all.filter((f) => {
      if (f.isBlackMarketFlip && !config.showBlackMarketFlips) return false;
      if (!f.isBlackMarketFlip && !config.showCityToCityFlips) return false;
      return true;
    });
  }, [publicPrices, config.premium, config.publicPriceMaxAgeHours, config.showBlackMarketFlips, config.showCityToCityFlips]);

  return (
    <main className="flex flex-1 flex-col gap-6 p-8 w-full">
      <h1 className="text-2xl font-semibold text-navy-100">Flipper</h1>
      <p className="text-sm text-navy-400">
        Instant-profit flips — buy from a sell order in one market, sell straight into a buy order elsewhere
        (Black Market or another royal city) — from your own scanned market data and/or public AODP prices.
      </p>

      <section className="rounded-lg border border-navy-700 bg-navy-850 p-4">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-navy-400">Settings</h2>
        <div className="flex flex-wrap items-end gap-4">
          <label className="flex flex-col gap-1 text-sm text-navy-300">
            Region
            <select
              value={config.region}
              onChange={(e) => setConfig((c) => ({ ...c, region: e.target.value as FlipperConfig["region"] }))}
              className="rounded border border-navy-600 bg-navy-900 px-2 py-1 text-navy-100"
            >
              {REGIONS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-2 text-sm text-navy-300">
            <input
              type="checkbox"
              checked={config.premium}
              onChange={(e) => setConfig((c) => ({ ...c, premium: e.target.checked }))}
            />
            Premium
          </label>
          <label className="flex flex-col gap-1 text-sm text-navy-300">
            Min total profit (private)
            <input
              type="number"
              min={0}
              value={config.minTotalProfit}
              onChange={(e) => setConfig((c) => ({ ...c, minTotalProfit: parseInt(e.target.value, 10) || 0 }))}
              className="w-28 rounded border border-navy-600 bg-navy-900 px-2 py-1 text-navy-100"
            />
          </label>
        </div>
        <div className="mt-4 flex flex-wrap items-end gap-4">
          <label className="flex items-center gap-2 text-sm text-navy-300">
            <input
              type="checkbox"
              checked={config.showBlackMarketFlips}
              onChange={(e) => setConfig((c) => ({ ...c, showBlackMarketFlips: e.target.checked }))}
            />
            Show Black Market flips
          </label>
          <label className="flex items-center gap-2 text-sm text-navy-300">
            <input
              type="checkbox"
              checked={config.showCityToCityFlips}
              onChange={(e) => setConfig((c) => ({ ...c, showCityToCityFlips: e.target.checked }))}
            />
            Show city-to-city flips
          </label>
        </div>
        <p className="mt-3 text-xs text-navy-400">
          Sales tax {(salesTaxRateFor(config.premium) * 100).toFixed(2)}% (from Premium status) — no setup
          fee, a flip only ever fulfills existing orders, never places new ones.
        </p>
      </section>

      <section className="rounded-lg border border-navy-700 bg-navy-850 p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-navy-400">
            Private Flips — your own scanned orders
          </h2>
          <label className="flex items-center gap-2 text-sm text-navy-300">
            <input
              type="checkbox"
              checked={config.showPrivateFlips}
              onChange={(e) => setConfig((c) => ({ ...c, showPrivateFlips: e.target.checked }))}
            />
            Show
          </label>
        </div>

        {!isSignedIn ? (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-navy-300">
              Sign in with Discord and scan markets in-game with the TrimsSilver desktop client to see flips
              from your own private data here.
            </p>
            <button
              type="button"
              onClick={signInWithDiscord}
              className="w-fit rounded bg-[#5865F2] px-4 py-2 text-sm text-white hover:bg-[#4752C4]"
            >
              Se connecter avec Discord
            </button>
          </div>
        ) : config.showPrivateFlips ? (
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-end gap-4">
              <label className="flex flex-col gap-1 text-sm text-navy-300">
                Sell order max age (min)
                <input
                  type="number"
                  min={1}
                  max={1440}
                  value={config.sellOrderMaxAgeMinutes}
                  onChange={(e) =>
                    setConfig((c) => ({ ...c, sellOrderMaxAgeMinutes: parseInt(e.target.value, 10) || 1 }))
                  }
                  className="w-24 rounded border border-navy-600 bg-navy-900 px-2 py-1 text-navy-100"
                />
              </label>
              <label className="flex flex-col gap-1 text-sm text-navy-300">
                Buy order max age (min)
                <input
                  type="number"
                  min={1}
                  max={1440}
                  value={config.buyOrderMaxAgeMinutes}
                  onChange={(e) =>
                    setConfig((c) => ({ ...c, buyOrderMaxAgeMinutes: parseInt(e.target.value, 10) || 1 }))
                  }
                  className="w-24 rounded border border-navy-600 bg-navy-900 px-2 py-1 text-navy-100"
                />
              </label>
              <button
                type="button"
                onClick={fetchOrders}
                disabled={ordersLoading}
                className="rounded bg-gold-500 px-3 py-1.5 text-sm font-medium text-navy-950 hover:bg-gold-400 disabled:opacity-50"
              >
                {ordersLoading ? "Loading…" : "Refresh Orders"}
              </button>
              <span className="text-xs text-navy-400">
                {ordersForServer.length} scanned order{ordersForServer.length === 1 ? "" : "s"} loaded for{" "}
                {config.region}
              </span>
            </div>
            {ordersError && (
              <p className="rounded border border-red-800 bg-red-950/40 px-3 py-2 text-sm text-red-300">
                Failed to load your scanned orders: {ordersError}
              </p>
            )}
            <FlipResultsTable flips={privateFlips} catalog={catalog} />
          </div>
        ) : null}
      </section>

      <section className="rounded-lg border border-navy-700 bg-navy-850 p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-navy-400">
            Public Flips — AODP prices (no scanning needed)
          </h2>
          <label className="flex items-center gap-2 text-sm text-navy-300">
            <input
              type="checkbox"
              checked={config.showPublicFlips}
              onChange={(e) => setConfig((c) => ({ ...c, showPublicFlips: e.target.checked }))}
            />
            Show
          </label>
        </div>

        {config.showPublicFlips && (
          <div className="flex flex-col gap-4">
            <ItemPicker
              catalog={catalog}
              selectedItems={config.selectedItems}
              onChange={(items) => setConfig((c) => ({ ...c, selectedItems: items }))}
            />

            <div className="flex flex-wrap items-end gap-4">
              <label className="flex flex-col gap-1 text-sm text-navy-300">
                Max price age (hours)
                <input
                  type="number"
                  min={1}
                  max={720}
                  value={config.publicPriceMaxAgeHours}
                  onChange={(e) =>
                    setConfig((c) => ({ ...c, publicPriceMaxAgeHours: parseInt(e.target.value, 10) || 1 }))
                  }
                  className="w-24 rounded border border-navy-600 bg-navy-900 px-2 py-1 text-navy-100"
                />
              </label>
              <button
                type="button"
                onClick={fetchPublicPrices}
                disabled={publicPricesLoading || config.selectedItems.length === 0}
                className="rounded bg-gold-500 px-3 py-1.5 text-sm font-medium text-navy-950 hover:bg-gold-400 disabled:opacity-50"
              >
                {publicPricesLoading ? "Loading…" : "Refresh Public Prices"}
              </button>
            </div>
            {publicPricesError && (
              <p className="rounded border border-red-800 bg-red-950/40 px-3 py-2 text-sm text-red-300">
                Failed to load public prices: {publicPricesError}
              </p>
            )}
            <PublicFlipResultsTable flips={publicFlips} selectedItems={config.selectedItems} />
          </div>
        )}
      </section>
    </main>
  );
}
