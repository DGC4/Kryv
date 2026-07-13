import Mux from "@mux/mux-node";
import { logger } from "./logger";

let cached: Mux | null = null;

/**
 * Lazily-constructed Mux client. Real live-streaming infrastructure (RTMP
 * ingest + HLS playback for Kryv Live, on-demand asset transcoding for Kryv
 * Watch / Kryv Cinema) is powered by Mux Video. Requires MUX_TOKEN_ID and
 * MUX_TOKEN_SECRET to be set as secrets.
 */
export function getMux(): Mux {
  if (cached) return cached;
  const tokenId = process.env.MUX_TOKEN_ID;
  const tokenSecret = process.env.MUX_TOKEN_SECRET;
  if (!tokenId || !tokenSecret) {
    throw new MuxNotConfiguredError();
  }
  cached = new Mux({ tokenId, tokenSecret });
  return cached;
}

export class MuxNotConfiguredError extends Error {
  constructor() {
    super(
      "Mux is not configured — MUX_TOKEN_ID / MUX_TOKEN_SECRET secrets are missing.",
    );
    this.name = "MuxNotConfiguredError";
  }
}

/** Creates a real RTMP live stream on Mux and returns ingest credentials. */
export async function createMuxLiveStream() {
  const mux = getMux();
  const stream = await mux.video.liveStreams.create({
    playback_policy: ["public"],
    new_asset_settings: { playback_policy: ["public"] },
    reconnect_window: 60,
  });
  const playbackId = stream.playback_ids?.[0]?.id ?? null;
  return {
    muxLiveStreamId: stream.id,
    muxStreamKey: stream.stream_key,
    muxPlaybackId: playbackId,
  };
}

/** Creates a direct upload session so the browser can PUT a raw video file straight to Mux. */
export async function createMuxDirectUpload(corsOrigin: string) {
  const mux = getMux();
  const upload = await mux.video.uploads.create({
    cors_origin: corsOrigin,
    new_asset_settings: { playback_policy: ["public"] },
  });
  return { muxUploadId: upload.id, uploadUrl: upload.url };
}

export async function retrieveMuxAsset(assetId: string) {
  const mux = getMux();
  return mux.video.assets.retrieve(assetId);
}

export async function retrieveMuxUpload(uploadId: string) {
  const mux = getMux();
  return mux.video.uploads.retrieve(uploadId);
}

export function logMuxConfigWarningOnce() {
  if (!process.env.MUX_TOKEN_ID || !process.env.MUX_TOKEN_SECRET) {
    logger.warn(
      "MUX_TOKEN_ID / MUX_TOKEN_SECRET are not set — live streaming and video upload endpoints will return 503 until they are configured.",
    );
  }
}
