// Centralizes the "does this session have full site access" check used by
// every restricted feature's page.tsx and API routes. New Discord sign-ins
// default to User.hasFullAccess = false (see prisma/schema.prisma), which
// only lets them see "/" and "/market-prices" — an admin (User.isAdmin, see
// /admin/users) has to explicitly grant a specific account access to the
// rest of the site. This is a browser-cookie-session check (Auth.js
// database strategy) — orthogonal to requireApiUser in api-auth.ts, which
// gates the desktop client's own bearer-token endpoints and isn't part of
// this feature's scope (a client upload isn't "browsing the site").
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import type { Session } from "next-auth";

export type AccessInfo = { signedIn: boolean; hasFullAccess: boolean; isAdmin: boolean };

export async function getAccess(): Promise<{ session: Session | null; access: AccessInfo }> {
  const session = await auth();
  return {
    session,
    access: {
      signedIn: !!session?.user,
      hasFullAccess: !!session?.user?.hasFullAccess,
      isAdmin: !!session?.user?.isAdmin,
    },
  };
}

// For API routes backing a restricted page — mirrors requireApiUser's
// `{ok:false, response}` escape-hatch shape (api-auth.ts) so call sites can
// `if (!access.ok) return access.response;` the same way. 403 (not 401) when
// signed in but not approved — the user IS authenticated, they just haven't
// been granted this feature, same distinction Auth.js itself draws between
// "who are you" and "what can you do".
export async function requireFullAccess(): Promise<
  { ok: true; session: Session } | { ok: false; response: NextResponse }
> {
  const session = await auth();
  if (!session?.user?.hasFullAccess) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: session?.user ? "Access not granted" : "Not signed in" },
        { status: session?.user ? 403 : 401 },
      ),
    };
  }
  return { ok: true, session };
}

// Same shape, for admin-only API routes (/api/admin/*) — a non-admin gets
// the same 403/401 distinction as requireFullAccess above.
export async function requireAdmin(): Promise<
  { ok: true; session: Session } | { ok: false; response: NextResponse }
> {
  const session = await auth();
  if (!session?.user?.isAdmin) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: session?.user ? "Admin only" : "Not signed in" },
        { status: session?.user ? 403 : 401 },
      ),
    };
  }
  return { ok: true, session };
}
