import type { Request } from "express";
import { and, eq } from "drizzle-orm";
import { db, type Channel, viewerProfilesTable } from "@workspace/db";

const maturityRank = { kids: 0, standard: 1, mature: 2 } as const;

type ProfileMaturity = keyof typeof maturityRank;

export async function getActiveProfileMaturity(
  req: Request,
): Promise<ProfileMaturity | null> {
  if (!req.user || !req.activeProfileId) return null;

  const [profile] = await db
    .select({ maturityLevel: viewerProfilesTable.maturityLevel })
    .from(viewerProfilesTable)
    .where(
      and(
        eq(viewerProfilesTable.id, req.activeProfileId),
        eq(viewerProfilesTable.userId, req.user.userId),
      ),
    )
    .limit(1);

  const maturityLevel = profile?.maturityLevel as ProfileMaturity | undefined;
  return maturityLevel && maturityRank[maturityLevel] !== undefined
    ? maturityLevel
    : null;
}

/**
 * Mature Live rooms require an active session-bound profile with the mature
 * setting. The profile is re-read from storage so stale, forged, or revoked
 * profile grants never authorize playback, chat, clips, or audience metadata.
 */
export async function getLiveMaturityRestriction(
  req: Request,
  channel: Pick<Channel, "matureContent">,
): Promise<string | null> {
  if (!channel.matureContent) return null;

  if (!req.user || !req.activeProfileId) {
    return "Select a mature viewer profile to access this Live room.";
  }

  const profileMaturity = await getActiveProfileMaturity(req);
  if (profileMaturity !== "mature") {
    return "This Live room is outside the active profile's maturity setting.";
  }

  return null;
}
