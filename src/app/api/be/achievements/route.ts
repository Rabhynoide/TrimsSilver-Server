import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiUser } from "@/lib/api-auth";

interface AchievementEntryPayload {
  id: string;
  level: number;
}

function isValidEntry(entry: unknown): entry is AchievementEntryPayload {
  const e = entry as Partial<AchievementEntryPayload>;
  return typeof e?.id === "string" && typeof e?.level === "number";
}

// AchievementUpload / old "be/achievements" endpoint.
// Replaces the achievement list wholesale for (serverId, characterName) on every upload.
export async function POST(request: NextRequest) {
  const auth = await requireApiUser(request);
  if (!auth.user) return auth.response;

  const body = await request.json().catch(() => null);
  const characterName = body?.characterName;
  const serverId = body?.serverId;
  const achievements = body?.achievements;

  if (
    typeof characterName !== "string" ||
    typeof serverId !== "number" ||
    !Array.isArray(achievements) ||
    !achievements.every(isValidEntry)
  ) {
    return NextResponse.json(
      { error: "characterName, serverId and a valid achievements[] are required" },
      { status: 400 }
    );
  }

  const entries = achievements as AchievementEntryPayload[];

  await prisma.$transaction(async (tx) => {
    const snapshot = await tx.achievementSnapshot.upsert({
      where: { serverId_characterName: { serverId, characterName } },
      create: { serverId, characterName, submittedById: auth.user.id },
      update: { submittedById: auth.user.id },
    });

    await tx.achievementEntry.deleteMany({ where: { snapshotId: snapshot.id } });
    if (entries.length > 0) {
      await tx.achievementEntry.createMany({
        data: entries.map((entry) => ({
          snapshotId: snapshot.id,
          achievementId: entry.id,
          level: entry.level,
        })),
      });
    }
  });

  return NextResponse.json({ ok: true });
}
