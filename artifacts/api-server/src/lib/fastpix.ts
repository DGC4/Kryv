import { Fastpix } from "@fastpix/fastpix-node";

// FastPix SDK v2 uses Basic Auth: username = Access Token ID, password = Secret Key
// These map to the Render env vars the user has configured:
//   ACCESS_TOKEN  → username (access token ID)
//   SECRET_KEY    → password (secret key)
// Also accept the more explicit FASTPIX_* names for clarity.
const username = process.env.FASTPIX_ACCESS_TOKEN_ID || process.env.ACCESS_TOKEN;
const password = process.env.FASTPIX_SECRET_KEY || process.env.SECRET_KEY;
const webhookSecret = process.env.FASTPIX_WEBHOOK_SECRET;

if (!username || !password) {
  console.warn(
    "[FastPix] Credentials not found. Set ACCESS_TOKEN and SECRET_KEY (or FASTPIX_ACCESS_TOKEN_ID and FASTPIX_SECRET_KEY) in Render environment variables."
  );
}

export const fastpix = new Fastpix({
  security: {
    username: username || "",
    password: password || "",
  },
  webhookSecret: webhookSecret || undefined,
});

export class FastPixNotConfiguredError extends Error {
  constructor() {
    super(
      "FastPix is not configured. Please set ACCESS_TOKEN and SECRET_KEY in Render environment variables."
    );
  }
}

const viewerCountCache = new Map<string, { value: number; expiresAt: number }>();
const liveStreamStatusCache = new Map<string, { value: any; expiresAt: number }>();
const VIEWER_COUNT_CACHE_TTL_MS = 10_000;
const LIVE_STREAM_STATUS_CACHE_TTL_MS = 4_000;
const FASTPIX_REQUEST_TIMEOUT_MS = 10_000;

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function asNonEmptyString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

function parseFastPixDurationSeconds(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return Math.round(value);
  if (typeof value !== "string" || !value.trim()) return null;

  if (/^\d+(?:\.\d+)?$/.test(value.trim())) {
    return Math.round(Number(value));
  }

  const parts = value.trim().split(":").map(Number);
  if (!parts.length || parts.some((part) => !Number.isFinite(part) || part < 0)) return null;
  if (parts.length === 3) return Math.round((parts[0] * 3600) + (parts[1] * 60) + parts[2]);
  if (parts.length === 2) return Math.round((parts[0] * 60) + parts[1]);
  return null;
}

export type FastPixUploadMetadata = Record<string, string>;

export type FastPixOnDemandMediaStatus = {
  providerStatus: "waiting" | "processing" | "ready" | "errored";
  fastpixAssetId: string | null;
  fastpixPlaybackId: string | null;
  durationSeconds: number | null;
  thumbnailUrl: string | null;
};

function normalizeFastPixMediaStatus(status: unknown): FastPixOnDemandMediaStatus["providerStatus"] {
  const normalized = typeof status === "string" ? status.trim().toLowerCase() : "";
  if (normalized === "ready") return "ready";
  if (normalized === "failed" || normalized === "error" || normalized === "errored") return "errored";
  if (normalized === "" || normalized === "waiting" || normalized === "created") return "waiting";
  return "processing";
}

/**
 * Read one FastPix on-demand media record by either the upload ID or media ID.
 * This is intentionally separate from webhook delivery so an owner can recover
 * a completed asset if the service was unavailable when FastPix sent an event.
 */
export async function getFastPixOnDemandMediaStatus(mediaId: string): Promise<FastPixOnDemandMediaStatus> {
  if (!username || !password) {
    throw new FastPixNotConfiguredError();
  }

  const response = await fastpix.manageVideos.get({ mediaId });
  const media = asRecord((response as any).data ?? response);
  if (!media) {
    throw new Error("FastPix returned no media record for this upload.");
  }

  const firstPlayback = Array.isArray(media.playbackIds)
    ? asRecord(media.playbackIds[0])
    : null;

  return {
    providerStatus: normalizeFastPixMediaStatus(media.status),
    fastpixAssetId: asNonEmptyString(media.id),
    fastpixPlaybackId: asNonEmptyString(firstPlayback?.id),
    durationSeconds: parseFastPixDurationSeconds(media.duration),
    thumbnailUrl: asNonEmptyString(media.thumbnail),
  };
}

/**
 * Fetch the FastPix near-real-time viewer count with a short server-side cache.
 * This lets public listings refresh frequently without multiplying FastPix API calls
 * for every visitor to Kryv.
 */
export async function getFastPixViewerCount(streamId: string): Promise<number | null> {
  if (!username || !password) return null;

  const cached = viewerCountCache.get(streamId);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.value;
  }

  try {
    const response = await fastpix.manageLiveStream.getViewerCount({ streamId });
    const data = (response as any).data ?? response;
    if (typeof data?.views !== "number") return null;

    viewerCountCache.set(streamId, {
      value: data.views,
      expiresAt: Date.now() + VIEWER_COUNT_CACHE_TTL_MS,
    });
    return data.views;
  } catch (error) {
    console.warn(
      "[FastPix] Unable to refresh viewer count:",
      error instanceof Error ? error.message : error,
    );
    return null;
  }
}

/**
 * Create a new live stream on FastPix.
 * Returns the streamId, streamKey, and playbackId needed for OBS/broadcasting.
 *
 * FastPix SDK v2 API:
 *   fastpix.liveStreams.create({ playbackSettings, inputMediaSettings })
 *   Response: { success, data: { streamId, streamKey, playbackIds, ... } }
 */
export async function createFastPixLiveStream(channelId: number) {
  if (!username || !password) {
    throw new FastPixNotConfiguredError();
  }

  const response = await fastpix.liveStreams.create({
    playbackSettings: {
      accessPolicy: "public",
    },
    inputMediaSettings: {
      maxResolution: "1080p",
      reconnectWindow: 60,
      mediaPolicy: "public",
      // Kryv's standard live experience joins the current broadcast edge. Rewind
      // is a separate product capability, not the default behavior for every
      // viewer session, so a new live stream should not open in a DVR window.
      enableDvrMode: false,
      metadata: {
        source: "kryv",
        kryvChannelId: channelId.toString(),
      },
    },
  });

  // FastPix SDK v2 wraps the response: { success: true, data: { streamId, streamKey, playbackIds, ... } }
  const liveStream = (response as any).data ?? response;

  const streamId: string = liveStream.streamId ?? liveStream.id;
  const streamKey: string = liveStream.streamKey;
  const playbackId: string | undefined = liveStream.playbackIds?.[0]?.id;

  if (!streamId || !streamKey) {
    throw new Error(
      `FastPix returned an unexpected response. streamId=${streamId}, streamKey=${!!streamKey}. Full response: ${JSON.stringify(liveStream)}`
    );
  }

  return {
    fastpixLiveStreamId: streamId,
    fastpixStreamKey: streamKey,
    fastpixPlaybackId: playbackId ?? null,
  };
}

/**
 * Get an existing live stream from FastPix.
 */
export async function getFastPixLiveStream(streamId: string) {
  if (!username || !password) {
    throw new FastPixNotConfiguredError();
  }

  const cached = liveStreamStatusCache.get(streamId);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.value;
  }

  const response = await fastpix.manageLiveStream.get({ streamId });
  const liveStream = (response as any).data ?? response;
  liveStreamStatusCache.set(streamId, {
    value: liveStream,
    expiresAt: Date.now() + LIVE_STREAM_STATUS_CACHE_TTL_MS,
  });
  return liveStream;
}

/**
 * Creates a direct upload session so the browser can PUT a raw video file straight to FastPix.
 * FastPix SDK v2: fastpix.inputVideo.upload({ corsOrigin, pushMediaSettings })
 * Response: { success, data: { uploadId, url, ... } }
 */
export async function createFastPixDirectUpload(input: {
  corsOrigin: string;
  title: string;
  metadata: FastPixUploadMetadata;
}) {
  if (!username || !password) {
    throw new FastPixNotConfiguredError();
  }

  const metadataEntries = Object.entries(input.metadata);
  if (metadataEntries.length > 10) {
    throw new Error("FastPix Watch upload metadata cannot exceed 10 key-value pairs.");
  }
  if (metadataEntries.some(([key, value]) => !key || (typeof value !== "string" && typeof value !== "number"))) {
    throw new Error("FastPix Watch upload metadata must use flat string or number values.");
  }

  const response = await fastpix.inputVideo.upload({
    corsOrigin: input.corsOrigin,
    pushMediaSettings: {
      accessPolicy: "public",
      maxResolution: "1080p",
      mediaQuality: "standard",
      title: input.title,
      metadata: input.metadata,
    },
  });

  const upload = (response as any).data ?? response;

  return {
    fastpixUploadId: upload.uploadId ?? upload.id,
    uploadUrl: upload.url,
  };
}

/**
 * Create an asynchronous FastPix on-demand clip from an existing media asset.
 * Each request carries a Kryv correlation ID so webhook processing is idempotent.
 */
async function createFastPixClipFromInput(input: {
  source: { url: string; startTime?: number; endTime?: number };
  title: string;
  requestId: string;
}) {
  if (!username || !password) {
    throw new FastPixNotConfiguredError();
  }

  const authorization = Buffer.from(`${username}:${password}`).toString("base64");
  const response = await fetch("https://api.fastpix.com/v1/on-demand", {
    method: "POST",
    redirect: "error",
    signal: AbortSignal.timeout(FASTPIX_REQUEST_TIMEOUT_MS),
    headers: {
      Authorization: `Basic ${authorization}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      inputs: [
        {
          type: "video",
          url: input.source.url,
          ...(input.source.startTime !== undefined ? { startTime: input.source.startTime } : {}),
          ...(input.source.endTime !== undefined ? { endTime: input.source.endTime } : {}),
        },
      ],
      title: input.title,
      accessPolicy: "public",
      metadata: {
        source: "kryv",
        kryvClipRequestId: input.requestId,
      },
    }),
  });

  const payload = await response.json().catch(() => null) as unknown;
  const payloadRecord = asRecord(payload);
  if (!response.ok) {
    const errorRecord = asRecord(payloadRecord?.error);
    const detail = asNonEmptyString(errorRecord?.message)
      ?? asNonEmptyString(payloadRecord?.message)
      ?? `HTTP ${response.status}`;
    throw new Error(`FastPix clip request failed: ${detail}`);
  }

  const media = asRecord(payloadRecord?.data) ?? payloadRecord;
  const mediaId = asNonEmptyString(media?.id);
  if (!mediaId) {
    throw new Error("FastPix clip request returned no media ID.");
  }
  const firstPlayback = Array.isArray(media?.playbackIds)
    ? asRecord(media.playbackIds[0])
    : null;

  return {
    fastpixMediaId: mediaId,
    fastpixPlaybackId: asNonEmptyString(firstPlayback?.id),
    thumbnailUrl: asNonEmptyString(media?.thumbnail),
  };
}

/** Create an on-demand clip from a ready FastPix VOD asset. */
export async function createFastPixClip(input: {
  sourceMediaId: string;
  startTime: number;
  endTime: number;
  title: string;
  requestId: string;
}) {
  return createFastPixClipFromInput({
    source: {
      url: `fp_mediaId://${input.sourceMediaId}`,
      startTime: input.startTime,
      endTime: input.endTime,
    },
    title: input.title,
    requestId: input.requestId,
  });
}

/**
 * Create an on-demand clip from an active FastPix live playback URL. FastPix
 * documents `start`, `end`, and `clipAccess` on the HLS stream URL for live
 * clipping; the resulting asset is an on-demand media item.
 */
export async function createFastPixLiveClip(input: {
  playbackId: string;
  startTime: number;
  endTime: number;
  title: string;
  requestId: string;
}) {
  const streamUrl = new URL(`https://stream.fastpix.com/${encodeURIComponent(input.playbackId)}.m3u8`);
  streamUrl.searchParams.set("start", String(Math.floor(input.startTime)));
  streamUrl.searchParams.set("end", String(Math.ceil(input.endTime)));
  streamUrl.searchParams.set("clipAccess", "public");
  return createFastPixClipFromInput({
    source: { url: streamUrl.toString() },
    title: input.title,
    requestId: input.requestId,
  });
}
