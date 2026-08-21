import { and, asc, eq, gt, inArray, isNull } from "drizzle-orm";
import {
  channelsTable,
  db,
  followsTable,
  notificationPreferencesTable,
  notificationsTable,
} from "@workspace/db";

export const NOTIFICATION_FANOUT_BATCH_SIZE = 500;

export type FollowedLiveNotificationInput = {
  channelId: number;
  channelSlug: string;
  channelDisplayName: string;
  streamTitle: string | null;
  streamSessionId: number;
};

export type FollowedContentNotificationInput = {
  channelId: number;
  notificationType: "watch_upload_ready" | "clip_ready";
  contentId: number;
  contentTitle: string;
};

async function forEachFollowedRecipientBatch(
  channelId: number,
  process: (followerIds: number[]) => Promise<void>,
) {
  let lastFollowId = 0;
  while (true) {
    const followers = await db
      .select({ id: followsTable.id, userId: followsTable.followerUserId })
      .from(followsTable)
      .where(
        and(
          eq(followsTable.channelId, channelId),
          gt(followsTable.id, lastFollowId),
        ),
      )
      .orderBy(asc(followsTable.id))
      .limit(NOTIFICATION_FANOUT_BATCH_SIZE);
    if (!followers.length) return;

    lastFollowId = followers[followers.length - 1]!.id;
    await process(followers.map((follower) => follower.userId));
    if (followers.length < NOTIFICATION_FANOUT_BATCH_SIZE) return;
  }
}

export async function fanoutFollowedLiveNotifications(
  input: FollowedLiveNotificationInput,
) {
  await forEachFollowedRecipientBatch(input.channelId, async (followerIds) => {
    const preferences = await db
      .select({
        userId: notificationPreferencesTable.userId,
        notifyOnLive: notificationPreferencesTable.notifyOnLive,
      })
      .from(notificationPreferencesTable)
      .where(
        and(
          inArray(notificationPreferencesTable.userId, followerIds),
          isNull(notificationPreferencesTable.channelId),
        ),
      );
    const livePreferenceByUserId = new Map(
      preferences.map((preference) => [
        preference.userId,
        preference.notifyOnLive,
      ]),
    );
    const recipientIds = followerIds.filter(
      (userId) => livePreferenceByUserId.get(userId) !== false,
    );
    if (!recipientIds.length) return;

    await db.insert(notificationsTable).values(
      recipientIds.map((userId) => ({
        userId,
        type: "followed_channel_live",
        title: `${input.channelDisplayName} is live`,
        message:
          input.streamTitle ||
          "A creator you follow just started broadcasting on Kryv.",
        data: {
          channelId: input.channelId,
          channelSlug: input.channelSlug,
          streamSessionId: input.streamSessionId,
        },
      })),
    );
  });
}

export async function fanoutFollowedContentNotifications(
  input: FollowedContentNotificationInput,
) {
  const [channel] = await db
    .select({
      id: channelsTable.id,
      slug: channelsTable.slug,
      displayName: channelsTable.displayName,
    })
    .from(channelsTable)
    .where(eq(channelsTable.id, input.channelId))
    .limit(1);
  if (!channel) return;

  const isClip = input.notificationType === "clip_ready";
  await forEachFollowedRecipientBatch(channel.id, async (followerIds) => {
    const preferences = await db
      .select({
        userId: notificationPreferencesTable.userId,
        notifyOnUpload: notificationPreferencesTable.notifyOnUpload,
        notifyOnClip: notificationPreferencesTable.notifyOnClip,
      })
      .from(notificationPreferencesTable)
      .where(
        and(
          inArray(notificationPreferencesTable.userId, followerIds),
          isNull(notificationPreferencesTable.channelId),
        ),
      );
    const preferenceByUserId = new Map(
      preferences.map((preference) => [preference.userId, preference]),
    );
    const recipientIds = followerIds.filter((userId) => {
      const preference = preferenceByUserId.get(userId);
      return input.notificationType === "watch_upload_ready"
        ? preference?.notifyOnUpload !== false
        : preference?.notifyOnClip === true;
    });
    if (!recipientIds.length) return;

    await db.insert(notificationsTable).values(
      recipientIds.map((userId) => ({
        userId,
        type: input.notificationType,
        title: `${channel.displayName} published a ${
          isClip ? "Clip" : "Watch release"
        }`,
        message: input.contentTitle,
        data: {
          channelId: channel.id,
          channelSlug: channel.slug,
          ...(isClip
            ? { clipId: input.contentId }
            : { videoId: input.contentId }),
        },
      })),
    );
  });
}
