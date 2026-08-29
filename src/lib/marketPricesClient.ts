import type { PriceRow } from "@/app/market-prices/types";
import { readJsonResponse } from "./http";

// /api/market/prices' own sanity ceiling on one request (see MAX_ITEMS in
// that route) — kept in sync manually since it's enforced server-side, not
// exported from there. The real AODP-facing constraints (its 4096-char URL
// limit and 180/min-300/5min rate limits) are handled server-side in
// src/lib/aodp.ts, which every request here eventually goes through — this
// chunking exists mainly to keep any single request to our own server
// reasonably sized, plus the retry below is a defense-in-depth safety net
// for whatever else could return a transient error on that hop (a proxy in
// front of the app, a network blip) rather than the primary AODP-rate-limit
// fix.
const MAX_ITEMS_PER_REQUEST = 500;
const CHUNK_DELAY_MS = 300;
const RATE_LIMIT_RETRIES = 3;
const RATE_LIMIT_BACKOFF_MS = 1500;

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export type FetchMarketPricesParams = {
  items: string[];
  locations: string[];
  qualities: string;
  region: string;
  averageDays?: number;
};

async function fetchBatch(batch: string[], params: FetchMarketPricesParams): Promise<PriceRow[]> {
  const searchParams = new URLSearchParams({
    items: batch.join(","),
    locations: params.locations.join(","),
    qualities: params.qualities,
    region: params.region,
  });
  if (params.averageDays != null) searchParams.set("averageDays", String(params.averageDays));

  for (let attempt = 0; attempt <= RATE_LIMIT_RETRIES; attempt++) {
    const res = await fetch(`/api/market/prices?${searchParams.toString()}`);
    if (res.status === 429) {
      if (attempt < RATE_LIMIT_RETRIES) {
        await sleep(RATE_LIMIT_BACKOFF_MS * (attempt + 1));
        continue;
      }
      // A 429's body isn't guaranteed to be JSON (it may come from a proxy in
      // front of the app, not our own route handler), so don't hand it to
      // readJsonResponse — throw a clear message directly instead.
      throw new Error("Rate limited by the price source after several retries — try again in a moment.");
    }
    const data = await readJsonResponse<{ prices?: PriceRow[]; error?: string; detail?: string }>(res);
    if (!res.ok) {
      throw new Error(data.detail ?? data.error ?? `Request failed (${res.status})`);
    }
    return data.prices ?? [];
  }
  throw new Error("Rate limited by the price source after several retries — try again in a moment.");
}

// Shared client-side entry point for every feature that reads live prices
// (Market Prices, Farming, Crafting, Journals, Flipper's Public Flips) —
// splits `items` into ≤500-item chunks (that route's own sanity ceiling)
// with a short gap between requests, and retries a 429 from our own server a
// few times before giving up. The AODP-specific rate limiting this was
// originally written to fix (see PROJECT_STATUS.md) now lives in
// src/lib/aodp.ts instead, so this is a secondary safety net rather than the
// primary defense — but it's still the one place every feature goes through,
// so any future protection needed at this layer only has to be added once.
export async function fetchMarketPrices(params: FetchMarketPricesParams): Promise<PriceRow[]> {
  if (params.items.length === 0) return [];
  const batches = chunk(params.items, MAX_ITEMS_PER_REQUEST);
  const results: PriceRow[] = [];
  for (let i = 0; i < batches.length; i++) {
    if (i > 0) await sleep(CHUNK_DELAY_MS);
    results.push(...(await fetchBatch(batches[i], params)));
  }
  return results;
}
