import type { PriceRow } from "@/app/market-prices/types";
import { readJsonResponse } from "./http";

// The real constraint here isn't AODP's own limits (those are handled
// server-side in src/lib/aodp.ts) — it's the reverse proxy in front of the
// live site. Confirmed live in production: a long `items=` query string
// (Journals can need ~500 items, ~10KB+ of URL) doesn't get a clean 4xx from
// it, it kills the connection outright (nginx logs status 000 plus Lua
// errors — "using uninitialized 'ctx_ref'/'is_whitelisted'/'reason' variable
// while logging request" — and increments its anti-abuse "bad behavior"
// counter each time, which could eventually get a legitimate user's IP
// throttled). So chunking is sized by actual URL length against a
// conservative budget, not a guessed item count — this protects against
// whatever the proxy's real limit turns out to be, the same reasoning as
// aodp.ts's chunkItemsByUrlLength for AODP's documented 4096-char limit.
const MAX_URL_LENGTH = 2000;
const CHUNK_DELAY_MS = 300;
const RATE_LIMIT_RETRIES = 3;
const RATE_LIMIT_BACKOFF_MS = 1500;

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

function buildSearchParams(items: string[], params: FetchMarketPricesParams): URLSearchParams {
  const searchParams = new URLSearchParams({
    items: items.join(","),
    locations: params.locations.join(","),
    qualities: params.qualities,
    region: params.region,
  });
  if (params.averageDays != null) searchParams.set("averageDays", String(params.averageDays));
  return searchParams;
}

// Packs `items` into the fewest groups whose full request URL (this route's
// path + every other param, all present in every chunk) stays under
// MAX_URL_LENGTH. Computes the fixed overhead once (from an empty item list)
// rather than assuming a flat per-item average, so it stays correct no
// matter which items are involved — item ids vary a lot in length (7 to 33+
// chars for the longest journal/equipment ids).
function chunkItemsByUrlLength(items: string[], params: FetchMarketPricesParams): string[][] {
  const overhead = `/api/market/prices?${buildSearchParams([], params).toString()}`.length;
  const budget = MAX_URL_LENGTH - overhead;

  const batches: string[][] = [];
  let current: string[] = [];
  let currentLength = 0;

  for (const item of items) {
    const addedLength = item.length + (current.length > 0 ? 1 : 0); // +1 for the joining comma
    if (current.length > 0 && currentLength + addedLength > budget) {
      batches.push(current);
      current = [];
      currentLength = 0;
    }
    current.push(item);
    currentLength += item.length + (current.length > 1 ? 1 : 0);
  }
  if (current.length > 0) batches.push(current);
  return batches;
}

async function fetchBatch(batch: string[], params: FetchMarketPricesParams): Promise<PriceRow[]> {
  const searchParams = buildSearchParams(batch, params);

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
      throw new Error("Limite de requêtes atteinte auprès de la source de prix après plusieurs tentatives — réessayez dans un instant.");
    }
    const data = await readJsonResponse<{ prices?: PriceRow[]; error?: string; detail?: string }>(res);
    if (!res.ok) {
      throw new Error(data.detail ?? data.error ?? `Échec de la requête (${res.status})`);
    }
    return data.prices ?? [];
  }
  throw new Error("Rate limited by the price source after several retries — try again in a moment.");
}

// Shared client-side entry point for every feature that reads live prices
// (Market Prices, Farming, Crafting, Journals, Flipper's Public Flips) —
// splits `items` into chunks sized by actual URL length (see
// chunkItemsByUrlLength above) with a short gap between requests, and
// retries a 429 from our own server a few times before giving up.
export async function fetchMarketPrices(params: FetchMarketPricesParams): Promise<PriceRow[]> {
  if (params.items.length === 0) return [];
  const batches = chunkItemsByUrlLength(params.items, params);
  const results: PriceRow[] = [];
  for (let i = 0; i < batches.length; i++) {
    if (i > 0) await sleep(CHUNK_DELAY_MS);
    results.push(...(await fetchBatch(batches[i], params)));
  }
  return results;
}
