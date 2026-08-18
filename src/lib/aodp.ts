// Live read-only proxy to the Albion Online Data Project's public stats API.
// No auth, no rate-limit token needed. Region subdomains match the client's
// AlbionServers.cs serverId convention (1=Americas/2=Asia/3=Europe).

export const AODP_REGIONS = ["Americas", "Asia", "Europe"] as const;
export type AodpRegion = (typeof AODP_REGIONS)[number];

const REGION_SUBDOMAIN: Record<AodpRegion, string> = {
  Americas: "west",
  Asia: "east",
  Europe: "europe",
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

export async function fetchCurrentPrices(
  region: AodpRegion,
  items: string[],
  locations: string[],
  qualities: number[],
): Promise<AodpPriceRow[]> {
  const url = new URL(`${baseUrl(region)}/prices/${items.map(encodeURIComponent).join(",")}`);
  url.searchParams.set("locations", locations.join(","));
  url.searchParams.set("qualities", qualities.join(","));

  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`AODP prices request failed: ${res.status} ${res.statusText}`);
  }
  return res.json();
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
  const url = new URL(`${baseUrl(region)}/history/${items.map(encodeURIComponent).join(",")}`);
  url.searchParams.set("locations", locations.join(","));
  url.searchParams.set("qualities", qualities.join(","));
  url.searchParams.set("time-scale", "24");

  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`AODP history request failed: ${res.status} ${res.statusText}`);
  }
  const rows: AodpHistoryRow[] = await res.json();

  const cutoff = Date.now() - averageDays * 24 * 60 * 60 * 1000;
  const averages = new Map<string, AverageEntry>();

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

  const res = await fetch(url, { cache: "no-store" });
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
