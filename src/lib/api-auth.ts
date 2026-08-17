import { createHash, randomBytes } from "crypto";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { User } from "@/generated/prisma/client";

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

// Shared by POST /api/tokens (dashboard) and /cli-auth (desktop client sign-in redirect).
// The raw token is only ever returned here; only its hash is stored.
export async function mintApiToken(userId: string, label: string | null = null) {
  const rawToken = randomBytes(32).toString("base64url");
  const apiToken = await prisma.apiToken.create({
    data: { userId, tokenHash: hashToken(rawToken), label },
  });
  return { id: apiToken.id, token: rawToken, createdAt: apiToken.createdAt };
}

type ApiAuthResult = { user: User; response?: undefined } | { user: null; response: NextResponse };

// Desktop client auth: a Bearer token minted at POST /api/tokens by a signed-in browser
// session, not the Auth.js session cookie (the client has no cookie jar for this).
export async function requireApiUser(request: Request): Promise<ApiAuthResult> {
  const match = request.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i);
  const token = match?.[1];

  if (!token) {
    return { user: null, response: unauthorized("Missing bearer token") };
  }

  const apiToken = await prisma.apiToken.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { user: true },
  });

  if (!apiToken) {
    return { user: null, response: unauthorized("Invalid token") };
  }

  prisma.apiToken
    .update({ where: { id: apiToken.id }, data: { lastUsedAt: new Date() } })
    .catch(() => {});

  return { user: apiToken.user };
}

function unauthorized(message: string) {
  return NextResponse.json({ error: message }, { status: 401 });
}
