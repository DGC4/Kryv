import { and, count, eq } from "drizzle-orm";
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

async function toChannelSummaryWithAccess(
  channel: Channel,
  access: ChannelAccess = {},
) {
  const [followerCount, subscriberCount, categoryName] = await Promise.all([
    followerCountFor(channel.id),
    subscriberCountFor(channel.id),
    categoryNameFor(channel.categoryId),
  ]);
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
    followerCount,
    subscriberCount,
    categoryId: channel.categoryId,
    categoryName,
    lastStreamAt: channel.lastStreamAt,
    matureContent: channel.matureContent,
    playbackId: playbackAvailable ? channel.fastpixPlaybackId : null,
    fastpixPlaybackId: playbackAvailable ? channel.fastpixPlaybackId : null,
    playbackAvailable,
    playbackBlockedReason,
  };
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
