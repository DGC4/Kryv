import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import Mux from "@mux/mux-node";
import { db, channelsTable, videosTable } from "@workspace/db";
import { logger } from "../lib/logger";

const router: IRouter = Router();

/**
 * Mux delivers live-stream state changes and on-demand asset processing
 * events here. Configure this URL (`https://<your-domain>/api/webhooks/mux`)
 * in the Mux dashboard, with MUX_WEBHOOK_SECRET set to the signing secret
 * shown there, so isLive / playback state stay in sync with real broadcasts
 * and uploads instead of being toggled by the client.
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

export default router;
