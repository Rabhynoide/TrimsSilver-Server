import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

// Farming Destiny Board spec levels (Crop Farmer, Animal Breeder, Herbalist +
// their per-item sub-specs), read from data the desktop client already
// uploads via FullAchievementInfo -> POST be/achievements (see
// AchievementSnapshot/AchievementEntry in prisma/schema.prisma — no new
// ingest work needed for this). A user can have multiple synced characters.
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
