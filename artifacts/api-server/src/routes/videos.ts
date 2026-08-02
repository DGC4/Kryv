import { Router, type IRouter } from "express";
import { eq, sql } from "drizzle-orm";
import { db, categoriesTable, channelsTable, videosTable } from "@workspace/db";
import {
  ListVideosQueryParams,
  ListVideosResponse,
  CreateVideoBody,
  CreateVideoResponse,
  GetVideoParams,
  GetVideoResponse,
  UpdateVideoParams,
  UpdateVideoBody,
  UpdateVideoResponse,
  DeleteVideoParams,
} from "@workspace/api-zod";
import { requireAuth, attachUserId, getOrCreateUser } from "../lib/auth";
import { toVideoSummary, toVideoDetail } from "../lib/videoSerializer";
import { createMuxDirectUpload, MuxNotConfiguredError } from "../lib/mux";
import { logger } from "../lib/logger";

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

  // Only surface videos that finished processing, or are still owned uploads in progress.
  rows = rows.filter((v) => v.uploadStatus !== "errored");

  const results = await Promise.all(rows.map(toVideoSummary));
  res.json(ListVideosResponse.parse(results));
});

router.post("/videos", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as typeof req & { userId: string }).userId;
  const parsed = CreateVideoBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const user = await getOrCreateUser(userId);
  const [channel] = await db
    .select()
    .from(channelsTable)
    .where(eq(channelsTable.ownerUserId, userId));

  if (!channel) {
    res.status(403).json({ error: "Create a channel before uploading videos" });
    return;
  }

  // Lock 'original' content type to owner only.
  if (parsed.data.contentType === "original" && user.role !== "owner") {
    res.status(403).json({ error: "Only cinema staff can post original content." });
    return;
  }

  try {
    const origin = req.get("origin") || "*";
    const { muxUploadId, uploadUrl } = await createMuxDirectUpload(origin);

    const [video] = await db
      .insert(videosTable)
      .values({
        channelId: channel.id,
        title: parsed.data.title,
        description: parsed.data.description ?? null,
        categoryId: parsed.data.categoryId ?? null,
        contentType: parsed.data.contentType ?? "upload",
        uploadStatus: "waiting",
        muxUploadId,
      })
      .returning();

    const detail = await toVideoDetail(video, userId);
    res.status(201).json(CreateVideoResponse.parse({ ...detail, uploadUrl }));
  } catch (err) {
    if (err instanceof MuxNotConfiguredError) {
      logger.warn("Mux not configured — cannot start video upload");
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

  const viewerUserId = (req as typeof req & { userId?: string }).userId;
  res.json(GetVideoResponse.parse(await toVideoDetail(video, viewerUserId)));
});

router.patch("/videos/:id", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as typeof req & { userId: string }).userId;
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
  const userId = (req as typeof req & { userId: string }).userId;
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
