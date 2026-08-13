import { Router, type IRouter } from "express";
import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { channelsTable, clipsTable, db, moderationCasesTable, streamSessionsTable, videosTable } from "@workspace/db";
import {
  CreateClipBody,
  CreateClipResponse,
  CreateClipSafetyReportBody,
  CreateClipSafetyReportParams,
  CreateClipSafetyReportResponse,
  GetClipParams,
  GetClipResponse,
  ListClipsQueryParams,
  ListClipsResponse,
} from "@workspace/api-zod";
import { requireAuth } from "../lib/auth";
import { createFastPixClip, createFastPixLiveClip, FastPixNotConfiguredError } from "../lib/fastpix";
import { enqueueDurableJob } from "../lib/jobs";
import { logActivity } from "../lib/tracking";
import { writeAuditLog } from "../lib/operations";

const router: IRouter = Router();
const MAX_CLIP_DURATION_SECONDS = 180;

type ClipRow = {
  clip: typeof clipsTable.$inferSelect;
  channel: Pick<typeof channelsTable.$inferSelect, "id" | "displayName" | "slug">;
};

function toClipSummary(row: ClipRow) {
  return {
    id: row.clip.id,
    title: row.clip.title,
    thumbnailUrl: row.clip.thumbnailUrl,
    durationSeconds: row.clip.durationSeconds,
    viewCount: row.clip.viewCount,
    channelId: row.channel.id,
    channelName: row.channel.displayName,
    channelSlug: row.channel.slug,
    processingStatus: row.clip.processingStatus as "processing" | "ready" | "errored",
    playbackId: row.clip.processingStatus === "ready" ? row.clip.fastpixPlaybackId : null,
    createdAt: row.clip.createdAt,
  };
}

const clipSelection = {
  clip: clipsTable,
  channel: {
    id: channelsTable.id,
    displayName: channelsTable.displayName,
    slug: channelsTable.slug,
  },
};

router.get("/clips", async (req, res): Promise<void> => {
  const query = ListClipsQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }

  const conditions = [
    eq(clipsTable.isPublished, true),
    eq(clipsTable.processingStatus, "ready"),
  ];
  if (query.data.channelId !== undefined) conditions.push(eq(clipsTable.channelId, query.data.channelId));

  const rows = await db
    .select(clipSelection)
    .from(clipsTable)
    .innerJoin(channelsTable, eq(clipsTable.channelId, channelsTable.id))
    .where(and(...conditions))
    .orderBy(desc(clipsTable.createdAt))
    .limit(50);

  res.json(ListClipsResponse.parse(rows.map(toClipSummary)));
});

router.post("/clips/:id/reports", requireAuth, async (req, res): Promise<void> => {
  const params = CreateClipSafetyReportParams.safeParse(req.params);
  const body = CreateClipSafetyReportBody.safeParse(req.body);
  if (!params.success || !body.success) {
    res.status(400).json({ error: !params.success ? params.error.message : body.error.message });
    return;
  }

  const [row] = await db
    .select({ clip: clipsTable, channel: channelsTable })
    .from(clipsTable)
    .innerJoin(channelsTable, eq(clipsTable.channelId, channelsTable.id))
    .where(and(eq(clipsTable.id, params.data.id), eq(clipsTable.isPublished, true), eq(clipsTable.processingStatus, "ready")))
    .limit(1);
  if (!row) {
    res.status(404).json({ error: "Published clip not found." });
    return;
  }
  if (row.clip.creatorUserId === req.user!.userId) {
    res.status(400).json({ error: "You cannot report your own clip." });
    return;
  }

  const details = body.data.details?.trim() || null;
  const [caseRecord] = await db
    .insert(moderationCasesTable)
    .values({
      channelId: row.channel.id,
      reporterUserId: req.user!.userId,
      subjectUserId: row.clip.creatorUserId,
      caseType: "clip_report",
      status: "open",
      summary: details ? `Viewer clip report: ${body.data.reason} — ${details}` : `Viewer clip report: ${body.data.reason}`,
      evidence: [{
        kind: "clip",
        clipId: row.clip.id,
        title: row.clip.title,
        channelId: row.channel.id,
        channelSlug: row.channel.slug,
        reason: body.data.reason,
        reportedAt: new Date().toISOString(),
      }],
    })
    .returning();

  await writeAuditLog(req, {
    action: "clip_reported",
    targetType: "moderation_case",
    targetId: caseRecord.id,
    reason: body.data.reason,
    afterState: { clipId: row.clip.id, channelId: row.channel.id, subjectUserId: row.clip.creatorUserId, status: "open" },
  });
  logActivity(req, "clip_reported", { clipId: row.clip.id, channelId: row.channel.id, caseId: caseRecord.id, reason: body.data.reason }).catch(() => undefined);

  res.status(201).json(CreateClipSafetyReportResponse.parse({
    id: caseRecord.id,
    clipId: row.clip.id,
    channelId: row.channel.id,
    subjectUserId: row.clip.creatorUserId,
    status: "open",
    createdAt: caseRecord.createdAt.toISOString(),
  }));
});

router.post("/clips", requireAuth, async (req, res): Promise<void> => {
  const userId = req.user!.userId;
  const body = CreateClipBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }

  const hasVideoSource = body.data.videoId !== undefined;
  const hasLiveSource = body.data.channelId !== undefined;
  if (hasVideoSource === hasLiveSource) {
    res.status(400).json({ error: "Choose exactly one ready VOD or active live channel clip source." });
    return;
  }

  const title = body.data.title.trim();
  if (!title) {
    res.status(400).json({ error: "A clip title is required." });
    return;
  }
  if (body.data.endTime <= body.data.startTime) {
    res.status(400).json({ error: "Clip end time must be after its start time." });
    return;
  }
  const requestedDuration = body.data.endTime - body.data.startTime;
  if (requestedDuration > MAX_CLIP_DURATION_SECONDS) {
    res.status(400).json({ error: `Clips are limited to ${MAX_CLIP_DURATION_SECONDS} seconds.` });
    return;
  }

  let channel: typeof channelsTable.$inferSelect;
  let sourceVideo: typeof videosTable.$inferSelect | null = null;
  let livePlaybackId: string | null = null;

  if (hasVideoSource) {
    const [source] = await db
      .select({ video: videosTable, channel: channelsTable })
      .from(videosTable)
      .innerJoin(channelsTable, eq(videosTable.channelId, channelsTable.id))
      .where(eq(videosTable.id, body.data.videoId!));
    if (!source) {
      res.status(404).json({ error: "Source video not found." });
      return;
    }
    if (source.channel.ownerUserId !== userId) {
      res.status(403).json({ error: "Only the source video's channel owner can create a VOD clip." });
      return;
    }
    if (source.video.uploadStatus !== "ready" || !source.video.fastpixAssetId) {
      res.status(400).json({ error: "The source video is not ready for clipping yet." });
      return;
    }
    if (source.video.durationSeconds !== null && body.data.endTime > source.video.durationSeconds) {
      res.status(400).json({ error: "Clip end time is beyond the source video's duration." });
      return;
    }
    channel = source.channel;
    sourceVideo = source.video;
  } else {
    const [liveChannel] = await db
      .select()
      .from(channelsTable)
      .where(eq(channelsTable.id, body.data.channelId!));
    if (!liveChannel) {
      res.status(404).json({ error: "Live channel not found." });
      return;
    }
    if (!liveChannel.isLive || !liveChannel.fastpixPlaybackId) {
      res.status(409).json({ error: "This channel is not actively available for live clipping." });
      return;
    }
    const [session] = await db
      .select({ startedAt: streamSessionsTable.startedAt })
      .from(streamSessionsTable)
      .where(and(eq(streamSessionsTable.channelId, liveChannel.id), isNull(streamSessionsTable.endedAt)))
      .orderBy(desc(streamSessionsTable.startedAt))
      .limit(1);
    const liveSeconds = session ? Math.floor((Date.now() - session.startedAt.getTime()) / 1_000) : 0;
    if (!session || body.data.endTime > liveSeconds) {
      res.status(400).json({ error: "The requested live clip extends beyond the active broadcast timeline." });
      return;
    }
    channel = liveChannel;
    livePlaybackId = liveChannel.fastpixPlaybackId;
  }

  const requestId = crypto.randomUUID();
  try {
    const fastpixClip = sourceVideo
      ? await createFastPixClip({
          sourceMediaId: sourceVideo.fastpixAssetId!,
          startTime: body.data.startTime,
          endTime: body.data.endTime,
          title,
          requestId,
        })
      : await createFastPixLiveClip({
          playbackId: livePlaybackId!,
          startTime: body.data.startTime,
          endTime: body.data.endTime,
          title,
          requestId,
        });

    const [clip] = await db
      .insert(clipsTable)
      .values({
        creatorUserId: userId,
        channelId: channel.id,
        videoId: sourceVideo?.id ?? null,
        fastpixRequestId: requestId,
        fastpixMediaId: fastpixClip.fastpixMediaId,
        fastpixPlaybackId: fastpixClip.fastpixPlaybackId,
        processingStatus: "processing",
        title,
        thumbnailUrl: fastpixClip.thumbnailUrl,
        durationSeconds: Math.round(requestedDuration),
        startOffsetSeconds: Math.floor(body.data.startTime),
        endOffsetSeconds: Math.ceil(body.data.endTime),
        isPublished: false,
      })
      .returning();

    logActivity(req, "clip_requested", {
      clipId: clip.id,
      videoId: sourceVideo?.id ?? null,
      channelId: channel.id,
      sourceKind: sourceVideo ? "vod_owner" : "live_viewer",
      requestedDuration,
    }).catch(console.error);
    enqueueDurableJob({
      id: `clip-request:${clip.id}`,
      type: "analytics.event",
      occurredAt: clip.createdAt.toISOString(),
      payload: { event: "clip.requested", clipId: clip.id, channelId: channel.id, sourceKind: sourceVideo ? "vod_owner" : "live_viewer", requestedDuration },
    }).catch(() => undefined);

    res.status(201).json(CreateClipResponse.parse(toClipSummary({ clip, channel })));
  } catch (error) {
    if (error instanceof FastPixNotConfiguredError) {
      res.status(503).json({ error: "FastPix is not configured for clip creation." });
      return;
    }

    console.error("FastPix clip creation failed", error);
    res.status(502).json({ error: "FastPix could not begin processing this clip. Please try again." });
  }
});

router.get("/clips/:id", async (req, res): Promise<void> => {
  const params = GetClipParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [row] = await db
    .select(clipSelection)
    .from(clipsTable)
    .innerJoin(channelsTable, eq(clipsTable.channelId, channelsTable.id))
    .where(and(eq(clipsTable.id, params.data.id), eq(clipsTable.isPublished, true), eq(clipsTable.processingStatus, "ready")));
  if (!row) {
    res.status(404).json({ error: "Clip not found or still processing." });
    return;
  }

  await db.update(clipsTable).set({ viewCount: sql`${clipsTable.viewCount} + 1` }).where(eq(clipsTable.id, row.clip.id));
  res.json(GetClipResponse.parse({ ...toClipSummary(row), viewCount: row.clip.viewCount + 1 }));
});

export default router;
