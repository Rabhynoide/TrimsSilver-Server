import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { mintApiToken } from "@/lib/api-auth";

// Mints a bearer token for the desktop client, tied to the signed-in Discord session.
// The /cli-auth page covers the client's actual sign-in flow; this route is for
// manually issuing/managing tokens from a browser (e.g. a future dashboard).
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const label = typeof body?.label === "string" ? body.label : null;

  const apiToken = await mintApiToken(session.user.id, label);
  return NextResponse.json(apiToken);
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
