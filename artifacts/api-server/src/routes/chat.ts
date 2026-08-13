import { Router, type IRouter } from "express";
import { z } from "zod";
import { and, asc, desc, eq, gt, isNull, or, sql } from "drizzle-orm";
import {
  channelBansTable,
  channelsTable,
  chatMessagesTable,
  chatTimeoutsTable,
  db,
  followsTable,
  moderatorsTable,
  moderationCasesTable,
  streamSessionsTable,
  usersTable,
} from "@workspace/db";
import {
  CreateChannelMessageBody,
  CreateChannelMessageParams,
  CreateChannelMessageResponse,
  CreateChannelModerationActionBody,
  CreateChannelModerationActionParams,
  CreateChannelModerationActionResponse,
  CreateChannelChatReportBody,
  CreateChannelChatReportParams,
  CreateChannelChatReportResponse,
  GetChannelChatSettingsParams,
  GetChannelChatSettingsResponse,
  ListChannelMessagesParams,
  ListChannelMessagesResponse,
  UpdateChannelChatSettingsBody,
  UpdateChannelChatSettingsParams,
  UpdateChannelChatSettingsResponse,
} from "@workspace/api-zod";
import { requireAuth } from "../lib/auth";
import { enqueueDurableJob } from "../lib/jobs";
import { deleteSharedKey, getSharedStateClient, publishRealtimeEvent, readSharedJson, writeSharedJson } from "../lib/realtime";
import { logActivity } from "../lib/tracking";
import { writeAuditLog } from "../lib/operations";

const router: IRouter = Router();

const CreateChannelSafetyReportBody = z.object({
  reason: z.enum(["harassment", "hate_or_harm", "spam_or_scam", "sexual_content", "violence_or_threat", "other"]),
  details: z.string().trim().min(1).max(1000).optional(),
});

function messageListCacheKey(channelId: number) {
  return `kryv:chat:messages:${channelId}`;
}

type ChannelActorRole = {
  isOwner: boolean;
  isModerator: boolean;
};

async function getChannelActorRole(
  channelId: number,
  ownerUserId: number,
  userId: number,
): Promise<ChannelActorRole> {
  if (ownerUserId === userId) {
    return { isOwner: true, isModerator: true };
  }

  const [moderator] = await db
    .select({ userId: moderatorsTable.userId })
    .from(moderatorsTable)
    .where(
      and(
        eq(moderatorsTable.channelId, channelId),
        eq(moderatorsTable.userId, userId),
      ),
    )
    .limit(1);

  return { isOwner: false, isModerator: Boolean(moderator) };
}

async function findActiveRestriction(
  table: typeof channelBansTable | typeof chatTimeoutsTable,
  channelId: number,
  userId: number,
) {
  const now = new Date();
  const [restriction] = await db
    .select()
    .from(table)
    .where(
      and(
        eq(table.channelId, channelId),
        eq(table.userId, userId),
        or(isNull(table.expiresAt), gt(table.expiresAt, now)),
      ),
    )
    .orderBy(desc(table.createdAt))
    .limit(1);

  return restriction;
}

async function ensureModerationTargetIsAllowed(
  channelId: number,
  ownerUserId: number,
  actor: ChannelActorRole,
  targetUserId: number,
): Promise<string | null> {
  if (targetUserId === ownerUserId) {
    return "The channel owner cannot be moderated.";
  }

  if (!actor.isOwner) {
    const targetRole = await getChannelActorRole(channelId, ownerUserId, targetUserId);
    if (targetRole.isModerator) {
      return "Only the channel owner can moderate another moderator.";
    }
  }

  return null;
}

router.get(
  "/channels/:id/chat-settings",
  async (req, res): Promise<void> => {
    const params = GetChannelChatSettingsParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }

    const [channel] = await db
      .select({
        id: channelsTable.id,
        chatSlowModeSeconds: channelsTable.chatSlowModeSeconds,
        chatFollowersOnly: channelsTable.chatFollowersOnly,
      })
      .from(channelsTable)
      .where(eq(channelsTable.id, params.data.id));
    if (!channel) {
      res.status(404).json({ error: "Channel not found" });
      return;
    }

    res.json(
      GetChannelChatSettingsResponse.parse({
        slowModeSeconds: channel.chatSlowModeSeconds,
        followersOnly: channel.chatFollowersOnly,
      }),
    );
  },
);

router.patch(
  "/channels/:id/chat-settings",
  requireAuth,
  async (req, res): Promise<void> => {
    const userId = req.user!.userId;
    const params = UpdateChannelChatSettingsParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    const body = UpdateChannelChatSettingsBody.safeParse(req.body);
    if (!body.success) {
      res.status(400).json({ error: body.error.message });
      return;
    }

    const [channel] = await db
      .select()
      .from(channelsTable)
      .where(eq(channelsTable.id, params.data.id));
    if (!channel) {
      res.status(404).json({ error: "Channel not found" });
      return;
    }
    if (channel.ownerUserId !== userId) {
      res.status(403).json({ error: "Only the channel owner can change chat settings." });
      return;
    }

    const [updated] = await db
      .update(channelsTable)
      .set({
        ...(body.data.slowModeSeconds !== undefined
          ? { chatSlowModeSeconds: body.data.slowModeSeconds }
          : {}),
        ...(body.data.followersOnly !== undefined
          ? { chatFollowersOnly: body.data.followersOnly }
          : {}),
      })
      .where(eq(channelsTable.id, channel.id))
      .returning({
        slowModeSeconds: channelsTable.chatSlowModeSeconds,
        followersOnly: channelsTable.chatFollowersOnly,
      });

    logActivity(req, "channel_chat_settings_updated", {
      channelId: channel.id,
      slowModeSeconds: updated.slowModeSeconds,
      followersOnly: updated.followersOnly,
    }).catch(console.error);
    publishRealtimeEvent({
      type: "channel.moderation.updated",
      channelId: channel.id,
      occurredAt: new Date().toISOString(),
      data: { action: "chat_settings_updated", slowModeSeconds: updated.slowModeSeconds, followersOnly: updated.followersOnly },
    }).catch(() => undefined);

    res.json(UpdateChannelChatSettingsResponse.parse(updated));
  },
);

router.post(
  "/channels/:id/moderation/actions",
  requireAuth,
  async (req, res): Promise<void> => {
    const userId = req.user!.userId;
    const params = CreateChannelModerationActionParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    const body = CreateChannelModerationActionBody.safeParse(req.body);
    if (!body.success) {
      res.status(400).json({ error: body.error.message });
      return;
    }

    const [channel] = await db
      .select()
      .from(channelsTable)
      .where(eq(channelsTable.id, params.data.id));
    if (!channel) {
      res.status(404).json({ error: "Channel not found" });
      return;
    }

    const actor = await getChannelActorRole(channel.id, channel.ownerUserId, userId);
    const canModerate = actor.isOwner || actor.isModerator;
    if (!canModerate) {
      res.status(403).json({ error: "Only the channel owner or an appointed moderator can perform this action." });
      return;
    }

    const action = body.data.action;
    const targetUserId = body.data.targetUserId;
    const reason = body.data.reason?.trim() || null;
    let expiresAt: Date | null = null;

    if (action === "delete_message") {
      if (!body.data.messageId) {
        res.status(400).json({ error: "A message is required for this action." });
        return;
      }

      const [message] = await db
        .select()
        .from(chatMessagesTable)
        .where(
          and(
            eq(chatMessagesTable.id, body.data.messageId),
            eq(chatMessagesTable.channelId, channel.id),
            isNull(chatMessagesTable.deletedAt),
          ),
        );
      if (!message) {
        res.status(404).json({ error: "Message not found" });
        return;
      }

      await db
        .update(chatMessagesTable)
        .set({ deletedAt: new Date(), deletedByUserId: userId })
        .where(eq(chatMessagesTable.id, message.id));

      logActivity(req, "channel_chat_message_deleted", {
        channelId: channel.id,
        messageId: message.id,
        targetUserId: message.userId,
      }).catch(console.error);
      deleteSharedKey(messageListCacheKey(channel.id)).catch(() => undefined);
      publishRealtimeEvent({
        type: "chat.message.deleted",
        channelId: channel.id,
        occurredAt: new Date().toISOString(),
        data: { messageId: message.id, targetUserId: message.userId },
      }).catch(() => undefined);

      res.json(
        CreateChannelModerationActionResponse.parse({
          action,
          targetUserId: message.userId,
          messageId: message.id,
          expiresAt: null,
        }),
      );
      return;
    }

    if (!targetUserId) {
      res.status(400).json({ error: "A user is required for this action." });
      return;
    }

    const [targetUser] = await db
      .select({ id: usersTable.id })
      .from(usersTable)
      .where(eq(usersTable.id, targetUserId));
    if (!targetUser) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    if (action === "add_moderator" || action === "remove_moderator") {
      if (!actor.isOwner) {
        res.status(403).json({ error: "Only the channel owner can appoint or remove moderators." });
        return;
      }
      if (targetUserId === channel.ownerUserId) {
        res.status(400).json({ error: "The channel owner already has full moderation access." });
        return;
      }

      if (action === "add_moderator") {
        await db
          .insert(moderatorsTable)
          .values({ channelId: channel.id, userId: targetUserId, permissions: { chat: true } })
          .onConflictDoNothing();
      } else {
        await db
          .delete(moderatorsTable)
          .where(
            and(
              eq(moderatorsTable.channelId, channel.id),
              eq(moderatorsTable.userId, targetUserId),
            ),
          );
      }
    } else {
      const targetError = await ensureModerationTargetIsAllowed(
        channel.id,
        channel.ownerUserId,
        actor,
        targetUserId,
      );
      if (targetError) {
        res.status(403).json({ error: targetError });
        return;
      }

      if (action === "timeout") {
        const durationSeconds = body.data.durationSeconds ?? 600;
        expiresAt = new Date(Date.now() + durationSeconds * 1000);
        const existing = await findActiveRestriction(chatTimeoutsTable, channel.id, targetUserId);
        if (existing) {
          await db
            .update(chatTimeoutsTable)
            .set({ moderatorUserId: userId, reason, durationSeconds, expiresAt })
            .where(eq(chatTimeoutsTable.id, existing.id));
        } else {
          await db.insert(chatTimeoutsTable).values({
            channelId: channel.id,
            userId: targetUserId,
            moderatorUserId: userId,
            reason,
            durationSeconds,
            expiresAt,
          });
        }
      } else if (action === "ban") {
        const existing = await findActiveRestriction(channelBansTable, channel.id, targetUserId);
        if (existing) {
          await db
            .update(channelBansTable)
            .set({ reason, expiresAt: null })
            .where(eq(channelBansTable.id, existing.id));
        } else {
          await db.insert(channelBansTable).values({
            channelId: channel.id,
            userId: targetUserId,
            reason,
            expiresAt: null,
          });
        }
      } else if (action === "unban") {
        await db
          .update(channelBansTable)
          .set({ expiresAt: new Date() })
          .where(
            and(
              eq(channelBansTable.channelId, channel.id),
              eq(channelBansTable.userId, targetUserId),
              or(
                isNull(channelBansTable.expiresAt),
                gt(channelBansTable.expiresAt, new Date()),
              ),
            ),
          );
      }
    }

    logActivity(req, `channel_moderation_${action}`, {
      channelId: channel.id,
      targetUserId,
      reason,
      expiresAt: expiresAt?.toISOString() ?? null,
    }).catch(console.error);
    publishRealtimeEvent({
      type: "channel.moderation.updated",
      channelId: channel.id,
      occurredAt: new Date().toISOString(),
      data: { action, targetUserId, expiresAt: expiresAt?.toISOString() ?? null },
    }).catch(() => undefined);

    res.json(
      CreateChannelModerationActionResponse.parse({
        action,
        targetUserId,
        messageId: null,
        expiresAt,
      }),
    );
  },
);

router.post(
  "/channels/:id/reports",
  requireAuth,
  async (req, res): Promise<void> => {
    const params = CreateChannelChatReportParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    const body = CreateChannelChatReportBody.safeParse(req.body);
    if (!body.success) {
      res.status(400).json({ error: body.error.message });
      return;
    }

    const [channel] = await db
      .select({ id: channelsTable.id })
      .from(channelsTable)
      .where(eq(channelsTable.id, params.data.id))
      .limit(1);
    if (!channel) {
      res.status(404).json({ error: "Channel not found." });
      return;
    }

    const [message] = await db
      .select({ id: chatMessagesTable.id, userId: chatMessagesTable.userId, message: chatMessagesTable.message, createdAt: chatMessagesTable.createdAt })
      .from(chatMessagesTable)
      .where(and(eq(chatMessagesTable.id, body.data.messageId), eq(chatMessagesTable.channelId, channel.id), isNull(chatMessagesTable.deletedAt)))
      .limit(1);
    if (!message) {
      res.status(404).json({ error: "Chat message not found or no longer available for reporting." });
      return;
    }
    if (message.userId === req.user!.userId) {
      res.status(400).json({ error: "You cannot report your own chat message." });
      return;
    }

    const details = body.data.details?.trim() || null;
    const [caseRecord] = await db
      .insert(moderationCasesTable)
      .values({
        channelId: channel.id,
        reporterUserId: req.user!.userId,
        subjectUserId: message.userId,
        caseType: "chat_message_report",
        status: "open",
        summary: details ? `Viewer report: ${body.data.reason} — ${details}` : `Viewer report: ${body.data.reason}`,
        evidence: [{
          kind: "chat_message",
          messageId: message.id,
          message: message.message.slice(0, 500),
          createdAt: message.createdAt.toISOString(),
          reason: body.data.reason,
        }],
      })
      .returning();

    await writeAuditLog(req, {
      action: "chat_message_reported",
      targetType: "moderation_case",
      targetId: caseRecord.id,
      reason: body.data.reason,
      afterState: { channelId: channel.id, messageId: message.id, subjectUserId: message.userId, status: "open" },
    });
    logActivity(req, "chat_message_reported", { channelId: channel.id, messageId: message.id, caseId: caseRecord.id, reason: body.data.reason }).catch(() => undefined);

    res.status(201).json(CreateChannelChatReportResponse.parse({
      id: caseRecord.id,
      channelId: channel.id,
      messageId: message.id,
      subjectUserId: message.userId,
      status: "open",
      createdAt: caseRecord.createdAt,
    }));
  },
);

router.post(
  "/channels/:id/channel-reports",
  requireAuth,
  async (req, res): Promise<void> => {
    const params = CreateChannelChatReportParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    const body = CreateChannelSafetyReportBody.safeParse(req.body);
    if (!body.success) {
      res.status(400).json({ error: body.error.message });
      return;
    }

    const [channel] = await db
      .select({ id: channelsTable.id, ownerUserId: channelsTable.ownerUserId, slug: channelsTable.slug, displayName: channelsTable.displayName })
      .from(channelsTable)
      .where(eq(channelsTable.id, params.data.id))
      .limit(1);
    if (!channel) {
      res.status(404).json({ error: "Channel not found." });
      return;
    }
    if (channel.ownerUserId === req.user!.userId) {
      res.status(400).json({ error: "You cannot report your own channel." });
      return;
    }

    const details = body.data.details?.trim() || null;
    const [caseRecord] = await db
      .insert(moderationCasesTable)
      .values({
        channelId: channel.id,
        reporterUserId: req.user!.userId,
        subjectUserId: channel.ownerUserId,
        caseType: "channel_report",
        status: "open",
        summary: details ? `Viewer channel report: ${body.data.reason} — ${details}` : `Viewer channel report: ${body.data.reason}`,
        evidence: [{
          kind: "channel",
          channelId: channel.id,
          slug: channel.slug,
          displayName: channel.displayName,
          reason: body.data.reason,
          reportedAt: new Date().toISOString(),
        }],
      })
      .returning();

    await writeAuditLog(req, {
      action: "channel_reported",
      targetType: "moderation_case",
      targetId: caseRecord.id,
      reason: body.data.reason,
      afterState: { channelId: channel.id, subjectUserId: channel.ownerUserId, status: "open" },
    });
    logActivity(req, "channel_reported", { channelId: channel.id, caseId: caseRecord.id, reason: body.data.reason }).catch(() => undefined);

    res.status(201).json({
      id: caseRecord.id,
      channelId: channel.id,
      subjectUserId: channel.ownerUserId,
      status: "open",
      createdAt: caseRecord.createdAt,
    });
  },
);

router.get(
  "/channels/:id/messages",
  async (req, res): Promise<void> => {
    const params = ListChannelMessagesParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }

    const [channel] = await db
      .select()
      .from(channelsTable)
      .where(eq(channelsTable.id, params.data.id));
    if (!channel) {
      res.status(404).json({ error: "Channel not found" });
      return;
    }

    const cacheKey = messageListCacheKey(channel.id);
    const cached = await readSharedJson<unknown>(cacheKey);
    const cachedResponse = cached ? ListChannelMessagesResponse.safeParse(cached) : null;
    if (cachedResponse?.success) {
      res.json(cachedResponse.data);
      return;
    }

    const rows = await db
      .select({ message: chatMessagesTable, user: usersTable })
      .from(chatMessagesTable)
      .innerJoin(usersTable, eq(chatMessagesTable.userId, usersTable.id))
      .where(
        and(
          eq(chatMessagesTable.channelId, channel.id),
          isNull(chatMessagesTable.deletedAt),
        ),
      )
      .orderBy(asc(chatMessagesTable.createdAt), asc(chatMessagesTable.id))
      .limit(200);

    const response = ListChannelMessagesResponse.parse(
      rows.map((r) => ({
        id: r.message.id,
        channelId: r.message.channelId,
        userId: r.message.userId.toString(),
        username: r.user.username,
        avatarUrl: r.user.avatarUrl,
        message: r.message.message,
        createdAt: r.message.createdAt,
      })),
    );
    writeSharedJson(cacheKey, response, 5).catch(() => undefined);
    res.json(response);
  },
);

router.post(
  "/channels/:id/messages",
  requireAuth,
  async (req, res): Promise<void> => {
    const userId = req.user!.userId;
    const params = CreateChannelMessageParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    const parsed = CreateChannelMessageBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }

    const content = parsed.data.message.trim();
    if (!content) {
      res.status(400).json({ error: "Chat messages cannot be blank." });
      return;
    }

    const [channel] = await db
      .select()
      .from(channelsTable)
      .where(eq(channelsTable.id, params.data.id));
    if (!channel) {
      res.status(404).json({ error: "Channel not found" });
      return;
    }

    const [user] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, userId));
    if (!user) {
      res.status(401).json({ error: "User session is no longer valid." });
      return;
    }

    const actor = await getChannelActorRole(channel.id, channel.ownerUserId, userId);
    const activeBan = await findActiveRestriction(channelBansTable, channel.id, userId);
    if (activeBan) {
      res.status(403).json({ error: "You are banned from this channel's chat." });
      return;
    }

    const activeTimeout = await findActiveRestriction(chatTimeoutsTable, channel.id, userId);
    if (activeTimeout?.expiresAt) {
      res.status(403).json({
        error: "You are temporarily timed out from this channel's chat.",
        expiresAt: activeTimeout.expiresAt.toISOString(),
      });
      return;
    }

    if (!actor.isModerator && channel.chatFollowersOnly) {
      const [follow] = await db
        .select({ id: followsTable.id })
        .from(followsTable)
        .where(
          and(
            eq(followsTable.channelId, channel.id),
            eq(followsTable.followerUserId, userId),
          ),
        )
        .limit(1);
      if (!follow) {
        res.status(403).json({ error: "This channel is currently in followers-only chat mode." });
        return;
      }
    }

    if (!actor.isModerator && channel.chatSlowModeSeconds > 0) {
      const slowModeKey = `kryv:chat:slow:${channel.id}:${userId}`;
      const sharedState = getSharedStateClient();
      let reservedBySharedState = false;
      if (sharedState) {
        try {
          const result = await sharedState.set(slowModeKey, "1", "EX", channel.chatSlowModeSeconds, "NX");
          if (result === "OK") reservedBySharedState = true;
          else {
            const remainingSeconds = Math.max(1, await sharedState.ttl(slowModeKey));
            res.status(429).json({
              error: `Slow mode is active. Please wait ${remainingSeconds} second${remainingSeconds === 1 ? "" : "s"}.`,
              retryAfterSeconds: remainingSeconds,
            });
            return;
          }
        } catch {
          // Continue to the authoritative database fallback below if shared state is unavailable.
        }
      }

      if (!reservedBySharedState) {
        const [lastMessage] = await db
          .select({ createdAt: chatMessagesTable.createdAt })
          .from(chatMessagesTable)
          .where(
            and(
              eq(chatMessagesTable.channelId, channel.id),
              eq(chatMessagesTable.userId, userId),
              isNull(chatMessagesTable.deletedAt),
            ),
          )
          .orderBy(desc(chatMessagesTable.createdAt), desc(chatMessagesTable.id))
          .limit(1);

        if (lastMessage) {
          const nextAllowedAt = lastMessage.createdAt.getTime() + channel.chatSlowModeSeconds * 1000;
          const remainingSeconds = Math.ceil((nextAllowedAt - Date.now()) / 1000);
          if (remainingSeconds > 0) {
            res.status(429).json({
              error: `Slow mode is active. Please wait ${remainingSeconds} second${remainingSeconds === 1 ? "" : "s"}.`,
              retryAfterSeconds: remainingSeconds,
            });
            return;
          }
        }
      }
    }

    const [message] = await db
      .insert(chatMessagesTable)
      .values({
        channelId: channel.id,
        userId,
        message: content,
      })
      .returning();

    await db
      .update(streamSessionsTable)
      .set({ totalChatMessages: sql`${streamSessionsTable.totalChatMessages} + 1` })
      .where(
        and(
          eq(streamSessionsTable.channelId, channel.id),
          isNull(streamSessionsTable.endedAt),
        ),
      );

    const response = CreateChannelMessageResponse.parse({
      id: message.id,
      channelId: message.channelId,
      userId: message.userId.toString(),
      username: user.username,
      avatarUrl: user.avatarUrl,
      message: message.message,
      createdAt: message.createdAt,
    });
    deleteSharedKey(messageListCacheKey(channel.id)).catch(() => undefined);
    publishRealtimeEvent({
      type: "chat.message.created",
      channelId: channel.id,
      occurredAt: message.createdAt.toISOString(),
      data: response,
    }).catch(() => undefined);
    enqueueDurableJob({
      id: `chat-message:${message.id}`,
      type: "analytics.event",
      occurredAt: message.createdAt.toISOString(),
      payload: { event: "chat.message.created", channelId: channel.id, userId, messageId: message.id },
    }).catch(() => undefined);

    res.status(201).json(response);
  },
);

export default router;
