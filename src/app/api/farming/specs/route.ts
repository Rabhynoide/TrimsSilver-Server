import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireFullAccess } from "@/lib/access";

// Farming Destiny Board spec levels (Crop Farmer, Animal Breeder, Herbalist +
// their per-item sub-specs), read from data the desktop client already
// uploads via FullAchievementInfo -> POST be/achievements (see
// AchievementSnapshot/AchievementEntry in prisma/schema.prisma — no new
// ingest work needed for this). A user can have multiple synced characters.
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
      if (entry.achievementId.startsWith("FARM_")) {
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
