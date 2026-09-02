import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/access";

// Full user list for the /admin/users dashboard — admin-only (see
// requireAdmin). No pagination: this is a small self-hosted guild tool, not
// a public SaaS with thousands of accounts.
export async function GET() {
  const access = await requireAdmin();
  if (!access.ok) return access.response;

  const users = await prisma.user.findMany({
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      name: true,
      email: true,
      image: true,
      isAdmin: true,
      hasFullAccess: true,
      createdAt: true,
    },
  });

  return NextResponse.json({ users });
}
