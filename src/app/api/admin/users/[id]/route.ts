import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/access";

// Toggles a target user's hasFullAccess / isAdmin — admin-only. Deliberately
// refuses to let an admin edit their OWN row here: the only supported way to
// change your own admin status is another admin doing it, or (for the very
// first admin) the ADMIN_DISCORD_IDS env var in src/auth.ts — prevents an
// admin from fat-fingering themselves out of their own access with no one
// else able to undo it.
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const access = await requireAdmin();
  if (!access.ok) return access.response;

  const { id } = await params;
  if (id === access.session.user.id) {
    return NextResponse.json({ error: "Cannot change your own access" }, { status: 400 });
  }

  const body = await request.json().catch(() => ({}));
  const data: { hasFullAccess?: boolean; isAdmin?: boolean } = {};
  if (typeof body?.hasFullAccess === "boolean") data.hasFullAccess = body.hasFullAccess;
  if (typeof body?.isAdmin === "boolean") data.isAdmin = body.isAdmin;
  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "hasFullAccess and/or isAdmin (boolean) required" }, { status: 400 });
  }

  const user = await prisma.user
    .update({
      where: { id },
      data,
      select: { id: true, name: true, email: true, image: true, isAdmin: true, hasFullAccess: true, createdAt: true },
    })
    .catch(() => null);
  if (!user) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ user });
}
