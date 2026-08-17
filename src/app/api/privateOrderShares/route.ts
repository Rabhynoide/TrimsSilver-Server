import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiUser } from "@/lib/api-auth";

// PrivateOrderShares / old "privateOrderShares" endpoint (GET/PUT, not a queued upload).
// Identifier resolution (matching a shared value to a real TrimsSilver account) isn't
// implemented yet, so every entry is stored and returned as unresolved.
export async function GET(request: NextRequest) {
  const auth = await requireApiUser(request);
  if (!auth.user) return auth.response;

  const shares = await prisma.privateOrderShare.findMany({
    where: { ownerId: auth.user.id },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json({
    sharedUsers: shares.map((share) => ({
      value: share.value,
      type: share.type,
      resolved: share.resolved,
    })),
  });
}

export async function PUT(request: NextRequest) {
  const auth = await requireApiUser(request);
  if (!auth.user) return auth.response;

  const body = await request.json().catch(() => null);
  const sharedUsers = body?.sharedUsers;

  if (!Array.isArray(sharedUsers) || !sharedUsers.every((value: unknown) => typeof value === "string")) {
    return NextResponse.json({ error: "sharedUsers[] of strings is required" }, { status: 400 });
  }

  const values = Array.from(new Set(sharedUsers as string[]));
  const ownerId = auth.user.id;

  await prisma.$transaction(async (tx) => {
    await tx.privateOrderShare.deleteMany({ where: { ownerId } });
    if (values.length > 0) {
      await tx.privateOrderShare.createMany({
        data: values.map((value) => ({ ownerId, value, type: "unresolved", resolved: false })),
      });
    }
  });

  return NextResponse.json({
    sharedUsers: values.map((value) => ({ value, type: "unresolved", resolved: false })),
    unresolvedEntries: values,
  });
}
