import { Router, type IRouter } from "express";
import { eq, and, sql } from "drizzle-orm";

import { db, channelsTable, videosTable, streamSessionsTable } from "@workspace/db";
import { logger } from "../lib/logger";
import { fastpix } from "../lib/fastpix";

const router: IRouter = Router();



/**
 * FastPix delivers live-stream state changes and on-demand asset processing
 * events here.
 *
 * Configure this URL in the FastPix dashboard:
 *   https://kryv-backend.onrender.com/api/webhooks/fastpix
 *
 * Set FASTPIX_WEBHOOK_SECRET in Render environment variables to the signing
 * secret shown in the FastPix dashboard so every event is verified.
 *
 * FastPix event types handled:
 *   video.live_stream.connected    — broadcaster connected, mark channel live
 *   video.live_stream.active       — stream is active/live
 *   video.live_stream.disconnected — broadcaster disconnected
 *   video.live_stream.idle         — stream went idle
 *   video.live_stream.updated      — generic status update
 *   video.live_stream.deleted      — stream deleted
 *   video.media.created            — upload started processing
 *   video.media.ready              — upload finished, playback available
 *   video.media.failed             — upload failed
 */
router.post("/webhooks/fastpix", async (req, res): Promise<void> => {
  const rawBody = req.body as Buffer;
  const webhookSecret = process.env.FASTPIX_WEBHOOK_SECRET;

  let event: any;
  try {
    const bodyStr = Buffer.isBuffer(rawBody) ? rawBody.toString("utf8") : String(rawBody);

    if (webhookSecret) {
      // Use FastPix SDK signature verification
      event = fastpix.webhooks.unwrap(
        bodyStr,
        req.headers as Record<string, string>
      );
    } else {
      // No secret configured — accept unverified (log a warning)
      logger.warn("FASTPIX_WEBHOOK_SECRET not set — accepting FastPix webhook unverified");
      event = JSON.parse(bodyStr);
    }
  } catch (err) {
    logger.warn({ err }, "Rejected FastPix webhook — signature verification failed");
    res.status(400).json({ error: "Invalid signature" });
    return;
  }

  logger.info({ type: event.type }, "Received FastPix webhook");

  switch (event.type) {
    // ── Live stream went active (broadcaster connected and streaming) ──────
    case "video.live_stream.connected":
    case "video.live_stream.active": {
      const liveStream = event.data;
      const playbackId = liveStream.playbackIds?.[0]?.id ?? null;

      // Find the channel and update it to live
      const [updatedChannel] = await db
        .update(channelsTable)
        .set({
          isLive: true,
          lastStreamAt: new Date(),
          totalStreamCount: sql`${channelsTable.totalStreamCount} + 1`,
          ...(playbackId ? { fastpixPlaybackId: playbackId } : {}),
        })
        .where(eq(channelsTable.fastpixLiveStreamId, liveStream.id))
        .returning();

      // Create a stream session record for analytics (Kick/Twitch-style stream history)
      if (updatedChannel) {
        await db.insert(streamSessionsTable).values({
          channelId: updatedChannel.id,
          startedAt: new Date(),
          title: updatedChannel.streamTitle ?? null,
          categoryId: updatedChannel.categoryId ?? null,
          streamKey: updatedChannel.fastpixStreamKey ?? null,
        }).onConflictDoNothing();
      }
      break;
    }

    // ── Live stream went offline ───────────────────────────────────────────
    case "video.live_stream.disconnected":
    case "video.live_stream.idle": {
      const liveStream = event.data;

      // Find the channel to get its ID for session closure
      const [offlineChannel] = await db
        .update(channelsTable)
        .set({ isLive: false, viewerCount: 0 })
        .where(eq(channelsTable.fastpixLiveStreamId, liveStream.id))
        .returning();

      // Close the most recent open stream session
      if (offlineChannel) {
        const now = new Date();
        await db
          .update(streamSessionsTable)
          .set({
            endedAt: now,
            durationSeconds: sql`EXTRACT(EPOCH FROM (${now.toISOString()} - started_at))::integer`,
          })
          .where(
            and(
              eq(streamSessionsTable.channelId, offlineChannel.id),
              sql`${streamSessionsTable.endedAt} IS NULL`,
            )
          );
      }
      break;
    }

    // ── Generic status update (check status field) ─────────────────────────
    case "video.live_stream.updated": {
      const liveStream = event.data;
      const isLive = liveStream.status === "active" || liveStream.status === "connected";
      const playbackId = liveStream.playbackIds?.[0]?.id ?? null;
      await db
        .update(channelsTable)
        .set({
          isLive,
          viewerCount: isLive ? (liveStream.viewerCount ?? 0) : 0,
          ...(playbackId ? { fastpixPlaybackId: playbackId } : {}),
        })
        .where(eq(channelsTable.fastpixLiveStreamId, liveStream.id));
      break;
    }

    // ── Stream deleted ─────────────────────────────────────────────────────
    case "video.live_stream.deleted": {
      const liveStream = event.data;
      await db
        .update(channelsTable)
        .set({ isLive: false, viewerCount: 0 })
        .where(eq(channelsTable.fastpixLiveStreamId, liveStream.id));
      break;
    }

    // ── VOD / upload processing ────────────────────────────────────────────
    case "video.media.ready": {
      const media = event.data;
      const playbackId = media.playbackIds?.[0]?.id ?? null;
      const uploadId = media.uploadId ?? (media as any).upload_id;
      if (uploadId) {
        await db
          .update(videosTable)
          .set({
            uploadStatus: "ready",
            fastpixAssetId: media.id,
            fastpixPlaybackId: playbackId,
            durationSeconds: media.duration ? Math.round(media.duration) : null,
          })
          .where(eq(videosTable.fastpixUploadId, uploadId));
      }
      break;
    }

    case "video.media.failed": {
      const media = event.data;
      const uploadId = media.uploadId ?? (media as any).upload_id;
      if (uploadId) {
        await db
          .update(videosTable)
          .set({ uploadStatus: "errored" })
          .where(eq(videosTable.fastpixUploadId, uploadId));
      }
      break;
    }

    case "video.media.created": {
      const media = event.data;
      const uploadId = media.uploadId ?? (media as any).upload_id;
      if (uploadId) {
        await db
          .update(videosTable)
          .set({ uploadStatus: "processing", fastpixAssetId: media.id })
          .where(eq(videosTable.fastpixUploadId, uploadId));
      }
      break;
    }

    default:
      logger.info({ type: event.type }, "Unhandled FastPix webhook event — ignored");
      break;
  }

  res.status(200).json({ received: true });
});

export default router;
