import type { PriceRow } from "@/app/market-prices/types";
import { readJsonResponse } from "./http";

// /api/market/prices' own hard cap on how many items one request can price
// (see MAX_ITEMS in that route) — kept in sync manually since it's enforced
// server-side, not exported from there.
const MAX_ITEMS_PER_REQUEST = 100;
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
// transparently splits `items` into ≤100-item chunks (that route's own
// MAX_ITEMS cap) with a short gap between requests, and retries a 429 a
// few times with backoff before giving up. A single feature's item set can
// grow past 100 (Journals prices its whole ~580-item catalog at once) and,
// even below that, several features can refresh around the same time — both
// can trip rate limiting; this is where that protection lives so it applies
// uniformly instead of being reimplemented (or forgotten) per feature.
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
