import { Router, type IRouter } from "express";
import { and, desc, eq, isNull, or, sql } from "drizzle-orm";
import { db, categoriesTable, channelsTable, moderationCasesTable, videoCommentsTable, videosTable, usersTable } from "@workspace/db";
import {
  ListVideosQueryParams,
  ListVideosResponse,
  CreateVideoBody,
  CreateVideoResponse,
  CreateVideoSafetyReportBody,
  CreateVideoSafetyReportParams,
  CreateVideoSafetyReportResponse,
  GetVideoParams,
  GetVideoResponse,
  UpdateVideoParams,
  UpdateVideoBody,
  UpdateVideoResponse,
  DeleteVideoCommentParams,
  DeleteVideoParams,
  CreateVideoCommentBody,
  CreateVideoCommentParams,
  CreateVideoCommentResponse,
  ListVideoCommentsParams,
  ListVideoCommentsResponse,
} from "@workspace/api-zod";
import { requireAuth, attachUserId } from "../lib/auth";
import { toVideoSummary, toVideoDetail } from "../lib/videoSerializer";
import { createFastPixDirectUpload, FastPixNotConfiguredError, getFastPixOnDemandMediaStatus } from "../lib/fastpix";
import { logActivity } from "../lib/tracking";
import { writeAuditLog } from "../lib/operations";
import { watchHistoryTable } from "@workspace/db";

const router: IRouter = Router();

router.get("/videos", attachUserId, async (req, res): Promise<void> => {
  const query = ListVideosQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }

  let rows = await db.select().from(videosTable);

  if (query.data.channelId !== undefined) {
    rows = rows.filter((v) => v.channelId === query.data.channelId);
  }
  if (query.data.contentType) {
    rows = rows.filter((v) => v.contentType === query.data.contentType);
  }
  if (query.data.search) {
    const needle = query.data.search.toLowerCase();
    rows = rows.filter((v) => v.title.toLowerCase().includes(needle));
  }
  if (query.data.categorySlug) {
    const [category] = await db
      .select()
      .from(categoriesTable)
      .where(eq(categoriesTable.slug, query.data.categorySlug));
    rows = category ? rows.filter((v) => v.categoryId === category.id) : [];
  }

  let ownChannelId: number | null = null;
  if (req.user?.userId) {
    const [ownChannel] = await db
      .select({ id: channelsTable.id })
      .from(channelsTable)
      .where(eq(channelsTable.ownerUserId, req.user.userId))
      .limit(1);
    ownChannelId = ownChannel?.id ?? null;
  }

  // Watch browse is public inventory: only ready creator uploads are public.
  // A signed-in channel owner may retain visibility of their own in-progress
  // uploads for Creator Studio, but no other unfinished or Cinema media leaks.
  rows = rows.filter((video) => (
    video.contentType === "upload"
    && (video.uploadStatus === "ready" || video.channelId === ownChannelId)
  ));

  const results = await Promise.all(rows.map(toVideoSummary));
  res.json(ListVideosResponse.parse(results));
});

router.post("/videos/:id/reports", requireAuth, async (req, res): Promise<void> => {
  const params = CreateVideoSafetyReportParams.safeParse(req.params);
  const body = CreateVideoSafetyReportBody.safeParse(req.body);
  if (!params.success || !body.success) {
    res.status(400).json({ error: !params.success ? params.error.message : body.error?.message ?? "Invalid request body" });
    return;
  }

  const [row] = await db
    .select({ video: videosTable, channel: channelsTable })
    .from(videosTable)
    .innerJoin(channelsTable, eq(videosTable.channelId, channelsTable.id))
    .where(and(eq(videosTable.id, params.data.id), eq(videosTable.contentType, "upload"), eq(videosTable.uploadStatus, "ready")))
    .limit(1);
  if (!row) {
    res.status(404).json({ error: "Published Watch video not found." });
    return;
  }
  if (row.channel.ownerUserId === req.user!.userId) {
    res.status(400).json({ error: "You cannot report your own Watch video." });
    return;
  }

  const details = body.data.details?.trim() || null;
  const [caseRecord] = await db
    .insert(moderationCasesTable)
    .values({
      channelId: row.channel.id,
      reporterUserId: req.user!.userId,
      subjectUserId: row.channel.ownerUserId,
      caseType: "video_report",
      status: "open",
      summary: details ? `Viewer Watch report: ${body.data.reason} — ${details}` : `Viewer Watch report: ${body.data.reason}`,
      evidence: [{
        kind: "watch_video",
        videoId: row.video.id,
        title: row.video.title,
        channelId: row.channel.id,
        channelSlug: row.channel.slug,
        reason: body.data.reason,
        reportedAt: new Date().toISOString(),
      }],
    })
    .returning();

  await writeAuditLog(req, {
    action: "video_reported",
    targetType: "moderation_case",
    targetId: caseRecord.id,
    reason: body.data.reason,
    afterState: { videoId: row.video.id, channelId: row.channel.id, subjectUserId: row.channel.ownerUserId, status: "open" },
  });
  logActivity(req, "video_reported", { videoId: row.video.id, channelId: row.channel.id, caseId: caseRecord.id, reason: body.data.reason }).catch(() => undefined);

  res.status(201).json(CreateVideoSafetyReportResponse.parse({
    id: caseRecord.id,
    videoId: row.video.id,
    channelId: row.channel.id,
    subjectUserId: row.channel.ownerUserId,
    status: "open",
    createdAt: caseRecord.createdAt.toISOString(),
  }));
});

router.post("/videos", requireAuth, async (req, res): Promise<void> => {
  const userId = req.user!.userId;
  const parsed = CreateVideoBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, userId));

  const [channel] = await db
    .select()
    .from(channelsTable)
    .where(eq(channelsTable.ownerUserId, userId));

  if (!channel) {
    res.status(403).json({ error: "Create a channel before uploading videos" });
    return;
  }

  if (parsed.data.contentType === "original") {
    // Cinema assets are intentionally never created through the general creator
    // upload API. The owner-only Cinema control room records provenance, rights,
    // provider processing, and audited publication state before a title can ship.
    res.status(403).json({ error: "Cinema assets can only be uploaded through the owner Cinema control room." });
    return;
  }

  const playbackSource = parsed.data.playbackSource ?? "fastpix";
  if (playbackSource === "youtube") {
    if (!parsed.data.youtubeVideoId || !parsed.data.rightsAttested) {
      res.status(400).json({ error: "An official YouTube video ID and rights attestation are required." });
      return;
    }

    const [video] = await db
      .insert(videosTable)
      .values({
        channelId: channel.id,
        title: parsed.data.title,
        description: parsed.data.description ?? null,
        categoryId: parsed.data.categoryId ?? null,
        contentType: "upload",
        uploadStatus: "ready",
        playbackSource: "youtube",
        youtubeVideoId: parsed.data.youtubeVideoId,
        rightsAttestedAt: new Date(),
      })
      .returning();
    const detail = await toVideoDetail(video, userId);
    res.status(201).json(CreateVideoResponse.parse({ ...detail, uploadUrl: null }));
    return;
  }

  let pendingVideo: typeof videosTable.$inferSelect | null = null;
  try {
    // A Kryv record is created first so the FastPix direct-upload session can carry
    // durable correlation metadata. That makes webhook delivery and manual recovery
    // deterministic even when a provider event arrives after an application restart.
    [pendingVideo] = await db
      .insert(videosTable)
      .values({
        channelId: channel.id,
        title: parsed.data.title,
        description: parsed.data.description ?? null,
        categoryId: parsed.data.categoryId ?? null,
        contentType: "upload",
        uploadStatus: "waiting",
        playbackSource: "fastpix",
      })
      .returning();

    const origin = req.get("origin") || "*";
    const { fastpixUploadId, uploadUrl } = await createFastPixDirectUpload({
      corsOrigin: origin,
      title: pendingVideo.title,
      metadata: {
        source: "kryv",
        kryv_surface: "watch",
        kryv_video_id: String(pendingVideo.id),
        kryv_channel_id: String(channel.id),
        kryv_owner_user_id: String(userId),
        kryv_playback_source: "fastpix",
      },
    });

    const [video] = await db
      .update(videosTable)
      .set({ fastpixUploadId })
      .where(eq(videosTable.id, pendingVideo.id))
      .returning();

    const detail = await toVideoDetail(video, userId);
    res.status(201).json(CreateVideoResponse.parse({ ...detail, uploadUrl }));
  } catch (err) {
    // No browser upload exists if FastPix cannot issue the signed session. Remove
    // the short-lived correlation record rather than leaving an unplayable release
    // in the creator library.
    if (pendingVideo) {
      await db.delete(videosTable).where(eq(videosTable.id, pendingVideo.id));
    }
    if (err instanceof FastPixNotConfiguredError) {
      res.status(503).json({ error: err.message });
      return;
    }
    throw err;
  }
});

router.get("/videos/:id/comments", async (req, res): Promise<void> => {
  const params = ListVideoCommentsParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [video] = await db
    .select({ id: videosTable.id })
    .from(videosTable)
    .where(and(eq(videosTable.id, params.data.id), eq(videosTable.contentType, "upload"), eq(videosTable.uploadStatus, "ready")))
    .limit(1);
  if (!video) {
    res.status(404).json({ error: "Published Watch video not found." });
    return;
  }

  const rows = await db
    .select({
      id: videoCommentsTable.id,
      videoId: videoCommentsTable.videoId,
      parentCommentId: videoCommentsTable.parentCommentId,
      userId: videoCommentsTable.userId,
      username: usersTable.username,
      avatarUrl: usersTable.avatarUrl,
      message: videoCommentsTable.message,
      createdAt: videoCommentsTable.createdAt,
    })
    .from(videoCommentsTable)
    .innerJoin(usersTable, eq(usersTable.id, videoCommentsTable.userId))
    .where(and(eq(videoCommentsTable.videoId, video.id), isNull(videoCommentsTable.deletedAt)))
    .orderBy(desc(videoCommentsTable.createdAt), desc(videoCommentsTable.id));

  type CommentNode = (typeof rows)[number] & { replies: Array<(typeof rows)[number] & { replies: [] }> };
  const parentComments = new Map<number, CommentNode>();
  const replyRows: Array<(typeof rows)[number]> = [];
  for (const row of rows) {
    if (row.parentCommentId === null) parentComments.set(row.id, { ...row, replies: [] });
    else replyRows.push(row);
  }
  for (const reply of replyRows) {
    const parent = parentComments.get(reply.parentCommentId!);
    if (parent) parent.replies.push({ ...reply, replies: [] });
  }

  res.json(ListVideoCommentsResponse.parse(Array.from(parentComments.values())));
});

router.post("/videos/:id/comments", requireAuth, async (req, res): Promise<void> => {
  const params = CreateVideoCommentParams.safeParse(req.params);
  const body = CreateVideoCommentBody.safeParse(req.body);
  if (!params.success || !body.success) {
    res.status(400).json({ error: !params.success ? params.error.message : body.error?.message ?? "Invalid comment body" });
    return;
  }

  const message = body.data.message.trim();
  if (!message) {
    res.status(400).json({ error: "A comment cannot be empty." });
    return;
  }

  const [video] = await db
    .select({ id: videosTable.id, channelId: videosTable.channelId })
    .from(videosTable)
    .where(and(eq(videosTable.id, params.data.id), eq(videosTable.contentType, "upload"), eq(videosTable.uploadStatus, "ready")))
    .limit(1);
  if (!video) {
    res.status(404).json({ error: "Published Watch video not found." });
    return;
  }

  if (body.data.parentCommentId) {
    const [parent] = await db
      .select({ videoId: videoCommentsTable.videoId, parentCommentId: videoCommentsTable.parentCommentId, deletedAt: videoCommentsTable.deletedAt })
      .from(videoCommentsTable)
      .where(eq(videoCommentsTable.id, body.data.parentCommentId))
      .limit(1);
    if (!parent || parent.videoId !== video.id || parent.deletedAt || parent.parentCommentId !== null) {
      res.status(400).json({ error: "Replies must target a visible top-level comment on this Watch release." });
      return;
    }
  }

  const [created] = await db
    .insert(videoCommentsTable)
    .values({
      videoId: video.id,
      channelId: video.channelId,
      userId: req.user!.userId,
      parentCommentId: body.data.parentCommentId ?? null,
      message,
    })
    .returning();
  const [author] = await db
    .select({ username: usersTable.username, avatarUrl: usersTable.avatarUrl })
    .from(usersTable)
    .where(eq(usersTable.id, created.userId))
    .limit(1);

  await writeAuditLog(req, {
    action: "video_comment_created",
    targetType: "video_comment",
    targetId: created.id,
    afterState: { videoId: video.id, parentCommentId: created.parentCommentId },
  });

  res.status(201).json(CreateVideoCommentResponse.parse({
    id: created.id,
    videoId: created.videoId,
    parentCommentId: created.parentCommentId,
    userId: created.userId,
    username: author?.username ?? "Kryv viewer",
    avatarUrl: author?.avatarUrl ?? null,
    message: created.message,
    createdAt: created.createdAt,
    replies: [],
  }));
});

router.delete("/videos/:id/comments/:commentId", requireAuth, async (req, res): Promise<void> => {
  const params = DeleteVideoCommentParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [comment] = await db
    .select({ comment: videoCommentsTable, channelOwnerUserId: channelsTable.ownerUserId })
    .from(videoCommentsTable)
    .innerJoin(channelsTable, eq(channelsTable.id, videoCommentsTable.channelId))
    .where(and(eq(videoCommentsTable.id, params.data.commentId), eq(videoCommentsTable.videoId, params.data.id)))
    .limit(1);
  if (!comment || comment.comment.deletedAt) {
    res.status(404).json({ error: "Watch comment not found." });
    return;
  }
  if (comment.comment.userId !== req.user!.userId && comment.channelOwnerUserId !== req.user!.userId) {
    res.status(403).json({ error: "Only the comment author or channel owner can remove this comment." });
    return;
  }

  const deletedAt = new Date();
  await db
    .update(videoCommentsTable)
    .set({ deletedAt, deletedByUserId: req.user!.userId })
    .where(or(eq(videoCommentsTable.id, comment.comment.id), eq(videoCommentsTable.parentCommentId, comment.comment.id)));

  await writeAuditLog(req, {
    action: "video_comment_deleted",
    targetType: "video_comment",
    targetId: comment.comment.id,
    afterState: { videoId: params.data.id, deletedAt: deletedAt.toISOString(), removedByChannelOwner: comment.channelOwnerUserId === req.user!.userId },
  });

  res.sendStatus(204);
});

router.post("/videos/:id/provider-status", requireAuth, async (req, res): Promise<void> => {
  const params = GetVideoParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [video] = await db
    .select()
    .from(videosTable)
    .where(eq(videosTable.id, params.data.id))
    .limit(1);
  if (!video) {
    res.status(404).json({ error: "Video not found" });
    return;
  }

  const [channel] = await db
    .select({ ownerUserId: channelsTable.ownerUserId })
    .from(channelsTable)
    .where(eq(channelsTable.id, video.channelId))
    .limit(1);
  const isChannelOwner = channel?.ownerUserId === req.user!.userId;
  const isPlatformOwner = req.user!.role === "owner";
  if (!isChannelOwner && !isPlatformOwner) {
    res.status(403).json({ error: "Only the channel owner or platform owner can refresh this media status." });
    return;
  }
  if (video.playbackSource !== "fastpix") {
    res.status(400).json({ error: "Only FastPix Watch uploads can refresh provider status." });
    return;
  }

  const providerReference = video.fastpixAssetId || video.fastpixUploadId;
  if (!providerReference) {
    res.status(409).json({ error: "This Watch release has no FastPix upload reference yet." });
    return;
  }

  try {
    const providerMedia = await getFastPixOnDemandMediaStatus(providerReference);
    // A Ready state without a playback ID is not publicly playable. Preserve a
    // processing state until FastPix returns the delivery credential required by
    // the Watch player instead of publishing a blank player shell.
    const uploadStatus = providerMedia.providerStatus === "ready" && providerMedia.fastpixPlaybackId
      ? "ready"
      : providerMedia.providerStatus === "errored"
        ? "errored"
        : "processing";
    const [updated] = await db
      .update(videosTable)
      .set({
        uploadStatus,
        ...(providerMedia.fastpixAssetId ? { fastpixAssetId: providerMedia.fastpixAssetId } : {}),
        ...(providerMedia.fastpixPlaybackId ? { fastpixPlaybackId: providerMedia.fastpixPlaybackId } : {}),
        ...(providerMedia.durationSeconds !== null ? { durationSeconds: providerMedia.durationSeconds } : {}),
        ...(providerMedia.thumbnailUrl ? { thumbnailUrl: providerMedia.thumbnailUrl } : {}),
      })
      .where(eq(videosTable.id, video.id))
      .returning();

    await writeAuditLog(req, {
      action: "video_provider_status_refreshed",
      targetType: "video",
      targetId: updated.id,
      afterState: {
        uploadStatus: updated.uploadStatus,
        providerStatus: providerMedia.providerStatus,
        hasPlaybackId: Boolean(updated.fastpixPlaybackId),
      },
    });

    res.json(GetVideoResponse.parse(await toVideoDetail(updated, req.user!.userId)));
  } catch (err) {
    if (err instanceof FastPixNotConfiguredError) {
      res.status(503).json({ error: err.message });
      return;
    }
    const message = err instanceof Error ? err.message : "Unable to read the FastPix media status.";
    res.status(502).json({ error: message });
  }
});

router.get("/videos/:id", attachUserId, async (req, res): Promise<void> => {
  const params = GetVideoParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [row] = await db
    .select({ video: videosTable, channel: channelsTable })
    .from(videosTable)
    .innerJoin(channelsTable, eq(videosTable.channelId, channelsTable.id))
    .where(eq(videosTable.id, params.data.id));
  if (!row) {
    res.status(404).json({ error: "Video not found" });
    return;
  }

  const viewerUserId = req.user?.userId;
  const isOwner = viewerUserId === row.channel.ownerUserId;
  const isPublicWatchVideo = row.video.contentType === "upload" && row.video.uploadStatus === "ready";
  if (!isPublicWatchVideo && !isOwner) {
    res.status(404).json({ error: "Video not found" });
    return;
  }
  const video = row.video;

  await db
    .update(videosTable)
    .set({ viewCount: sql`${videosTable.viewCount} + 1` })
    .where(eq(videosTable.id, video.id));
  video.viewCount += 1;

  if (viewerUserId) {
    // Record watch history (fire-and-forget)
    db.insert(watchHistoryTable)
      .values({ userId: viewerUserId, videoId: video.id })
      .onConflictDoUpdate({
        target: [watchHistoryTable.userId, watchHistoryTable.videoId],
        set: { watchedAt: new Date() },
      })
      .catch((err) => console.error("watchHistory update failed:", err));

    logActivity(req, "watch_video", { videoId: video.id }).catch((err) =>
      console.error("logActivity error:", err),
    );
  }

  res.json(GetVideoResponse.parse(await toVideoDetail(video, viewerUserId)));
});

router.patch("/videos/:id", requireAuth, async (req, res): Promise<void> => {
  const userId = req.user!.userId;
  const params = UpdateVideoParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdateVideoBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [video] = await db
    .select()
    .from(videosTable)
    .where(eq(videosTable.id, params.data.id));
  if (!video) {
    res.status(404).json({ error: "Video not found" });
    return;
  }

  const [channel] = await db
    .select()
    .from(channelsTable)
    .where(eq(channelsTable.id, video.channelId));
  if (channel?.ownerUserId !== userId) {
    res.status(403).json({ error: "Not the video owner" });
    return;
  }

  const [updated] = await db
    .update(videosTable)
    .set(parsed.data)
    .where(eq(videosTable.id, video.id))
    .returning();

  res.json(UpdateVideoResponse.parse(await toVideoDetail(updated, userId)));
});

router.delete("/videos/:id", requireAuth, async (req, res): Promise<void> => {
  const userId = req.user!.userId;
  const params = DeleteVideoParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [video] = await db
    .select()
    .from(videosTable)
    .where(eq(videosTable.id, params.data.id));
  if (!video) {
    res.status(404).json({ error: "Video not found" });
    return;
  }

  const [channel] = await db
    .select()
    .from(channelsTable)
    .where(eq(channelsTable.id, video.channelId));
  if (channel?.ownerUserId !== userId) {
    res.status(403).json({ error: "Not the video owner" });
    return;
  }

  await db.delete(videosTable).where(eq(videosTable.id, video.id));
  res.sendStatus(204);
});

export default router;
