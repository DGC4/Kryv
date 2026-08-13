import { desc, eq } from "drizzle-orm";
import {
  channelsTable,
  cinemaCreditsTable,
  cinemaRightsWindowsTable,
  cinemaTitleAssetsTable,
  cinemaTitlesTable,
  db,
} from "@workspace/db";

type CinemaTitleRow = typeof cinemaTitlesTable.$inferSelect;
type CinemaAssetRow = typeof cinemaTitleAssetsTable.$inferSelect;
type CinemaRightsWindowRow = typeof cinemaRightsWindowsTable.$inferSelect;

export type CinemaCredit = {
  channelId: number;
  channelSlug: string;
  channelDisplayName: string;
  channelAvatarUrl: string | null;
  role: string;
};

export type PublicCinemaTitle = {
  id: number;
  slug: string;
  title: string;
  synopsis: string | null;
  maturityLevel: "kids" | "standard" | "mature";
  genres: string[];
  posterUrl: string | null;
  backdropUrl: string | null;
  runtimeSeconds: number | null;
  featurePlaybackId: string;
  trailerPlaybackId: string | null;
  entitlementType: "free" | "subscription" | "rental" | "purchase";
  publishedAt: Date | null;
};

function textList(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function isGloballyAvailable(window: CinemaRightsWindowRow, now: Date) {
  return window.entitlementType !== "unconfigured"
    && window.startsAt <= now
    && (!window.endsAt || window.endsAt >= now)
    && textList(window.territoryCodes).length === 0;
}

export function toPublicCinemaTitle(
  title: CinemaTitleRow,
  assets: CinemaAssetRow[],
  rightsWindows: CinemaRightsWindowRow[],
  now: Date,
): PublicCinemaTitle | null {
  const feature = assets.find((asset) => (
    asset.assetKind === "feature"
    && asset.processingStatus === "ready"
    && Boolean(asset.fastpixPlaybackId)
  ));
  const entitlement = rightsWindows.find((window) => isGloballyAvailable(window, now));
  if (!feature?.fastpixPlaybackId || !entitlement) return null;

  const trailer = assets.find((asset) => (
    asset.assetKind === "trailer"
    && asset.processingStatus === "ready"
    && Boolean(asset.fastpixPlaybackId)
  ));

  return {
    id: title.id,
    slug: title.slug,
    title: title.title,
    synopsis: title.synopsis,
    maturityLevel: title.maturityLevel as PublicCinemaTitle["maturityLevel"],
    genres: textList(title.genres),
    posterUrl: title.posterUrl,
    backdropUrl: title.backdropUrl,
    runtimeSeconds: title.runtimeSeconds ?? feature.durationSeconds,
    featurePlaybackId: feature.fastpixPlaybackId,
    trailerPlaybackId: trailer?.fastpixPlaybackId ?? null,
    entitlementType: entitlement.entitlementType as PublicCinemaTitle["entitlementType"],
    publishedAt: title.publishedAt,
  };
}

export async function getPublishedCinemaTitleDetail(id: number): Promise<(PublicCinemaTitle & { credits: CinemaCredit[] }) | null> {
  const [title, creditRows] = await Promise.all([
    getPublishedCinemaTitles().then((titles) => titles.find((item) => item.id === id) ?? null),
    db.select({ credit: cinemaCreditsTable, channel: channelsTable })
      .from(cinemaCreditsTable)
      .innerJoin(channelsTable, eq(cinemaCreditsTable.channelId, channelsTable.id))
      .where(eq(cinemaCreditsTable.cinemaTitleId, id))
      .orderBy(cinemaCreditsTable.displayOrder, cinemaCreditsTable.createdAt),
  ]);
  if (!title) return null;

  return {
    ...title,
    credits: creditRows.map(({ credit, channel }) => ({
      channelId: channel.id,
      channelSlug: channel.slug,
      channelDisplayName: channel.displayName,
      channelAvatarUrl: channel.avatarUrl,
      role: credit.role,
    })),
  };
}

export async function getPublishedCinemaTitles(): Promise<PublicCinemaTitle[]> {
  const [titles, assets, rightsWindows] = await Promise.all([
    db.select()
      .from(cinemaTitlesTable)
      .where(eq(cinemaTitlesTable.publishState, "published"))
      .orderBy(desc(cinemaTitlesTable.editorialRank), desc(cinemaTitlesTable.publishedAt)),
    db.select().from(cinemaTitleAssetsTable),
    db.select().from(cinemaRightsWindowsTable),
  ]);
  const now = new Date();

  return titles
    .map((title) => toPublicCinemaTitle(
      title,
      assets.filter((asset) => asset.cinemaTitleId === title.id),
      rightsWindows.filter((window) => window.cinemaTitleId === title.id),
      now,
    ))
    .filter((title): title is PublicCinemaTitle => title !== null);
}
