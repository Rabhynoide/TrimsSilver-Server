import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireFullAccess } from "@/lib/access";

// Single saved Craft Finder profile per user (simulation city, Premium,
// price mode, liquidity threshold, per-category Return Rate/station
// fee/Focus, filters, manual prices). Browser-only, gated on the Auth.js
// session cookie. Mirrors /api/crafting/settings exactly.
export async function GET() {
  const access = await requireFullAccess();
  if (!access.ok) return access.response;
  const { session } = access;

  const settings = await prisma.craftFinderSettings.findUnique({
    where: { userId: session.user.id },
  });

  return NextResponse.json({ settings });
}

export async function PUT(request: Request) {
  const access = await requireFullAccess();
  if (!access.ok) return access.response;
  const { session } = access;

  const body = await request.json().catch(() => null);
  const config = body?.config;
  if (typeof config !== "object" || config === null) {
    return NextResponse.json({ error: "config is required" }, { status: 400 });
  }

  const settings = await prisma.craftFinderSettings.upsert({
    where: { userId: session.user.id },
    create: { userId: session.user.id, config },
    update: { config },
  });

  return NextResponse.json({ settings });
}
