import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiUser } from "@/lib/api-auth";

interface FestivityEventPayload {
  kind: number;
  category: string;
  uniqueName: string;
  startTime: Date;
  endTime: Date;
}

function parseEvent(event: unknown): FestivityEventPayload | null {
  const e = event as {
    kind?: unknown;
    category?: unknown;
    uniqueName?: unknown;
    startTime?: unknown;
    endTime?: unknown;
  };
  if (typeof e?.kind !== "number" || typeof e?.category !== "string" || typeof e?.uniqueName !== "string") {
    return null;
  }
  const startTime = new Date(e.startTime as string);
  const endTime = new Date(e.endTime as string);
  if (Number.isNaN(startTime.getTime()) || Number.isNaN(endTime.getTime())) {
    return null;
  }
  return { kind: e.kind, category: e.category, uniqueName: e.uniqueName, startTime, endTime };
}

// FestivitiesUpload / old "be/festivities" endpoint.
// Replaces the event list wholesale for a server on every upload.
export async function POST(request: NextRequest) {
  const auth = await requireApiUser(request);
  if (!auth.user) return auth.response;

  const body = await request.json().catch(() => null);
  const serverId = body?.serverId;
  const rawEvents = body?.events;

  if (typeof serverId !== "number" || !Array.isArray(rawEvents)) {
    return NextResponse.json({ error: "serverId and events[] are required" }, { status: 400 });
  }

  const events: FestivityEventPayload[] = [];
  for (const rawEvent of rawEvents) {
    const parsed = parseEvent(rawEvent);
    if (!parsed) {
      return NextResponse.json(
        { error: "Each event needs kind, category, uniqueName, startTime and endTime" },
        { status: 400 }
      );
    }
    events.push(parsed);
  }

  await prisma.$transaction(async (tx) => {
    const snapshot = await tx.festivitySnapshot.upsert({
      where: { serverId },
      create: { serverId, submittedById: auth.user.id },
      update: { submittedById: auth.user.id },
    });

    await tx.festivityEvent.deleteMany({ where: { snapshotId: snapshot.id } });
    if (events.length > 0) {
      await tx.festivityEvent.createMany({
        data: events.map((event) => ({ ...event, snapshotId: snapshot.id })),
      });
    }
  });

  return NextResponse.json({ ok: true });
}
