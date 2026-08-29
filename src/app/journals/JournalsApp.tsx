"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AODP_REGIONS } from "@/lib/aodp";
import { CITIES } from "../market-prices/types";
import type { PriceRow } from "../market-prices/types";
import { readJsonResponse } from "@/lib/http";
import { journalMarketId, JOURNAL_FAMILY_ORDER } from "@/data/journal-constants";
import { evaluateJournal, type JournalRow } from "./calc";
import {
  defaultJournalsConfig,
  salesTaxRateFor,
  setupFeeRateFor,
  yieldPctFor,
  type JournalsConfig,
  type PriceType,
  type Scenario,
} from "./types";
import { signInWithDiscord } from "./actions";
import ResultsGrid from "./ResultsGrid";
import RunDetailPanel from "./RunDetailPanel";

const SCENARIO_LABELS: Record<Scenario, string> = {
  buyFullSellMats: "Buy Full, Sell Mats",
  buyEmptySellMats: "Buy Empty, Sell Mats",
  buyEmptySellFull: "Buy Empty, Sell Full",
};

const PRICE_TYPE_LABELS: Record<PriceType, string> = {
  sellOrder: "Sell Order",
  buyOrder: "Buy Order",
  average: "Average Price",
  manual: "Manual",
};

const MAX_ITEMS_PER_REQUEST = 100;

function collectPricedItems(rows: JournalRow[]): string[] {
  const names = new Set<string>();
  for (const row of rows) {
    names.add(journalMarketId(row.uniqueName, "empty"));
    names.add(journalMarketId(row.uniqueName, "full"));
    for (const entry of row.loot) {
      if ("itemName" in entry) names.add(entry.itemName);
    }
    for (const opt of row.fillOptions ?? []) names.add(opt.uniqueName);
  }
  return [...names];
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

export default function JournalsApp({ isSignedIn }: { isSignedIn: boolean }) {
  const [rows, setRows] = useState<JournalRow[]>([]);
  const [config, setConfig] = useState<JournalsConfig>(defaultJournalsConfig());
  const [prices, setPrices] = useState<PriceRow[]>([]);
  const [pricesLoading, setPricesLoading] = useState(false);
  const [pricesError, setPricesError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [selectedUniqueName, setSelectedUniqueName] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/journals/catalog")
      .then((res) => res.json())
      .then((data) => setRows(data.items ?? []))
      .catch(() => setRows([]));
  }, []);

  useEffect(() => {
    if (!isSignedIn) return;
    fetch("/api/journals/settings")
      .then((res) => res.json())
      .then((data) => {
        if (data.settings?.config) {
          setConfig((c) => ({ ...c, ...data.settings.config }));
        }
      })
      .catch(() => {});
  }, [isSignedIn]);

  async function fetchPrices() {
    if (rows.length === 0) return;
    setPricesLoading(true);
    setPricesError(null);
    try {
      const items = collectPricedItems(rows);
      const locations = [...new Set([config.buyFrom, config.sellTo])];
      const batches = chunk(items, MAX_ITEMS_PER_REQUEST);
      const results: PriceRow[] = [];
      for (const batch of batches) {
        const params = new URLSearchParams({
          items: batch.join(","),
          locations: locations.join(","),
          qualities: "1",
          region: config.region,
        });
        if (config.buyPriceType === "average" || config.sellPriceType === "average") {
          params.set("averageDays", String(config.averageDays));
        }
        const res = await fetch(`/api/market/prices?${params.toString()}`);
        const data = await readJsonResponse<{ prices?: PriceRow[]; error?: string; detail?: string }>(res);
        if (!res.ok) {
          setPricesError(data.detail ?? data.error ?? `Request failed (${res.status})`);
          setPrices([]);
          return;
        }
        results.push(...(data.prices ?? []));
      }
      setPrices(results);
    } catch (err) {
      setPricesError(err instanceof Error ? err.message : "Network error");
      setPrices([]);
    } finally {
      setPricesLoading(false);
    }
  }

  const hasAutoFetchedRef = useRef(false);
  useEffect(() => {
    if (hasAutoFetchedRef.current || rows.length === 0) return;
    hasAutoFetchedRef.current = true;
    fetchPrices();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows]);

  async function saveSettings() {
    setSaving(true);
    try {
      await fetch("/api/journals/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ config }),
      });
    } finally {
      setSaving(false);
    }
  }

  function resolvePrice(
    marketId: string,
    city: string,
    priceType: PriceType,
    manualPrices: Record<string, number>,
    priceRows: PriceRow[],
  ): number | null {
    if (priceType === "manual") return manualPrices[marketId] ?? null;
    const row = priceRows.find((p) => p.itemId === marketId && p.city === city && p.quality === 1);
    if (!row) return null;
    if (priceType === "average") return row.avgPrice;
    if (priceType === "buyOrder") return row.buyPriceMax > 0 ? row.buyPriceMax : null;
    return row.sellPriceMin > 0 ? row.sellPriceMin : null;
  }

  const buyPriceOf = useMemo(
    () => (marketId: string) =>
      resolvePrice(marketId, config.buyFrom, config.buyPriceType, config.manualPrices, prices),
    [config.buyFrom, config.buyPriceType, config.manualPrices, prices],
  );
  const sellPriceOf = useMemo(
    () => (marketId: string) =>
      resolvePrice(marketId, config.sellTo, config.sellPriceType, config.manualPrices, prices),
    [config.sellTo, config.sellPriceType, config.manualPrices, prices],
  );

  const evaluate = useMemo(() => {
    return (row: JournalRow) =>
      evaluateJournal(row, {
        scenario: config.scenario,
        amount: config.amount,
        yieldPct: yieldPctFor(row.tier, config),
        salesTaxRate: salesTaxRateFor(config.premium),
        setupFeeRate: setupFeeRateFor(config.premium),
        buySetupFeeApplies: config.buyPriceType === "buyOrder",
        sellSetupFeeApplies: config.sellPriceType === "sellOrder",
        buyPriceOf,
        sellPriceOf,
        fillChoiceFor: (r) => config.fillChoice[r.uniqueName] ?? null,
        manualFillCostFor: (r) => config.manualFillCost[r.uniqueName] ?? null,
      });
  }, [config, buyPriceOf, sellPriceOf]);

  const rowsByFamily = useMemo(() => {
    const map = new Map<string, Map<number, JournalRow>>();
    for (const family of JOURNAL_FAMILY_ORDER) map.set(family, new Map());
    for (const row of rows) {
      map.get(row.family)?.set(row.tier, row);
    }
    return map;
  }, [rows]);

  const selectedRow = rows.find((r) => r.uniqueName === selectedUniqueName) ?? null;
  const selectedResult = selectedRow ? evaluate(selectedRow) : null;

  function onFillChoiceChange(uniqueName: string, fillUniqueName: string) {
    setConfig((c) => ({ ...c, fillChoice: { ...c.fillChoice, [uniqueName]: fillUniqueName } }));
  }
  function onManualFillCostChange(uniqueName: string, value: number) {
    setConfig((c) => ({ ...c, manualFillCost: { ...c.manualFillCost, [uniqueName]: value } }));
  }
  function onManualPriceChange(marketId: string, value: number) {
    setConfig((c) => ({ ...c, manualPrices: { ...c.manualPrices, [marketId]: value } }));
  }

  const priceTypes: PriceType[] = ["sellOrder", "buyOrder", "average", "manual"];
  const scenarios: Scenario[] = ["buyFullSellMats", "buyEmptySellMats", "buyEmptySellFull"];

  return (
    <main className="flex flex-1 flex-col gap-6 p-8 w-full">
      <h1 className="text-2xl font-semibold text-navy-100">Journals Calculator</h1>

      {pricesError && (
        <p className="rounded border border-red-800 bg-red-950/40 px-3 py-2 text-sm text-red-300">
          Failed to load prices: {pricesError}
        </p>
      )}

      <section className="rounded-lg border border-navy-700 bg-navy-850 p-4">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-navy-400">Settings</h2>
        <div className="flex flex-wrap items-end gap-4">
          <label className="flex flex-col gap-1 text-sm text-navy-300">
            Scenario
            <select
              value={config.scenario}
              onChange={(e) => setConfig((c) => ({ ...c, scenario: e.target.value as Scenario }))}
              className="rounded border border-navy-600 bg-navy-900 px-2 py-1 text-navy-100"
            >
              {scenarios.map((s) => (
                <option key={s} value={s}>
                  {SCENARIO_LABELS[s]}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm text-navy-300">
            Amount of Journals
            <input
              type="number"
              min={1}
              value={config.amount}
              onChange={(e) => setConfig((c) => ({ ...c, amount: parseInt(e.target.value, 10) || 1 }))}
              className="w-24 rounded border border-navy-600 bg-navy-900 px-2 py-1 text-navy-100"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm text-navy-300">
            T2–T7 Yield %
            <input
              type="number"
              min={0}
              max={150}
              step={0.5}
              value={config.happiness}
              onChange={(e) => setConfig((c) => ({ ...c, happiness: parseFloat(e.target.value) || 0 }))}
              className="w-24 rounded border border-navy-600 bg-navy-900 px-2 py-1 text-navy-100"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm text-navy-300">
            T8 Yield %
            <input
              type="number"
              min={0}
              max={150}
              step={0.5}
              value={config.happinessT8}
              onChange={(e) => setConfig((c) => ({ ...c, happinessT8: parseFloat(e.target.value) || 0 }))}
              className="w-24 rounded border border-navy-600 bg-navy-900 px-2 py-1 text-navy-100"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm text-navy-300">
            Region
            <select
              value={config.region}
              onChange={(e) => setConfig((c) => ({ ...c, region: e.target.value as JournalsConfig["region"] }))}
              className="rounded border border-navy-600 bg-navy-900 px-2 py-1 text-navy-100"
            >
              {AODP_REGIONS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="mt-4 flex flex-wrap items-end gap-4">
          <label className="flex flex-col gap-1 text-sm text-navy-300">
            Buy Location
            <select
              value={config.buyFrom}
              onChange={(e) => setConfig((c) => ({ ...c, buyFrom: e.target.value }))}
              className="rounded border border-navy-600 bg-navy-900 px-2 py-1 text-navy-100"
            >
              {CITIES.filter((c) => c !== "Black Market").map((city) => (
                <option key={city} value={city}>
                  {city}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm text-navy-300">
            Buy Price Type
            <select
              value={config.buyPriceType}
              onChange={(e) => setConfig((c) => ({ ...c, buyPriceType: e.target.value as PriceType }))}
              className="rounded border border-navy-600 bg-navy-900 px-2 py-1 text-navy-100"
            >
              {priceTypes.map((t) => (
                <option key={t} value={t}>
                  {PRICE_TYPE_LABELS[t]}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm text-navy-300">
            Sell Location
            <select
              value={config.sellTo}
              onChange={(e) => setConfig((c) => ({ ...c, sellTo: e.target.value }))}
              className="rounded border border-navy-600 bg-navy-900 px-2 py-1 text-navy-100"
            >
              {CITIES.filter((c) => c !== "Black Market").map((city) => (
                <option key={city} value={city}>
                  {city}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm text-navy-300">
            Sell Price Type
            <select
              value={config.sellPriceType}
              onChange={(e) => setConfig((c) => ({ ...c, sellPriceType: e.target.value as PriceType }))}
              className="rounded border border-navy-600 bg-navy-900 px-2 py-1 text-navy-100"
            >
              {priceTypes.map((t) => (
                <option key={t} value={t}>
                  {PRICE_TYPE_LABELS[t]}
                </option>
              ))}
            </select>
          </label>
          {(config.buyPriceType === "average" || config.sellPriceType === "average") && (
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
          <label className="flex items-center gap-2 text-sm text-navy-300">
            <input
              type="checkbox"
              checked={config.premium}
              onChange={(e) => setConfig((c) => ({ ...c, premium: e.target.checked }))}
            />
            Premium
          </label>
        </div>

        <p className="mt-2 text-xs text-navy-400">
          Sales tax {(salesTaxRateFor(config.premium) * 100).toFixed(2)}% / Setup fee{" "}
          {(setupFeeRateFor(config.premium) * 100).toFixed(2)}% (from Premium status). Setup fee is charged
          only on the side where you place your own resting order — see &quot;Sell Order&quot; vs &quot;Buy
          Order&quot; above.
        </p>

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
            disabled={pricesLoading || rows.length === 0}
            className="rounded bg-gold-500 px-3 py-1.5 text-sm font-medium text-navy-950 hover:bg-gold-400 disabled:opacity-50"
          >
            {pricesLoading ? "Loading…" : "Refresh Prices"}
          </button>
        </div>
      </section>

      {selectedRow && selectedResult ? (
        <RunDetailPanel
          row={selectedRow}
          result={selectedResult}
          config={config}
          onFillChoiceChange={onFillChoiceChange}
          onManualFillCostChange={onManualFillCostChange}
          onManualPriceChange={onManualPriceChange}
        />
      ) : (
        <p className="text-sm text-navy-400">Click on a result in the table below to show journal run details.</p>
      )}

      <ResultsGrid
        rowsByFamily={rowsByFamily}
        evaluate={evaluate}
        selected={selectedRow}
        onSelect={(row) => setSelectedUniqueName(row.uniqueName)}
      />
    </main>
  );
}
