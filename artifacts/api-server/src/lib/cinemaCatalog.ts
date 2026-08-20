import { and, desc, eq, inArray } from "drizzle-orm";
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
  featurePlaybackId: string | null;
  playbackAvailable: boolean;
  playbackBlockedReason: string | null;
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

  const playbackAvailable = entitlement.entitlementType === "free";
  const playbackBlockedReason = playbackAvailable
    ? null
    : "This title is published in the catalog, but its subscription, rental, or purchase access flow is not available yet.";

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
    featurePlaybackId: playbackAvailable ? feature.fastpixPlaybackId : null,
    playbackAvailable,
    playbackBlockedReason,
    trailerPlaybackId: trailer?.fastpixPlaybackId ?? null,
    entitlementType: entitlement.entitlementType as PublicCinemaTitle["entitlementType"],
    publishedAt: title.publishedAt,
  };
}

export async function getPublishedCinemaTitleDetail(id: number): Promise<(PublicCinemaTitle & { credits: CinemaCredit[] }) | null> {
  const [titleRows, assets, rightsWindows, creditRows] = await Promise.all([
    db
      .select()
      .from(cinemaTitlesTable)
      .where(and(
        eq(cinemaTitlesTable.id, id),
        eq(cinemaTitlesTable.publishState, "published"),
      ))
      .limit(1),
    db
      .select()
      .from(cinemaTitleAssetsTable)
      .where(eq(cinemaTitleAssetsTable.cinemaTitleId, id)),
    db
      .select()
      .from(cinemaRightsWindowsTable)
      .where(eq(cinemaRightsWindowsTable.cinemaTitleId, id)),
    db.select({ credit: cinemaCreditsTable, channel: channelsTable })
      .from(cinemaCreditsTable)
      .innerJoin(channelsTable, eq(cinemaCreditsTable.channelId, channelsTable.id))
      .where(eq(cinemaCreditsTable.cinemaTitleId, id))
      .orderBy(cinemaCreditsTable.displayOrder, cinemaCreditsTable.createdAt),
  ]);
  const title = titleRows[0];
  if (!title) return null;

  const publicTitle = toPublicCinemaTitle(title, assets, rightsWindows, new Date());
  if (!publicTitle) return null;

  return {
    ...publicTitle,
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
  const titles = await db.select()
    .from(cinemaTitlesTable)
    .where(eq(cinemaTitlesTable.publishState, "published"))
    .orderBy(desc(cinemaTitlesTable.editorialRank), desc(cinemaTitlesTable.publishedAt));
  if (titles.length === 0) return [];

  const titleIds = titles.map((title) => title.id);
  const [assets, rightsWindows] = await Promise.all([
    db
      .select()
      .from(cinemaTitleAssetsTable)
      .where(inArray(cinemaTitleAssetsTable.cinemaTitleId, titleIds)),
    db
      .select()
      .from(cinemaRightsWindowsTable)
      .where(inArray(cinemaRightsWindowsTable.cinemaTitleId, titleIds)),
  ]);
  const assetsByTitleId = new Map<number, CinemaAssetRow[]>();
  for (const asset of assets) {
    const titleAssets = assetsByTitleId.get(asset.cinemaTitleId) ?? [];
    titleAssets.push(asset);
    assetsByTitleId.set(asset.cinemaTitleId, titleAssets);
  }
  const rightsWindowsByTitleId = new Map<number, CinemaRightsWindowRow[]>();
  for (const window of rightsWindows) {
    const titleWindows = rightsWindowsByTitleId.get(window.cinemaTitleId) ?? [];
    titleWindows.push(window);
    rightsWindowsByTitleId.set(window.cinemaTitleId, titleWindows);
  }
  const now = new Date();

  return titles
    .map((title) => toPublicCinemaTitle(
      title,
      assetsByTitleId.get(title.id) ?? [],
      rightsWindowsByTitleId.get(title.id) ?? [],
      now,
    ))
    .filter((title): title is PublicCinemaTitle => title !== null);
}
