import { randomBytes } from "crypto";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { hashToken } from "@/lib/api-auth";

// Mints a bearer token for the desktop client, tied to the signed-in Discord session.
// Stands in for a full OAuth-device flow until client issue #3 lands.
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const label = typeof body?.label === "string" ? body.label : null;

  const rawToken = randomBytes(32).toString("base64url");
  const apiToken = await prisma.apiToken.create({
    data: {
      userId: session.user.id,
      tokenHash: hashToken(rawToken),
      label,
    },
  });

  // The raw token is only ever returned here; only its hash is stored.
  return NextResponse.json({ id: apiToken.id, token: rawToken, createdAt: apiToken.createdAt });
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const tokens = await prisma.apiToken.findMany({
    where: { userId: session.user.id },
    select: { id: true, label: true, createdAt: true, lastUsedAt: true },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ tokens });
}
