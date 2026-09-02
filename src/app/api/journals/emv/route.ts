import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireFullAccess } from "@/lib/access";

const MAX_ITEMS = 200;

// The signed-in user's own most recent per-item EMV (Estimated Market Value),
// one of the desktop client's 7 private ingest payload types
// (ItemEstimatedMarketValue) — offered as an extra "My EMV" price mode
// alongside the public AODP proxy. Journals and their reward materials/fill
// resources are all quality 1 (same as Farming's own EMV usage — see
// /api/farming/emv, which this mirrors exactly), so no quality param is
// needed. Ownership-scoped: only ever reads the caller's own submittedById
// rows, never another user's.
export async function GET(request: Request) {
  const access = await requireFullAccess();
  if (!access.ok) return access.response;
  const { session } = access;

  const { searchParams } = new URL(request.url);
  const serverIdParam = searchParams.get("serverId");
  const itemsParam = searchParams.get("items");

  const serverId = serverIdParam ? parseInt(serverIdParam, 10) : NaN;
  if (Number.isNaN(serverId)) {
    return NextResponse.json({ error: "serverId is required" }, { status: 400 });
  }

  const items = (itemsParam ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, MAX_ITEMS);
  if (items.length === 0) {
    return NextResponse.json({ error: "items is required" }, { status: 400 });
  }

  const rows = await prisma.itemEstimatedMarketValue.findMany({
    where: {
      submittedById: session.user.id,
      serverId,
      quality: 1,
      itemUniqueName: { in: items },
    },
    orderBy: { day: "desc" },
  });

  const latestByItem = new Map<string, (typeof rows)[number]>();
  for (const row of rows) {
    if (!latestByItem.has(row.itemUniqueName)) {
      latestByItem.set(row.itemUniqueName, row);
    }
  }

  const emv = Array.from(latestByItem.values()).map((row) => ({
    itemUniqueName: row.itemUniqueName,
    day: row.day,
    emv: Number(row.emv),
    blackMarketEmv: row.blackMarketEmv != null ? Number(row.blackMarketEmv) : null,
  }));

  return NextResponse.json({ emv });
}
