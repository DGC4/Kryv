import { Router, type IRouter } from "express";
import { and, desc, eq, ne, sql } from "drizzle-orm";

import { clipsTable, creatorBalancesTable, db, paymentEventsTable, paymentIntentsTable, channelsTable, subscriptionsTable, tipsTable, videosTable, streamSessionsTable } from "@workspace/db";
import { logger } from "../lib/logger";
import { fastpix } from "../lib/fastpix";
import { isPlisioConfigured, isSupportedKryvCryptoCode, verifyPlisioJsonCallback } from "../lib/plisio";

const router: IRouter = Router();

/**
 * Plisio JSON callbacks are HMAC-verified before any persistence. A payment
 * event is recorded first; payment intent state and product effects are then
 * processed exactly once. The browser invoice-return route is never trusted.
 */
router.post("/webhooks/plisio", async (req, res): Promise<void> => {
  const rawBody = req.body as Buffer;
  if (!isPlisioConfigured()) {
    res.status(503).json({ error: "Crypto callbacks are not configured" });
    return;
  }

  let callback: Record<string, unknown>;
  try {
    callback = JSON.parse(Buffer.isBuffer(rawBody) ? rawBody.toString("utf8") : String(rawBody));
  } catch {
    res.status(400).json({ error: "Invalid crypto callback payload" });
    return;
  }

  if (!verifyPlisioJsonCallback(callback)) {
    logger.warn({ transactionId: callback.txn_id }, "Rejected Plisio callback with invalid signature");
    res.status(400).json({ error: "Invalid crypto callback signature" });
    return;
  }

  const transactionId = typeof callback.txn_id === "string" ? callback.txn_id : "";
  const orderNumber = typeof callback.order_number === "string" ? callback.order_number : "";
  const providerStatus = typeof callback.status === "string" ? callback.status.toLowerCase() : "unknown";
  if (!transactionId || !orderNumber) {
    res.status(400).json({ error: "Crypto callback is missing transaction identity" });
    return;
  }

  const providerEventId = `plisio:${transactionId}:${providerStatus}:${String(callback.confirmations ?? "")}`;
  const [event] = await db
    .insert(paymentEventsTable)
    .values({
      provider: "plisio",
      providerEventId,
      eventType: `invoice.${providerStatus}`,
      processingStatus: "received",
      relatedProviderPaymentId: transactionId,
    })
    .onConflictDoNothing()
    .returning({ id: paymentEventsTable.id });

  if (!event) {
    res.status(200).json({ received: true, duplicate: true });
    return;
  }

  try {
    const [intent] = await db
      .select()
      .from(paymentIntentsTable)
      .where(and(eq(paymentIntentsTable.orderNumber, orderNumber), eq(paymentIntentsTable.provider, "plisio")))
      .limit(1);

    if (!intent) {
      await db.update(paymentEventsTable).set({ processingStatus: "failed", errorCode: "unknown_order", processedAt: new Date() }).where(eq(paymentEventsTable.id, event.id));
      res.status(200).json({ received: true, ignored: "unknown_order" });
      return;
    }

    if (providerStatus !== "completed") {
      const status = ["cancelled", "expired"].includes(providerStatus) ? "cancelled" : providerStatus === "error" ? "failed" : "pending";
      await db
        .update(paymentIntentsTable)
        .set({ providerPaymentId: transactionId, status, updatedAt: new Date() })
        .where(and(eq(paymentIntentsTable.id, intent.id), ne(paymentIntentsTable.status, "completed")));
      await db.update(paymentEventsTable).set({ processingStatus: "processed", processedAt: new Date() }).where(eq(paymentEventsTable.id, event.id));
      res.status(200).json({ received: true, status });
      return;
    }

    const [settledIntent] = await db
      .update(paymentIntentsTable)
      .set({ providerPaymentId: transactionId, status: "completed", completedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(paymentIntentsTable.id, intent.id), ne(paymentIntentsTable.status, "completed")))
      .returning();

    if (!settledIntent) {
      await db.update(paymentEventsTable).set({ processingStatus: "processed", processedAt: new Date() }).where(eq(paymentEventsTable.id, event.id));
      res.status(200).json({ received: true, duplicate: true });
      return;
    }

    if (settledIntent.paymentKind === "subscription" && settledIntent.purchaserUserId && settledIntent.receiverChannelId) {
      const metadata = (settledIntent.metadata ?? {}) as Record<string, unknown>;
      const tier = typeof metadata.tier === "number" && Number.isInteger(metadata.tier) ? metadata.tier : 1;
      const [active] = await db
        .select()
        .from(subscriptionsTable)
        .where(and(eq(subscriptionsTable.userId, settledIntent.purchaserUserId), eq(subscriptionsTable.channelId, settledIntent.receiverChannelId), eq(subscriptionsTable.status, "active")))
        .limit(1);
      const base = active?.expiresAt && active.expiresAt > new Date() ? active.expiresAt : new Date();
      const expiresAt = new Date(base);
      expiresAt.setMonth(expiresAt.getMonth() + 1);
      if (active) {
        await db.update(subscriptionsTable).set({ tier, provider: "plisio", providerSubscriptionId: transactionId, providerPriceId: `tier_${tier}`, currentPeriodEnd: expiresAt, expiresAt }).where(eq(subscriptionsTable.id, active.id));
      } else {
        await db.insert(subscriptionsTable).values({ userId: settledIntent.purchaserUserId, channelId: settledIntent.receiverChannelId, tier, status: "active", provider: "plisio", providerSubscriptionId: transactionId, providerPriceId: `tier_${tier}`, currentPeriodEnd: expiresAt, expiresAt });
      }
    }

    if (settledIntent.paymentKind === "tip" && settledIntent.purchaserUserId && settledIntent.receiverChannelId) {
      const paidAmount = typeof callback.amount === "string" && /^\d+(\.\d{1,8})?$/.test(callback.amount) ? callback.amount : null;
      const paidCurrency = typeof callback.currency === "string" ? callback.currency.toUpperCase() : null;
      if (!paidAmount || !isSupportedKryvCryptoCode(paidCurrency)) throw new Error("Completed crypto tip callback has an invalid or unsupported amount or currency.");
      const metadata = (settledIntent.metadata ?? {}) as Record<string, unknown>;
      const [tip] = await db
        .insert(tipsTable)
        .values({ senderUserId: settledIntent.purchaserUserId, receiverChannelId: settledIntent.receiverChannelId, amount: paidAmount, currency: paidCurrency, provider: "plisio", providerPaymentIntentId: transactionId, status: "completed", message: typeof metadata.message === "string" ? metadata.message : null })
        .onConflictDoNothing()
        .returning({ id: tipsTable.id });
      if (tip) {
        await db
          .insert(creatorBalancesTable)
          .values({ channelId: settledIntent.receiverChannelId, currency: paidCurrency, availableAmount: paidAmount })
          .onConflictDoUpdate({ target: [creatorBalancesTable.channelId, creatorBalancesTable.currency], set: { availableAmount: sql`${creatorBalancesTable.availableAmount} + ${paidAmount}`, updatedAt: new Date() } });
      }
    }

    await db.update(paymentEventsTable).set({ processingStatus: "processed", processedAt: new Date() }).where(eq(paymentEventsTable.id, event.id));
    res.status(200).json({ received: true });
  } catch (error) {
    logger.error({ error, transactionId, orderNumber }, "Plisio callback processing failed");
    await db.update(paymentEventsTable).set({ processingStatus: "failed", errorCode: error instanceof Error ? error.name : "unknown" }).where(eq(paymentEventsTable.id, event.id));
    res.status(500).json({ error: "Crypto callback processing failed" });
  }
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
 *   video.live_stream.created/preparing/connected — cache playback readiness privately
 *   video.live_stream.active       — publish the stream to Kryv viewers
 *   video.live_stream.disconnected — retain state during the provider reconnect window
 *   video.live_stream.idle         — conclusively end the public session
 *   video.live_stream.updated      — generic status update
 *   video.live_stream.deleted      — stream deleted
 *   video.media.created            — upload started processing
 *   video.media.ready              — upload finished, playback available
 *   video.media.failed             — upload failed
 */
// State-free reachability probe for provider dashboard validation. It never receives
// or processes events; all state-changing delivery remains POST-only and signed.
router.get("/webhooks/fastpix", (_req, res): void => {
  res.status(200).type("text/plain").send("Kryv live event receiver ready");
});

router.post("/webhooks/fastpix", async (req, res): Promise<void> => {
  const rawBody = req.body as Buffer;
  const webhookSecret = process.env.FASTPIX_WEBHOOK_SECRET;

  let event: any;
  try {
    const bodyStr = Buffer.isBuffer(rawBody) ? rawBody.toString("utf8") : String(rawBody);

    if (!webhookSecret) {
      // FastPix validates a new endpoint before it reveals its signing secret.
      // Acknowledge this bootstrap probe but deliberately persist no event and
      // execute no state change; normal delivery remains signature-mandatory.
      logger.warn("FASTPIX_WEBHOOK_SECRET is not configured; ignoring unsigned live-event bootstrap probe");
      res.status(200).json({ received: true, configured: false });
      return;
    }

    // Verify the unmodified raw payload before accepting a provider event.
    event = fastpix.webhooks.unwrap(
      bodyStr,
      req.headers as Record<string, string>,
    );
  } catch (err) {
    logger.warn({ err }, "Rejected FastPix webhook — signature verification failed");
    res.status(400).json({ error: "Invalid signature" });
    return;
  }

  logger.info({ type: event.type }, "Received FastPix webhook");

  switch (event.type) {
    // ── Provisioning and encoder readiness: cache playback privately ────────
    case "video.live_stream.created":
    case "video.live_stream.preparing":
    case "video.live_stream.connected": {
      const liveStream = event.data ?? {};
      const streamId = liveStream.streamId ?? liveStream.id;
      const playbackId = liveStream.playbackIds?.[0]?.id ?? null;
      if (!streamId) {
        logger.warn({ type: event.type }, "FastPix connected event did not include a stream ID");
        break;
      }
      await db
        .update(channelsTable)
        .set({ ...(playbackId ? { fastpixPlaybackId: playbackId } : {}) })
        .where(eq(channelsTable.fastpixLiveStreamId, streamId));
      break;
    }

    // ── Live stream is publicly active ─────────────────────────────────────
    case "video.live_stream.active": {
      const liveStream = event.data ?? {};
      const streamId = liveStream.streamId ?? liveStream.id;
      const playbackId = liveStream.playbackIds?.[0]?.id ?? null;
      if (!streamId) {
        logger.warn({ type: event.type }, "FastPix active event did not include a stream ID");
        break;
      }

      const [updatedChannel] = await db
        .update(channelsTable)
        .set({
          isLive: true,
          lastStreamAt: new Date(),
          ...(playbackId ? { fastpixPlaybackId: playbackId } : {}),
        })
        .where(eq(channelsTable.fastpixLiveStreamId, streamId))
        .returning();

      // A FastPix event can be retried; only create one open session per channel.
      if (updatedChannel) {
        const [openSession] = await db
          .select({ id: streamSessionsTable.id })
          .from(streamSessionsTable)
          .where(
            and(
              eq(streamSessionsTable.channelId, updatedChannel.id),
              sql`${streamSessionsTable.endedAt} IS NULL`,
            ),
          );
        if (!openSession) {
          await db.insert(streamSessionsTable).values({
            channelId: updatedChannel.id,
            startedAt: new Date(),
            title: updatedChannel.streamTitle ?? null,
            categoryId: updatedChannel.categoryId ?? null,
            streamKey: updatedChannel.fastpixStreamKey ?? null,
          });
          await db
            .update(channelsTable)
            .set({ totalStreamCount: sql`${channelsTable.totalStreamCount} + 1` })
            .where(eq(channelsTable.id, updatedChannel.id));
        }
      }
      break;
    }

    // ── A transient disconnect starts the provider reconnect window. Keep the
    // current public state intact; only idle conclusively ends the broadcast. ─
    case "video.live_stream.disconnected": {
      const streamId = event.data?.streamId ?? event.data?.id;
      logger.info({ streamId }, "Live encoder disconnected; retaining state during reconnect window");
      break;
    }

    // ── The reconnect window elapsed and the live stream is conclusively off ─
    case "video.live_stream.idle": {
      const liveStream = event.data ?? {};
      const streamId = liveStream.streamId ?? liveStream.id;
      if (!streamId) {
        logger.warn({ type: event.type }, "FastPix offline event did not include a stream ID");
        break;
      }

      // Find the channel to get its ID for session closure
      const [offlineChannel] = await db
        .update(channelsTable)
        .set({ isLive: false, viewerCount: 0 })
        .where(eq(channelsTable.fastpixLiveStreamId, streamId))
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
      const liveStream = event.data ?? {};
      const streamId = liveStream.streamId ?? liveStream.id;
      const playbackId = liveStream.playbackIds?.[0]?.id ?? null;
      if (!streamId) {
        logger.warn({ type: event.type }, "FastPix update event did not include a stream ID");
        break;
      }
      const providerStatus = typeof liveStream.status === "string" ? liveStream.status : null;
      const nextLiveState = providerStatus === "active" ? true : ["idle", "disabled"].includes(providerStatus ?? "") ? false : undefined;
      const [updatedChannel] = await db
        .update(channelsTable)
        .set({
          ...(nextLiveState !== undefined ? { isLive: nextLiveState, viewerCount: nextLiveState ? (liveStream.viewerCount ?? 0) : 0 } : {}),
          ...(playbackId ? { fastpixPlaybackId: playbackId } : {}),
        })
        .where(eq(channelsTable.fastpixLiveStreamId, streamId))
        .returning();

      if (updatedChannel && nextLiveState === false) {
        const now = new Date();
        await db
          .update(streamSessionsTable)
          .set({
            endedAt: now,
            durationSeconds: sql`EXTRACT(EPOCH FROM (${now.toISOString()} - started_at))::integer`,
          })
          .where(and(eq(streamSessionsTable.channelId, updatedChannel.id), sql`${streamSessionsTable.endedAt} IS NULL`));
      }

      // FastPix reports mediaIds once a recording has been created from the live stream.
      // Create a normal Kryv VOD record so later clip requests can reference the same asset.
      const mediaIds = Array.isArray(liveStream.mediaIds)
        ? liveStream.mediaIds.filter((mediaId: unknown): mediaId is string => typeof mediaId === "string")
        : [];
      if (updatedChannel && mediaIds.length > 0) {
        const [latestSession] = await db
          .select({ id: streamSessionsTable.id, title: streamSessionsTable.title })
          .from(streamSessionsTable)
          .where(eq(streamSessionsTable.channelId, updatedChannel.id))
          .orderBy(desc(streamSessionsTable.startedAt))
          .limit(1);

        for (const mediaId of mediaIds) {
          const [existingVideo] = await db
            .select({ id: videosTable.id })
            .from(videosTable)
            .where(eq(videosTable.fastpixAssetId, mediaId))
            .limit(1);

          const video = existingVideo
            ? existingVideo
            : (await db
                .insert(videosTable)
                .values({
                  channelId: updatedChannel.id,
                  title: latestSession?.title ?? updatedChannel.streamTitle ?? `${updatedChannel.displayName} live broadcast`,
                  categoryId: updatedChannel.categoryId,
                  contentType: "upload",
                  uploadStatus: "processing",
                  fastpixAssetId: mediaId,
                })
                .returning({ id: videosTable.id }))[0];

          if (latestSession && video) {
            await db
              .update(streamSessionsTable)
              .set({ vodVideoId: video.id })
              .where(eq(streamSessionsTable.id, latestSession.id));
          }
        }
      }
      break;
    }

    // ── Stream deleted ─────────────────────────────────────────────────────
    case "video.live_stream.deleted": {
      const liveStream = event.data ?? {};
      const streamId = liveStream.streamId ?? liveStream.id;
      if (!streamId) {
        logger.warn({ type: event.type }, "FastPix deleted event did not include a stream ID");
        break;
      }
      await db
        .update(channelsTable)
        .set({ isLive: false, viewerCount: 0 })
        .where(eq(channelsTable.fastpixLiveStreamId, streamId));
      break;
    }

    // ── VOD / upload processing ────────────────────────────────────────────
    case "video.media.ready": {
      const media = event.data ?? {};
      const mediaId = media.id ?? null;
      const playbackId = media.playbackIds?.[0]?.id ?? null;
      const uploadId = media.uploadId ?? (media as any).upload_id;
      const durationSeconds = media.duration ? Math.round(media.duration) : null;

      if (uploadId) {
        await db
          .update(videosTable)
          .set({
            uploadStatus: "ready",
            fastpixAssetId: mediaId,
            fastpixPlaybackId: playbackId,
            durationSeconds,
          })
          .where(eq(videosTable.fastpixUploadId, uploadId));
      }
      if (mediaId) {
        await db
          .update(videosTable)
          .set({ uploadStatus: "ready", fastpixPlaybackId: playbackId, durationSeconds })
          .where(eq(videosTable.fastpixAssetId, mediaId));
        await db
          .update(clipsTable)
          .set({
            processingStatus: "ready",
            isPublished: true,
            fastpixPlaybackId: playbackId,
            ...(media.thumbnail ? { thumbnailUrl: media.thumbnail } : {}),
            ...(durationSeconds ? { durationSeconds } : {}),
            processingError: null,
          })
          .where(eq(clipsTable.fastpixMediaId, mediaId));
      }
      break;
    }

    case "video.media.failed": {
      const media = event.data ?? {};
      const mediaId = media.id ?? null;
      const uploadId = media.uploadId ?? (media as any).upload_id;
      if (uploadId) {
        await db
          .update(videosTable)
          .set({ uploadStatus: "errored" })
          .where(eq(videosTable.fastpixUploadId, uploadId));
      }
      if (mediaId) {
        await db
          .update(videosTable)
          .set({ uploadStatus: "errored" })
          .where(eq(videosTable.fastpixAssetId, mediaId));
        await db
          .update(clipsTable)
          .set({ processingStatus: "errored", isPublished: false, processingError: "FastPix could not process this clip." })
          .where(eq(clipsTable.fastpixMediaId, mediaId));
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
