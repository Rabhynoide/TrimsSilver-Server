import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

// Combat specialization levels, read from data the desktop client already
// uploads via FullAchievementInfo -> POST be/achievements (see
// AchievementSnapshot/AchievementEntry — no new ingest work needed). Mirrors
// /api/farming/specs. "COMBAT_" is the real prefix confirmed against
// ao-bin-dumps' items.json (@combatspecachievement is the only
// *specachievement* field in the whole file — see
// scripts/build-crafting-catalog.mjs), not a guess.
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const snapshots = await prisma.achievementSnapshot.findMany({
    where: { submittedById: session.user.id },
    include: { achievements: true },
    orderBy: { updatedAt: "desc" },
  });

  const characters = snapshots.map((snapshot) => {
    const specs: Record<string, number> = {};
    for (const entry of snapshot.achievements) {
      if (entry.achievementId.startsWith("COMBAT_")) {
        specs[entry.achievementId] = entry.level;
      }
    }
    return {
      characterName: snapshot.characterName,
      serverId: snapshot.serverId,
      updatedAt: snapshot.updatedAt,
      specs,
    };
  });

  return NextResponse.json({ characters });
}
