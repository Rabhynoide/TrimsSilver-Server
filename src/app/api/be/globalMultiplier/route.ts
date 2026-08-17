import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiUser } from "@/lib/api-auth";

// GlobalMultiplierUpload / old "be/globalMultiplier" endpoint. Current value per server.
export async function POST(request: NextRequest) {
  const auth = await requireApiUser(request);
  if (!auth.user) return auth.response;

  const body = await request.json().catch(() => null);
  const serverId = body?.serverId;
  const globalMultiplier = body?.globalMultiplier;

  if (typeof serverId !== "number" || typeof globalMultiplier !== "number") {
    return NextResponse.json(
      { error: "serverId and globalMultiplier are required" },
      { status: 400 }
    );
  }

  await prisma.globalMultiplier.upsert({
    where: { serverId },
    create: { serverId, value: globalMultiplier, submittedById: auth.user.id },
    update: { value: globalMultiplier, submittedById: auth.user.id },
  });

  return NextResponse.json({ ok: true });
}
