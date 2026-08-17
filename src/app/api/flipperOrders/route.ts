import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiUser } from "@/lib/api-auth";
import { AuctionType } from "@/generated/prisma/client";

const AUCTION_TYPES = new Set<string>(Object.values(AuctionType));

interface MarketOrderPayload {
  id: number;
  itemTypeId: string;
  itemGroupTypeId: string;
  locationId: string;
  qualityLevel: number;
  enchantmentLevel: number;
  unitPriceSilver: number;
  amount: number;
  auctionType: string;
  expires: string;
}

function isValidOrder(order: unknown): order is MarketOrderPayload {
  const o = order as Partial<MarketOrderPayload>;
  return (
    typeof o?.id === "number" &&
    typeof o?.itemTypeId === "string" &&
    typeof o?.itemGroupTypeId === "string" &&
    typeof o?.locationId === "string" &&
    typeof o?.qualityLevel === "number" &&
    typeof o?.enchantmentLevel === "number" &&
    typeof o?.unitPriceSilver === "number" &&
    typeof o?.amount === "number" &&
    typeof o?.auctionType === "string" &&
    AUCTION_TYPES.has(o.auctionType) &&
    typeof o?.expires === "string"
  );
}

// TrimsSilverMarketUpload / old "flipperOrders" endpoint. Client-supplied uploaderId is
// ignored — the uploader is the authenticated bearer-token owner, not a client claim.
export async function POST(request: NextRequest) {
  const auth = await requireApiUser(request);
  if (!auth.user) return auth.response;

  const body = await request.json().catch(() => null);
  const serverId = body?.serverId;
  const orders = body?.orders;

  if (typeof serverId !== "number" || !Array.isArray(orders) || !orders.every(isValidOrder)) {
    return NextResponse.json({ error: "serverId and a valid orders[] are required" }, { status: 400 });
  }

  const contributeToPublic = request.nextUrl.searchParams.get("contributeToPublic") === "true";
  const shareWithFriends = request.nextUrl.searchParams.get("shareWithFriends") === "true";

  await prisma.$transaction(
    (orders as MarketOrderPayload[]).map((order) => {
      const data = {
        itemTypeId: order.itemTypeId,
        itemGroupTypeId: order.itemGroupTypeId,
        locationId: order.locationId,
        qualityLevel: order.qualityLevel,
        enchantmentLevel: order.enchantmentLevel,
        unitPriceSilver: BigInt(Math.trunc(order.unitPriceSilver)),
        amount: order.amount,
        auctionType: order.auctionType as AuctionType,
        expires: order.expires,
        contributeToPublic,
        shareWithFriends,
        uploaderId: auth.user.id,
      };

      return prisma.marketOrder.upsert({
        where: { serverId_orderId: { serverId, orderId: BigInt(Math.trunc(order.id)) } },
        create: { orderId: BigInt(Math.trunc(order.id)), serverId, ...data },
        update: data,
      });
    })
  );

  return NextResponse.json({ ok: true, count: orders.length });
}
