import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

// Only ever the signed-in user's own scanned MarketOrder rows (server issue:
// Public Flips / cross-uploader aggregation via contributeToPublic is
// deliberately deferred, see PROJECT_STATUS.md) — flip matching itself runs
// client-side in calc.ts against this raw list, same "fetch once, recompute
// locally on every settings change" shape as Farming/Crafting's catalog.
//
// Capped to orders touched in the last 24h: flip freshness windows top out
// around a few hours (AFM's own convention: sell orders 180min, buy orders
// 45min) and MarketOrder is an upsert-as-current-state table that otherwise
// accumulates every order ever scanned, including ones long since filled or
// expired in-game and never rescanned.
const MAX_ORDER_AGE_MS = 24 * 60 * 60 * 1000;

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const orders = await prisma.marketOrder.findMany({
    where: {
      uploaderId: session.user.id,
      updatedAt: { gte: new Date(Date.now() - MAX_ORDER_AGE_MS) },
    },
    orderBy: { updatedAt: "desc" },
  });

  return NextResponse.json({
    orders: orders.map((o) => ({
      orderId: o.orderId.toString(),
      itemTypeId: o.itemTypeId,
      itemGroupTypeId: o.itemGroupTypeId,
      locationId: o.locationId,
      qualityLevel: o.qualityLevel,
      enchantmentLevel: o.enchantmentLevel,
      unitPriceSilver: Number(o.unitPriceSilver),
      amount: o.amount,
      auctionType: o.auctionType,
      serverId: o.serverId,
      updatedAt: o.updatedAt.toISOString(),
    })),
  });
}
