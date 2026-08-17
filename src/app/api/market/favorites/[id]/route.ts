import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

async function requireOwnedFavorite(id: string, userId: string) {
  const favorite = await prisma.marketPriceFavorite.findUnique({ where: { id } });
  if (!favorite || favorite.userId !== userId) return null;
  return favorite;
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const { id } = await params;
  const existing = await requireOwnedFavorite(id, session.user.id);
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await request.json().catch(() => ({}));
  const name = typeof body?.name === "string" ? body.name.trim() : undefined;
  const note = typeof body?.note === "string" ? body.note.trim() : undefined;
  const config = typeof body?.config === "object" && body.config !== null ? body.config : undefined;

  const favorite = await prisma.marketPriceFavorite.update({
    where: { id },
    data: { name, note, config },
  });

  return NextResponse.json({ favorite });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const { id } = await params;
  const existing = await requireOwnedFavorite(id, session.user.id);
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.marketPriceFavorite.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
