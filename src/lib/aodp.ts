// Live read-only proxy to the Albion Online Data Project's public stats API.
// No auth, no rate-limit token needed. Region subdomains match the client's
// AlbionServers.cs serverId convention (1=Americas/2=Asia/3=Europe).
//
// AODP's own documented constraints (https://www.albion-online-data.com/api/):
// - URLs are capped at 4096 characters. Item lists are batched dynamically
//   against this (see chunkItemsByUrlLength below) rather than a guessed
//   item count — journal/equipment ids vary a lot in length (7 to 33+
//   chars), so a fixed "N items per request" number can't give a real
//   correctness guarantee the way computing the actual URL length can.
// - Rate limit: 180 requests/minute, 300 requests/5 minutes. This whole
//   server process shares one outbound IP across every feature and every
//   concurrent user, so the limiter below is a single shared, module-scope
//   gate (safety margins under the documented ceilings) that every AODP call
//   in this file goes through — not something scoped per request or per
//   feature, since the quota itself isn't scoped that way either.

export const AODP_REGIONS = ["Americas", "Asia", "Europe"] as const;
export type AodpRegion = (typeof AODP_REGIONS)[number];

const REGION_SUBDOMAIN: Record<AodpRegion, string> = {
  Americas: "west",
  Asia: "east",
  Europe: "europe",
};

// Display-only French labels — AodpRegion itself stays in English since it's
// a stored/serialized config value (JournalsConfig["region"] etc.), not just
// UI text.
export const REGION_LABELS_FR: Record<AodpRegion, string> = {
  Americas: "Amériques",
  Asia: "Asie",
  Europe: "Europe",
};

export function isAodpRegion(value: string): value is AodpRegion {
  return (AODP_REGIONS as readonly string[]).includes(value);
}

export type AodpPriceRow = {
  item_id: string;
  city: string;
  quality: number;
  sell_price_min: number;
  sell_price_min_date: string;
  sell_price_max: number;
  sell_price_max_date: string;
  buy_price_min: number;
  buy_price_min_date: string;
  buy_price_max: number;
  buy_price_max_date: string;
};

type AodpHistoryBucket = {
  item_count: number;
  avg_price: number;
  timestamp: string;
};

type AodpHistoryRow = {
  location: string;
  item_id: string;
  quality: number;
  data: AodpHistoryBucket[];
};

function baseUrl(region: AodpRegion): string {
  return `https://${REGION_SUBDOMAIN[region]}.albion-online-data.com/api/v2/stats`;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// A safety margin under AODP's documented 4096-char limit, to leave room for
// URL-encoding quirks and avoid shaving things right up to the edge.
const AODP_MAX_URL_LENGTH = 4000;

// Packs `items` into the fewest groups whose comma-joined length fits under
// AODP's URL limit once `overheadLength` (the rest of the URL: host/path +
// query params) is added back. Item ids never need percent-encoding
// (uppercase letters/digits/underscores only — see the `_FULL`/`@N`/`_LEVELN`
// conventions used throughout this codebase), so raw string length is
// exactly what ends up in the URL.
function chunkItemsByUrlLength(items: string[], overheadLength: number): string[][] {
  const budget = AODP_MAX_URL_LENGTH - overheadLength;
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

// Safety margins under AODP's documented ceilings (180/min, 300/5min) —
// shared, module-scope state since this is a single long-running server
// process (Docker/Portainer), not a serverless environment with many
// short-lived instances, so an in-memory sliding window is a valid and
// appropriately-scoped choice here (same pattern as the module-scope
// in-memory item catalog cache elsewhere in this codebase).
const RATE_LIMIT_WINDOWS = [
  { windowMs: 60_000, maxRequests: 150 },
  { windowMs: 5 * 60_000, maxRequests: 250 },
] as const;

const requestTimestamps: number[] = [];

// Blocks until issuing another AODP request won't push either window over
// its budget. Every call site in this file goes through this before
// fetching, so concurrent traffic from different features/users (all
// sharing this one process's IP) can't collectively trip AODP's limit even
// though no single one of them "sees" the others' requests directly.
async function waitForRateLimitSlot(): Promise<void> {
  for (;;) {
    const now = Date.now();
    while (requestTimestamps.length > 0 && now - requestTimestamps[0] > 5 * 60_000) {
      requestTimestamps.shift();
    }
    const waits = RATE_LIMIT_WINDOWS.map(({ windowMs, maxRequests }) => {
      const inWindow = requestTimestamps.filter((t) => now - t <= windowMs);
      if (inWindow.length < maxRequests) return 0;
      return windowMs - (now - inWindow[0]);
    });
    const waitMs = Math.max(0, ...waits);
    if (waitMs === 0) {
      requestTimestamps.push(now);
      return;
    }
    await sleep(Math.min(waitMs, 5000));
  }
}

const RATE_LIMIT_RETRIES = 3;
const RATE_LIMIT_BACKOFF_MS = 2000;

// Every outbound AODP request goes through here: rate-limit-gated, and a
// 429 (should the shared budget above still somehow get exceeded, or AODP
// throttles for its own independent reasons) gets a few retries with
// increasing backoff before giving up.
async function fetchAodp(url: URL): Promise<Response> {
  for (let attempt = 0; attempt <= RATE_LIMIT_RETRIES; attempt++) {
    await waitForRateLimitSlot();
    const res = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(15_000) });
    if (res.status === 429 && attempt < RATE_LIMIT_RETRIES) {
      await sleep(RATE_LIMIT_BACKOFF_MS * (attempt + 1));
      continue;
    }
    return res;
  }
  throw new Error("AODP rate limit retries exhausted");
}

export async function fetchCurrentPrices(
  region: AodpRegion,
  items: string[],
  locations: string[],
  qualities: number[],
): Promise<AodpPriceRow[]> {
  const base = `${baseUrl(region)}/prices/`;
  const overhead = base.length + `?locations=${locations.join(",")}&qualities=${qualities.join(",")}`.length;
  const batches = chunkItemsByUrlLength(items, overhead);

  const results: AodpPriceRow[] = [];
  for (const batch of batches) {
    const url = new URL(`${base}${batch.map(encodeURIComponent).join(",")}`);
    url.searchParams.set("locations", locations.join(","));
    url.searchParams.set("qualities", qualities.join(","));

    const res = await fetchAodp(url);
    if (!res.ok) {
      throw new Error(`AODP prices request failed: ${res.status} ${res.statusText}`);
    }
    results.push(...((await res.json()) as AodpPriceRow[]));
  }
  return results;
}

export type AverageEntry = { avgPrice: number; avgAmount: number };

// Averages avg_price (and item_count, as "average amount traded") across
// whatever daily buckets AODP has within the last `averageDays` days, per
// (item_id, city, quality). Buckets with no trades (item_count 0) are
// excluded from the average.
export async function fetchAveragePrices(
  region: AodpRegion,
  items: string[],
  locations: string[],
  qualities: number[],
  averageDays: number,
): Promise<Map<string, AverageEntry>> {
  const base = `${baseUrl(region)}/history/`;
  const overhead =
    base.length + `?locations=${locations.join(",")}&qualities=${qualities.join(",")}&time-scale=24`.length;
  const batches = chunkItemsByUrlLength(items, overhead);

  const cutoff = Date.now() - averageDays * 24 * 60 * 60 * 1000;
  const averages = new Map<string, AverageEntry>();

  for (const batch of batches) {
    const url = new URL(`${base}${batch.map(encodeURIComponent).join(",")}`);
    url.searchParams.set("locations", locations.join(","));
    url.searchParams.set("qualities", qualities.join(","));
    url.searchParams.set("time-scale", "24");

    const res = await fetchAodp(url);
    if (!res.ok) {
      throw new Error(`AODP history request failed: ${res.status} ${res.statusText}`);
    }
    const rows = (await res.json()) as AodpHistoryRow[];

    for (const row of rows) {
      const relevantBuckets = row.data.filter(
        (bucket) => bucket.item_count > 0 && new Date(bucket.timestamp).getTime() >= cutoff,
      );
      if (relevantBuckets.length === 0) continue;

      const priceTotal = relevantBuckets.reduce((sum, bucket) => sum + bucket.avg_price, 0);
      const amountTotal = relevantBuckets.reduce((sum, bucket) => sum + bucket.item_count, 0);
      averages.set(priceKey(row.item_id, row.location, row.quality), {
        avgPrice: Math.round(priceTotal / relevantBuckets.length),
        avgAmount: Math.round(amountTotal / relevantBuckets.length),
      });
    }
  }

  return averages;
}

export function priceKey(itemId: string, city: string, quality: number): string {
  return `${itemId}|${city}|${quality}`;
}

export type HistoryPoint = { timestamp: string; avgPrice: number; itemCount: number };

// Raw time series (not averaged down to one number) for a single item/city/
// quality, for the price history chart.
export async function fetchPriceHistorySeries(
  region: AodpRegion,
  itemId: string,
  city: string,
  quality: number,
  days: number,
): Promise<HistoryPoint[]> {
  const url = new URL(`${baseUrl(region)}/history/${encodeURIComponent(itemId)}`);
  url.searchParams.set("locations", city);
  url.searchParams.set("qualities", String(quality));
  url.searchParams.set("time-scale", "24");

  const res = await fetchAodp(url);
  if (!res.ok) {
    throw new Error(`AODP history request failed: ${res.status} ${res.statusText}`);
  }
  const rows: AodpHistoryRow[] = await res.json();
  const row = rows.find((r) => r.location === city && r.quality === quality);
  if (!row) return [];

  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  return row.data
    .filter((bucket) => bucket.item_count > 0 && new Date(bucket.timestamp).getTime() >= cutoff)
    .map((bucket) => ({
      timestamp: bucket.timestamp,
      avgPrice: bucket.avg_price,
      itemCount: bucket.item_count,
    }))
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
}
