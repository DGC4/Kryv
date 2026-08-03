import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import Mux from "@mux/mux-node";
import { db, channelsTable, videosTable } from "@workspace/db";
import { logger } from "../lib/logger";
import { fastpix } from "../lib/fastpix";

const router: IRouter = Router();

/**
 * Mux delivers live-stream state changes and on-demand asset processing
 * events here. Configure this URL (`https://<your-domain>/api/webhooks/mux`)
 * in the Mux dashboard, with MUX_WEBHOOK_SECRET set to the signing secret.
 */
router.post("/webhooks/mux", async (req, res): Promise<void> => {
  const rawBody = req.body as Buffer;
  const webhookSecret = process.env.MUX_WEBHOOK_SECRET;

  let event: { type: string; data: Record<string, unknown> };
  try {
    if (webhookSecret) {
      const mux = new Mux({
        tokenId: process.env.MUX_TOKEN_ID || "unset",
        tokenSecret: process.env.MUX_TOKEN_SECRET || "unset",
      });
      event = (await mux.webhooks.unwrap(
        rawBody.toString("utf8"),
        req.headers as Record<string, string>,
        webhookSecret,
      )) as unknown as typeof event;
    } else {
      logger.warn(
        "MUX_WEBHOOK_SECRET not set — accepting webhook payload unverified",
      );
      event = JSON.parse(rawBody.toString("utf8"));
    }
  } catch (err) {
    logger.warn({ err }, "Rejected Mux webhook — signature verification failed");
    res.status(400).json({ error: "Invalid signature" });
    return;
  }

  logger.info({ type: event.type }, "Received Mux webhook");

  switch (event.type) {
    case "video.live_stream.active": {
      const liveStreamId = event.data.id as string;
      await db
        .update(channelsTable)
        .set({ isLive: true })
        .where(eq(channelsTable.muxLiveStreamId, liveStreamId));
      break;
    }
    case "video.live_stream.idle":
    case "video.live_stream.disconnected": {
      const liveStreamId = event.data.id as string;
      await db
        .update(channelsTable)
        .set({ isLive: false, viewerCount: 0 })
        .where(eq(channelsTable.muxLiveStreamId, liveStreamId));
      break;
    }
    case "video.asset.ready": {
      const asset = event.data as {
        id: string;
        duration?: number;
        upload_id?: string;
        playback_ids?: { id: string }[];
      };
      const playbackId = asset.playback_ids?.[0]?.id ?? null;
      if (asset.upload_id) {
        await db
          .update(videosTable)
          .set({
            uploadStatus: "ready",
            muxAssetId: asset.id,
            muxPlaybackId: playbackId,
            durationSeconds: asset.duration
              ? Math.round(asset.duration)
              : null,
          })
          .where(eq(videosTable.muxUploadId, asset.upload_id));
      }
      break;
    }
    case "video.asset.errored": {
      const asset = event.data as { upload_id?: string };
      if (asset.upload_id) {
        await db
          .update(videosTable)
          .set({ uploadStatus: "errored" })
          .where(eq(videosTable.muxUploadId, asset.upload_id));
      }
      break;
    }
    case "video.upload.asset_created": {
      const upload = event.data as { id: string; asset_id?: string };
      await db
        .update(videosTable)
        .set({ uploadStatus: "processing", muxAssetId: upload.asset_id })
        .where(eq(videosTable.muxUploadId, upload.id));
      break;
    }
    default:
      break;
  }

  res.status(200).json({ received: true });
});

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
      await db
        .update(channelsTable)
        .set({
          isLive: true,
          ...(playbackId ? { fastpixPlaybackId: playbackId } : {}),
        })
        .where(eq(channelsTable.fastpixLiveStreamId, liveStream.id));
      break;
    }

    // ── Live stream went offline ───────────────────────────────────────────
    case "video.live_stream.disconnected":
    case "video.live_stream.idle": {
      const liveStream = event.data;
      await db
        .update(channelsTable)
        .set({ isLive: false, viewerCount: 0 })
        .where(eq(channelsTable.fastpixLiveStreamId, liveStream.id));
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
