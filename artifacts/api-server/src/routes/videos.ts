import { Router, type IRouter } from "express";
import { and, eq, sql } from "drizzle-orm";
import { db, categoriesTable, channelsTable, moderationCasesTable, videosTable, usersTable } from "@workspace/db";
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
  DeleteVideoParams,
} from "@workspace/api-zod";
import { requireAuth, attachUserId } from "../lib/auth";
import { toVideoSummary, toVideoDetail } from "../lib/videoSerializer";
import { createFastPixDirectUpload, FastPixNotConfiguredError } from "../lib/fastpix";
import { logActivity } from "../lib/tracking";
import { writeAuditLog } from "../lib/operations";
import { watchHistoryTable } from "@workspace/db";

const router: IRouter = Router();

router.get("/videos", async (req, res): Promise<void> => {
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

  rows = rows.filter((v) => v.uploadStatus !== "errored");

  const results = await Promise.all(rows.map(toVideoSummary));
  res.json(ListVideosResponse.parse(results));
});

router.post("/videos/:id/reports", requireAuth, async (req, res): Promise<void> => {
  const params = CreateVideoSafetyReportParams.safeParse(req.params);
  const body = CreateVideoSafetyReportBody.safeParse(req.body);
  if (!params.success || !body.success) {
    res.status(400).json({ error: !params.success ? params.error.message : body.error.message });
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

  try {
    const origin = req.get("origin") || "*";
    const { fastpixUploadId, uploadUrl } = await createFastPixDirectUpload(origin);

    const [video] = await db
      .insert(videosTable)
      .values({
        channelId: channel.id,
        title: parsed.data.title,
        description: parsed.data.description ?? null,
        categoryId: parsed.data.categoryId ?? null,
        contentType: "upload",
        uploadStatus: "waiting",
        playbackSource: "fastpix",
        fastpixUploadId,
      })
      .returning();

    const detail = await toVideoDetail(video, userId);
    res.status(201).json(CreateVideoResponse.parse({ ...detail, uploadUrl }));
  } catch (err) {
    if (err instanceof FastPixNotConfiguredError) {
      res.status(503).json({ error: err.message });
      return;
    }
    throw err;
  }
});

router.get("/videos/:id", attachUserId, async (req, res): Promise<void> => {
  const params = GetVideoParams.safeParse(req.params);
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

  await db
    .update(videosTable)
    .set({ viewCount: sql`${videosTable.viewCount} + 1` })
    .where(eq(videosTable.id, video.id));
  video.viewCount += 1;

  const viewerUserId = req.user?.userId;

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
