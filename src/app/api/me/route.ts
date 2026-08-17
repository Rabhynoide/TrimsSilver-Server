import { NextRequest, NextResponse } from "next/server";
import { requireApiUser } from "@/lib/api-auth";

// Lets the desktop client validate its stored bearer token and fetch profile info
// without going through a browser — there is no refresh flow, a token is either
// still accepted (200) or it isn't (401), matching ApiToken having no expiry.
export async function GET(request: NextRequest) {
  const auth = await requireApiUser(request);
  if (!auth.user) return auth.response;

  return NextResponse.json({
    id: auth.user.id,
    name: auth.user.name,
    email: auth.user.email,
    image: auth.user.image,
  });
}
