import { Router, type IRouter } from "express";
import { and, desc, eq, sql } from "drizzle-orm";
import { channelsTable, clipsTable, db, videosTable } from "@workspace/db";
import {
  CreateClipBody,
  CreateClipResponse,
  GetClipParams,
  GetClipResponse,
  ListClipsQueryParams,
  ListClipsResponse,
} from "@workspace/api-zod";
import { requireAuth } from "../lib/auth";
import { createFastPixClip, FastPixNotConfiguredError } from "../lib/fastpix";
import { logActivity } from "../lib/tracking";

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
  if (query.data.channelId !== undefined) {
    conditions.push(eq(clipsTable.channelId, query.data.channelId));
  }

  const rows = await db
    .select(clipSelection)
    .from(clipsTable)
    .innerJoin(channelsTable, eq(clipsTable.channelId, channelsTable.id))
    .where(and(...conditions))
    .orderBy(desc(clipsTable.createdAt))
    .limit(50);

  res.json(ListClipsResponse.parse(rows.map(toClipSummary)));
});

router.post("/clips", requireAuth, async (req, res): Promise<void> => {
  const userId = req.user!.userId;
  const body = CreateClipBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
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

  const [source] = await db
    .select({ video: videosTable, channel: channelsTable })
    .from(videosTable)
    .innerJoin(channelsTable, eq(videosTable.channelId, channelsTable.id))
    .where(eq(videosTable.id, body.data.videoId));
  if (!source) {
    res.status(404).json({ error: "Source video not found." });
    return;
  }
  if (source.channel.ownerUserId !== userId) {
    res.status(403).json({ error: "Only the source video's channel owner can create a clip." });
    return;
  }
  if (source.video.uploadStatus !== "ready" || !source.video.fastpixAssetId) {
    res.status(400).json({ error: "The source video is not ready for clipping yet." });
    return;
  }

  const requestedDuration = body.data.endTime - body.data.startTime;
  if (requestedDuration > MAX_CLIP_DURATION_SECONDS) {
    res.status(400).json({ error: `Clips are limited to ${MAX_CLIP_DURATION_SECONDS} seconds.` });
    return;
  }
  if (source.video.durationSeconds !== null && body.data.endTime > source.video.durationSeconds) {
    res.status(400).json({ error: "Clip end time is beyond the source video's duration." });
    return;
  }

  const requestId = crypto.randomUUID();
  try {
    const fastpixClip = await createFastPixClip({
      sourceMediaId: source.video.fastpixAssetId,
      startTime: body.data.startTime,
      endTime: body.data.endTime,
      title,
      requestId,
    });

    const [clip] = await db
      .insert(clipsTable)
      .values({
        creatorUserId: userId,
        channelId: source.channel.id,
        videoId: source.video.id,
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
      videoId: source.video.id,
      channelId: source.channel.id,
      requestedDuration,
    }).catch(console.error);

    res.status(201).json(
      CreateClipResponse.parse(
        toClipSummary({ clip, channel: source.channel }),
      ),
    );
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
    .where(
      and(
        eq(clipsTable.id, params.data.id),
        eq(clipsTable.isPublished, true),
        eq(clipsTable.processingStatus, "ready"),
      ),
    );
  if (!row) {
    res.status(404).json({ error: "Clip not found or still processing." });
    return;
  }

  await db
    .update(clipsTable)
    .set({ viewCount: sql`${clipsTable.viewCount} + 1` })
    .where(eq(clipsTable.id, row.clip.id));

  res.json(
    GetClipResponse.parse({
      ...toClipSummary(row),
      viewCount: row.clip.viewCount + 1,
    }),
  );
});

export default router;
