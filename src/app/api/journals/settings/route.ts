import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

// Single saved Journals Calculator profile per user, gated on the Auth.js
// session cookie. Mirrors /api/crafting/settings and /api/farming/settings
// exactly.
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const settings = await prisma.journalsCalculatorSettings.findUnique({
    where: { userId: session.user.id },
  });

  return NextResponse.json({ settings });
}

export async function PUT(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const config = body?.config;
  if (typeof config !== "object" || config === null) {
    return NextResponse.json({ error: "config is required" }, { status: 400 });
  }

  const settings = await prisma.journalsCalculatorSettings.upsert({
    where: { userId: session.user.id },
    create: { userId: session.user.id, config },
    update: { config },
  });

  return NextResponse.json({ settings });
}
