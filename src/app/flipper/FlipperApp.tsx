"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CITIES, itemId } from "../market-prices/types";
import type { CatalogItem, PriceRow } from "../market-prices/types";
import { fetchMarketPrices } from "@/lib/marketPricesClient";
import ItemPicker from "../market-prices/ItemPicker";
import { findFlips, findPublicFlips, type RawOrder } from "./calc";
import { defaultFlipperConfig, REGION_SERVER_ID, salesTaxRateFor, type FlipperConfig } from "./types";
import { REGION_LABELS_FR } from "@/lib/aodp";
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
        setOrdersError(`Échec de la requête (${res.status})`);
        setOrders([]);
        return;
      }
      const data = await res.json();
      setOrders(data.orders ?? []);
    } catch (err) {
      setOrdersError(err instanceof Error ? err.message : "Erreur réseau");
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
      const results = await fetchMarketPrices({
        items,
        locations: [...CITIES],
        qualities: "1,2,3,4,5",
        region: config.region,
      });
      setPublicPrices(results);
    } catch (err) {
      setPublicPricesError(err instanceof Error ? err.message : "Erreur réseau");
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
        Flips à profit instantané — achetez sur un ordre de vente dans un marché, revendez directement sur un
        ordre d&apos;achat ailleurs (Black Market ou une autre ville royale) — à partir de vos propres données de
        marché scannées et/ou des prix publics AODP.
      </p>

      <section className="rounded-lg border border-navy-700 bg-navy-850 p-4">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-navy-400">Paramètres</h2>
        <div className="flex flex-wrap items-end gap-4">
          <label className="flex flex-col gap-1 text-sm text-navy-300">
            Région
            <select
              value={config.region}
              onChange={(e) => setConfig((c) => ({ ...c, region: e.target.value as FlipperConfig["region"] }))}
              className="rounded border border-navy-600 bg-navy-900 px-2 py-1 text-navy-100"
            >
              {REGIONS.map((r) => (
                <option key={r} value={r}>
                  {REGION_LABELS_FR[r]}
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
            Profit total minimum (privé)
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
            Afficher les flips Black Market
          </label>
          <label className="flex items-center gap-2 text-sm text-navy-300">
            <input
              type="checkbox"
              checked={config.showCityToCityFlips}
              onChange={(e) => setConfig((c) => ({ ...c, showCityToCityFlips: e.target.checked }))}
            />
            Afficher les flips ville à ville
          </label>
        </div>
        <p className="mt-3 text-xs text-navy-400">
          Taxe de vente {(salesTaxRateFor(config.premium) * 100).toFixed(2)}% (selon le statut Premium) — pas
          de frais de placement, un flip ne fait qu&apos;honorer des ordres existants, il n&apos;en place jamais de
          nouveaux.
        </p>
      </section>

      <section className="rounded-lg border border-navy-700 bg-navy-850 p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-navy-400">
            Flips privés — vos propres ordres scannés
          </h2>
          <label className="flex items-center gap-2 text-sm text-navy-300">
            <input
              type="checkbox"
              checked={config.showPrivateFlips}
              onChange={(e) => setConfig((c) => ({ ...c, showPrivateFlips: e.target.checked }))}
            />
            Afficher
          </label>
        </div>

        {!isSignedIn ? (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-navy-300">
              Connectez-vous avec Discord et scannez les marchés en jeu avec le client de bureau TrimsSilver
              pour voir ici les flips issus de vos propres données privées.
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
                Âge max ordre de vente (min)
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
                Âge max ordre d&apos;achat (min)
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
                {ordersLoading ? "Chargement…" : "Rafraîchir les ordres"}
              </button>
              <span className="text-xs text-navy-400">
                {ordersForServer.length} ordre{ordersForServer.length === 1 ? "" : "s"} scanné
                {ordersForServer.length === 1 ? "" : "s"} chargé{ordersForServer.length === 1 ? "" : "s"} pour{" "}
                {REGION_LABELS_FR[config.region]}
              </span>
            </div>
            {ordersError && (
              <p className="rounded border border-red-800 bg-red-950/40 px-3 py-2 text-sm text-red-300">
                Échec du chargement de vos ordres scannés : {ordersError}
              </p>
            )}
            <FlipResultsTable flips={privateFlips} catalog={catalog} />
          </div>
        ) : null}
      </section>

      <section className="rounded-lg border border-navy-700 bg-navy-850 p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-navy-400">
            Flips publics — prix AODP (aucun scan nécessaire)
          </h2>
          <label className="flex items-center gap-2 text-sm text-navy-300">
            <input
              type="checkbox"
              checked={config.showPublicFlips}
              onChange={(e) => setConfig((c) => ({ ...c, showPublicFlips: e.target.checked }))}
            />
            Afficher
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
                Âge max des prix (heures)
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
                {publicPricesLoading ? "Chargement…" : "Rafraîchir les prix publics"}
              </button>
            </div>
            {publicPricesError && (
              <p className="rounded border border-red-800 bg-red-950/40 px-3 py-2 text-sm text-red-300">
                Échec du chargement des prix publics : {publicPricesError}
              </p>
            )}
            <PublicFlipResultsTable flips={publicFlips} selectedItems={config.selectedItems} />
          </div>
        )}
      </section>
    </main>
  );
}
