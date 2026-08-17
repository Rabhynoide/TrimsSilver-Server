import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiUser } from "@/lib/api-auth";

interface EmvItemPayload {
  itemUniqueName: string;
  emv: number;
  blackMarketEmv: number | null;
  quality: number;
  day: Date;
}

function parseItem(item: unknown): EmvItemPayload | null {
  const i = item as {
    itemUniqueName?: unknown;
    emv?: unknown;
    blackMarketEmv?: unknown;
    quality?: unknown;
    day?: unknown;
  };
  if (typeof i?.itemUniqueName !== "string" || typeof i?.emv !== "number" || typeof i?.quality !== "number") {
    return null;
  }
  const day = new Date(i.day as string);
  if (Number.isNaN(day.getTime())) {
    return null;
  }
  return {
    itemUniqueName: i.itemUniqueName,
    emv: i.emv,
    blackMarketEmv: typeof i.blackMarketEmv === "number" ? i.blackMarketEmv : null,
    quality: i.quality,
    day,
  };
}

// ItemEstimatedMarketValueUpload / old "itemEstimatedMarketValues" endpoint.
// Upserts per (serverId, itemUniqueName, quality, day) as clients report EMVs.
export async function POST(request: NextRequest) {
  const auth = await requireApiUser(request);
  if (!auth.user) return auth.response;

  const body = await request.json().catch(() => null);
  const serverId = body?.serverId;
  const rawItems = body?.items;

  if (typeof serverId !== "number" || !Array.isArray(rawItems) || rawItems.length === 0) {
    return NextResponse.json(
      { error: "serverId and a non-empty items[] are required" },
      { status: 400 }
    );
  }

  const items: EmvItemPayload[] = [];
  for (const rawItem of rawItems) {
    const parsed = parseItem(rawItem);
    if (!parsed) {
      return NextResponse.json(
        { error: "Each item needs itemUniqueName, emv, quality and day" },
        { status: 400 }
      );
    }
    items.push(parsed);
  }

  await prisma.$transaction(
    items.map((item) => {
      const data = {
        emv: BigInt(Math.trunc(item.emv)),
        blackMarketEmv: item.blackMarketEmv !== null ? BigInt(Math.trunc(item.blackMarketEmv)) : null,
        submittedById: auth.user.id,
      };

      return prisma.itemEstimatedMarketValue.upsert({
        where: {
          serverId_itemUniqueName_quality_day: {
            serverId,
            itemUniqueName: item.itemUniqueName,
            quality: item.quality,
            day: item.day,
          },
        },
        create: {
          serverId,
          itemUniqueName: item.itemUniqueName,
          quality: item.quality,
          day: item.day,
          ...data,
        },
        update: data,
      });
    })
  );

  return NextResponse.json({ ok: true, count: items.length });
}
