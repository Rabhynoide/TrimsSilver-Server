import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiUser } from "@/lib/api-auth";

// PlayerCount / old "playercount" endpoint. Append-only time series, one row per observation.
export async function POST(request: NextRequest) {
  const auth = await requireApiUser(request);
  if (!auth.user) return auth.response;

  const body = await request.json().catch(() => null);
  const serverId = body?.server?.id;
  const locationId = body?.location?.id;
  const dateTime = body?.dateTime;
  const isBz = body?.isBz;
  const nonFlaggedCount = body?.nonFlaggedCount;
  const flaggedCount = body?.flaggedCount;

  if (
    typeof serverId !== "number" ||
    typeof locationId !== "string" ||
    typeof dateTime !== "string" ||
    typeof isBz !== "boolean"
  ) {
    return NextResponse.json(
      { error: "server.id, location.id, dateTime and isBz are required" },
      { status: 400 }
    );
  }

  const observedAt = new Date(dateTime);
  if (Number.isNaN(observedAt.getTime())) {
    return NextResponse.json({ error: "Invalid dateTime" }, { status: 400 });
  }

  await prisma.playerCount.create({
    data: {
      serverId,
      locationId,
      observedAt,
      nonFlaggedCount: typeof nonFlaggedCount === "number" ? nonFlaggedCount : null,
      flaggedCount: typeof flaggedCount === "number" ? flaggedCount : null,
      isBz,
      submittedById: auth.user.id,
    },
  });

  return NextResponse.json({ ok: true });
}
