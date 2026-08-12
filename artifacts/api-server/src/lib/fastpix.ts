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
      // Persist concluded broadcasts for the existing VOD and clipping workflow.
      enableRecording: true,
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
export async function createFastPixDirectUpload(corsOrigin: string) {
  if (!username || !password) {
    throw new FastPixNotConfiguredError();
  }

  const response = await fastpix.inputVideo.upload({
    corsOrigin,
    pushMediaSettings: {
      accessPolicy: "public",
      maxResolution: "1080p",
      mediaQuality: "standard",
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

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const detail = payload?.error?.message ?? payload?.message ?? `HTTP ${response.status}`;
    throw new Error(`FastPix clip request failed: ${detail}`);
  }

  const media = payload?.data ?? payload;
  const mediaId = media?.id;
  if (!mediaId) {
    throw new Error("FastPix clip request returned no media ID.");
  }

  return {
    fastpixMediaId: mediaId as string,
    fastpixPlaybackId: (media.playbackIds?.[0]?.id ?? null) as string | null,
    thumbnailUrl: (media.thumbnail ?? null) as string | null,
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
