import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

// Saved Market Prices Price Checker configurations. Browser-only, gated on the
// Auth.js session cookie (not the desktop client's bearer-token ingest auth).
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const favorites = await prisma.marketPriceFavorite.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ favorites });
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const note = typeof body?.note === "string" ? body.note.trim() : null;
  const config = body?.config;

  if (!name || typeof config !== "object" || config === null) {
    return NextResponse.json({ error: "name and config are required" }, { status: 400 });
  }

  const favorite = await prisma.marketPriceFavorite.create({
    data: { userId: session.user.id, name, note, config },
  });

  return NextResponse.json({ favorite });
}
