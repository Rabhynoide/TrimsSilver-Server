"use client";

import { useEffect, useMemo, useState } from "react";
import type { CatalogItem } from "../market-prices/types";
import { findFlips, type RawOrder } from "./calc";
import { defaultFlipperConfig, REGION_SERVER_ID, salesTaxRateFor, type FlipperConfig } from "./types";
import { signInWithDiscord } from "./actions";
import FlipResultsTable from "./FlipResultsTable";

const REGIONS: FlipperConfig["region"][] = ["Americas", "Asia", "Europe"];

export default function FlipperApp({ isSignedIn }: { isSignedIn: boolean }) {
  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
  const [orders, setOrders] = useState<RawOrder[]>([]);
  const [config, setConfig] = useState<FlipperConfig>(defaultFlipperConfig());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/market/items")
      .then((res) => res.json())
      .then((data) => setCatalog(data.items ?? []))
      .catch(() => setCatalog([]));
  }, []);

  async function fetchOrders() {
    if (!isSignedIn) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/flipper/orders");
      if (!res.ok) {
        setError(`Request failed (${res.status})`);
        setOrders([]);
        return;
      }
      const data = await res.json();
      setOrders(data.orders ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error");
      setOrders([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetchOrders guards itself on isSignedIn
    fetchOrders();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSignedIn]);

  const serverId = REGION_SERVER_ID[config.region];
  const ordersForServer = useMemo(() => orders.filter((o) => o.serverId === serverId), [orders, serverId]);

  const flips = useMemo(() => {
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

  if (!isSignedIn) {
    return (
      <main className="flex flex-1 flex-col gap-6 p-8 w-full">
        <h1 className="text-2xl font-semibold text-navy-100">Flipper</h1>
        <div className="max-w-2xl rounded-lg border border-navy-700 bg-navy-850 p-6">
          <p className="text-sm text-navy-300">
            The Flipper finds instant-profit flips — buy from a sell order in one market, sell straight
            into a buy order elsewhere (Black Market or another royal city) — computed entirely from your
            own scanned market data. Sign in with Discord, then scan markets in-game with the TrimsSilver
            desktop client to start seeing flips here.
          </p>
          <button
            type="button"
            onClick={signInWithDiscord}
            className="mt-4 rounded bg-[#5865F2] px-4 py-2 text-sm text-white hover:bg-[#4752C4]"
          >
            Se connecter avec Discord
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="flex flex-1 flex-col gap-6 p-8 w-full">
      <h1 className="text-2xl font-semibold text-navy-100">Flipper</h1>

      {error && (
        <p className="rounded border border-red-800 bg-red-950/40 px-3 py-2 text-sm text-red-300">
          Failed to load your scanned orders: {error}
        </p>
      )}

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
          <label className="flex flex-col gap-1 text-sm text-navy-300">
            Min total profit
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
          fee, a flip only ever fulfills existing orders, never places new ones. {ordersForServer.length}{" "}
          scanned order{ordersForServer.length === 1 ? "" : "s"} loaded for {config.region}.
        </p>
        <div className="mt-4">
          <button
            type="button"
            onClick={fetchOrders}
            disabled={loading}
            className="rounded bg-gold-500 px-3 py-1.5 text-sm font-medium text-navy-950 hover:bg-gold-400 disabled:opacity-50"
          >
            {loading ? "Loading…" : "Refresh Orders"}
          </button>
        </div>
      </section>

      <FlipResultsTable flips={flips} catalog={catalog} />
    </main>
  );
}
