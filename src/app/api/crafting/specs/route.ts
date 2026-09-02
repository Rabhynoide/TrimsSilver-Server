import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireFullAccess } from "@/lib/access";

// Combat specialization levels, read from data the desktop client already
// uploads via FullAchievementInfo -> POST be/achievements (see
// AchievementSnapshot/AchievementEntry — no new ingest work needed). Mirrors
// /api/farming/specs. "COMBAT_" is the real prefix confirmed against
// ao-bin-dumps' items.json (@combatspecachievement is the only
// *specachievement* field in the whole file — see
// scripts/build-crafting-catalog.mjs), not a guess.
export async function GET() {
  const access = await requireFullAccess();
  if (!access.ok) return access.response;
  const { session } = access;

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
