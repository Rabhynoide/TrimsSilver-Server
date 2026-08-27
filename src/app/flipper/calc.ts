import { resolveLocation } from "@/data/market-locations";

export type RawOrderAuctionType = "offer" | "request";

// One row from the user's own uploaded MarketOrder data (GET /api/flipper/orders),
// serialized from Prisma (BigInt fields as number — silver prices never approach
// Number.MAX_SAFE_INTEGER).
export type RawOrder = {
  orderId: string;
  itemTypeId: string;
  itemGroupTypeId: string;
  locationId: string;
  qualityLevel: number;
  enchantmentLevel: number;
  unitPriceSilver: number;
  amount: number;
  auctionType: RawOrderAuctionType;
  serverId: number;
  updatedAt: string;
};

export type FlipOpportunity = {
  itemTypeId: string;
  itemGroupTypeId: string;
  qualityLevel: number;
  enchantmentLevel: number;

  sourceLocationId: string;
  sourceCity: string | null;
  destLocationId: string;
  destCity: string | null;
  isBlackMarketFlip: boolean;

  buyOrderId: string;
  buyPrice: number;
  buyAmount: number;
  buyUpdatedAt: string;

  sellOrderId: string;
  sellPrice: number;
  sellAmount: number;
  sellUpdatedAt: string;

  quantity: number;
  netSellPrice: number;
  profitPerUnit: number;
  totalProfit: number;
  roi: number;
};

export type FlipOptions = {
  salesTaxRate: number;
  // A scanned "offer" (sell order, what you'd buy from) is trusted for
  // longer than a "request" (buy order, what you'd sell into) — matching
  // AFM's own documented windows (sell orders 180min, buy orders 45min) to
  // minimize false positives from a since-filled or since-cancelled order.
  sellOrderMaxAgeMinutes: number;
  buyOrderMaxAgeMinutes: number;
  now?: number;
};

// One item/quality/enchant "group" tracks the single best (cheapest) offer
// and single best (highest) request per location — multiple orders for the
// same item at the same location are deliberately not stacked/combined in
// V1, matching a simple one-order-fulfills-one-flip model.
type Group = {
  offersByLocation: Map<string, RawOrder>;
  requestsByLocation: Map<string, RawOrder>;
};

function groupKey(o: RawOrder): string {
  return `${o.itemTypeId}|${o.qualityLevel}|${o.enchantmentLevel}`;
}

// Compares every fresh "offer" (sell order) location against every fresh
// "request" (buy order) location for the same item/quality/enchant and
// returns every pair where buying low and selling high (net of sales tax) is
// profitable — covers both Market -> Black Market and Market -> Market
// (royal city to royal city) flips uniformly; `isBlackMarketFlip` lets the UI
// filter/label the two separately.
export function findFlips(orders: RawOrder[], opts: FlipOptions): FlipOpportunity[] {
  const now = opts.now ?? Date.now();
  const sellCutoff = now - opts.sellOrderMaxAgeMinutes * 60_000;
  const buyCutoff = now - opts.buyOrderMaxAgeMinutes * 60_000;

  const groups = new Map<string, Group>();

  for (const o of orders) {
    const t = new Date(o.updatedAt).getTime();
    if (o.auctionType === "offer" ? t < sellCutoff : t < buyCutoff) continue;

    const key = groupKey(o);
    let g = groups.get(key);
    if (!g) {
      g = { offersByLocation: new Map(), requestsByLocation: new Map() };
      groups.set(key, g);
    }

    if (o.auctionType === "offer") {
      const existing = g.offersByLocation.get(o.locationId);
      if (!existing || o.unitPriceSilver < existing.unitPriceSilver) {
        g.offersByLocation.set(o.locationId, o);
      }
    } else {
      const existing = g.requestsByLocation.get(o.locationId);
      if (!existing || o.unitPriceSilver > existing.unitPriceSilver) {
        g.requestsByLocation.set(o.locationId, o);
      }
    }
  }

  const flips: FlipOpportunity[] = [];

  for (const g of groups.values()) {
    for (const offer of g.offersByLocation.values()) {
      for (const request of g.requestsByLocation.values()) {
        if (offer.locationId === request.locationId) continue;

        const netSellPrice = request.unitPriceSilver * (1 - opts.salesTaxRate);
        const profitPerUnit = netSellPrice - offer.unitPriceSilver;
        if (profitPerUnit <= 0) continue;

        const sourceLoc = resolveLocation(offer.locationId);
        const destLoc = resolveLocation(request.locationId);
        const quantity = Math.min(offer.amount, request.amount);

        flips.push({
          itemTypeId: offer.itemTypeId,
          itemGroupTypeId: offer.itemGroupTypeId,
          qualityLevel: offer.qualityLevel,
          enchantmentLevel: offer.enchantmentLevel,

          sourceLocationId: sourceLoc.id,
          sourceCity: sourceLoc.city,
          destLocationId: destLoc.id,
          destCity: destLoc.city,
          isBlackMarketFlip: destLoc.isBlackMarket,

          buyOrderId: offer.orderId,
          buyPrice: offer.unitPriceSilver,
          buyAmount: offer.amount,
          buyUpdatedAt: offer.updatedAt,

          sellOrderId: request.orderId,
          sellPrice: request.unitPriceSilver,
          sellAmount: request.amount,
          sellUpdatedAt: request.updatedAt,

          quantity,
          netSellPrice,
          profitPerUnit,
          totalProfit: profitPerUnit * quantity,
          roi: offer.unitPriceSilver > 0 ? profitPerUnit / offer.unitPriceSilver : 0,
        });
      }
    }
  }

  return flips;
}
