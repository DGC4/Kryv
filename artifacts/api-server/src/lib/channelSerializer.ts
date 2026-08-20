import { and, count, eq, inArray } from "drizzle-orm";
import {
  db,
  categoriesTable,
  channelsTable,
  followsTable,
  subscriptionsTable,
  type Channel,
} from "@workspace/db";

export async function followerCountFor(channelId: number): Promise<number> {
  const [row] = await db
    .select({ n: count() })
    .from(followsTable)
    .where(eq(followsTable.channelId, channelId));
  return row?.n ?? 0;
}

export async function subscriberCountFor(channelId: number): Promise<number> {
  const [row] = await db
    .select({ n: count() })
    .from(subscriptionsTable)
    .where(
      and(
        eq(subscriptionsTable.channelId, channelId),
        eq(subscriptionsTable.status, "active"),
      ),
    );
  return row?.n ?? 0;
}

export async function categoryNameFor(
  categoryId: number | null,
): Promise<string | null> {
  if (categoryId == null) return null;
  const [row] = await db
    .select({ name: categoriesTable.name })
    .from(categoriesTable)
    .where(eq(categoriesTable.id, categoryId));
  return row?.name ?? null;
}

type ChannelAccess = {
  playbackBlockedReason?: string | null;
};

type ChannelSummaryMetrics = {
  followerCount: number;
  subscriberCount: number;
  categoryName: string | null;
};

type ChannelCategoryRow = { id: number; name: string };

export function toChannelSummaryFromMetrics(
  channel: Channel,
  metrics: ChannelSummaryMetrics,
  access: ChannelAccess = {},
) {
  const playbackBlockedReason = access.playbackBlockedReason ?? null;
  const playbackAvailable =
    Boolean(channel.fastpixPlaybackId) && !playbackBlockedReason;

  return {
    id: channel.id,
    slug: channel.slug,
    displayName: channel.displayName,
    avatarUrl: channel.avatarUrl,
    bannerUrl: channel.bannerUrl,
    streamTitle: channel.streamTitle,
    isLive: channel.isLive,
    viewerCount: channel.viewerCount,
    followerCount: metrics.followerCount,
    subscriberCount: metrics.subscriberCount,
    categoryId: channel.categoryId,
    categoryName: metrics.categoryName,
    lastStreamAt: channel.lastStreamAt,
    matureContent: channel.matureContent,
    playbackId: playbackAvailable ? channel.fastpixPlaybackId : null,
    fastpixPlaybackId: playbackAvailable ? channel.fastpixPlaybackId : null,
    playbackAvailable,
    playbackBlockedReason,
  };
}

export async function toChannelSummaries(channels: Channel[]) {
  if (channels.length === 0) return [];

  const channelIds = channels.map((channel) => channel.id);
  const categoryIds = [
    ...new Set(
      channels.flatMap((channel) =>
        channel.categoryId === null ? [] : [channel.categoryId],
      ),
    ),
  ];
  const [followerRows, subscriberRows, categoryRows] = await Promise.all([
    db
      .select({ channelId: followsTable.channelId, n: count() })
      .from(followsTable)
      .where(inArray(followsTable.channelId, channelIds))
      .groupBy(followsTable.channelId),
    db
      .select({ channelId: subscriptionsTable.channelId, n: count() })
      .from(subscriptionsTable)
      .where(
        and(
          inArray(subscriptionsTable.channelId, channelIds),
          eq(subscriptionsTable.status, "active"),
        ),
      )
      .groupBy(subscriptionsTable.channelId),
    categoryIds.length === 0
      ? Promise.resolve<ChannelCategoryRow[]>([])
      : db
          .select({ id: categoriesTable.id, name: categoriesTable.name })
          .from(categoriesTable)
          .where(inArray(categoriesTable.id, categoryIds)),
  ]);
  const followerCounts = new Map(
    followerRows.map((row) => [row.channelId, Number(row.n)]),
  );
  const subscriberCounts = new Map(
    subscriberRows.map((row) => [row.channelId, Number(row.n)]),
  );
  const categoryNames = new Map<number, string>(
    categoryRows.map((row): [number, string] => [row.id, row.name]),
  );

  return channels.map((channel) =>
    toChannelSummaryFromMetrics(channel, {
      followerCount: followerCounts.get(channel.id) ?? 0,
      subscriberCount: subscriberCounts.get(channel.id) ?? 0,
      categoryName:
        channel.categoryId === null
          ? null
          : (categoryNames.get(channel.categoryId) ?? null),
    }),
  );
}

async function toChannelSummaryWithAccess(
  channel: Channel,
  access: ChannelAccess = {},
) {
  const [followerCount, subscriberCount, categoryName] = await Promise.all([
    followerCountFor(channel.id),
    subscriberCountFor(channel.id),
    categoryNameFor(channel.categoryId),
  ]);
  return toChannelSummaryFromMetrics(
    channel,
    { followerCount, subscriberCount, categoryName },
    access,
  );
}

export async function toChannelSummary(channel: Channel) {
  return toChannelSummaryWithAccess(channel);
}

export async function toChannelDetail(
  channel: Channel,
  viewerUserId: number | undefined,
  access: ChannelAccess = {},
) {
  const summary = await toChannelSummaryWithAccess(channel, access);
  let isFollowing = false;
  if (viewerUserId) {
    const [row] = await db
      .select({ n: count() })
      .from(followsTable)
      .where(
        and(
          eq(followsTable.channelId, channel.id),
          eq(followsTable.followerUserId, viewerUserId),
        ),
      );
    isFollowing = (row?.n ?? 0) > 0;
  }

  let isSubscribed = false;
  if (viewerUserId) {
    const [row] = await db
      .select({ n: count() })
      .from(subscriptionsTable)
      .where(
        and(
          eq(subscriptionsTable.channelId, channel.id),
          eq(subscriptionsTable.userId, viewerUserId),
          eq(subscriptionsTable.status, "active"),
        ),
      );
    isSubscribed = (row?.n ?? 0) > 0;
  }

  return {
    ...summary,
    description: channel.description,
    websiteUrl: channel.websiteUrl,
    youtubeUrl: channel.youtubeUrl,
    instagramUrl: channel.instagramUrl,
    xUrl: channel.xUrl,
    isFollowing,
    isSubscribed,
    isOwner: viewerUserId === channel.ownerUserId,
    ownerUserId: channel.ownerUserId,
    createdAt: channel.createdAt,
  };
}

export function slugify(input: string): string {
  return (
    input
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "channel"
  );
}

export async function uniqueChannelSlug(base: string): Promise<string> {
  const baseSlug = slugify(base);
  let slug = baseSlug;
  let attempt = 1;
  while (true) {
    const [existing] = await db
      .select({ id: channelsTable.id })
      .from(channelsTable)
      .where(eq(channelsTable.slug, slug));
    if (!existing) return slug;
    attempt += 1;
    slug = `${baseSlug}-${attempt}`;
  }
}
