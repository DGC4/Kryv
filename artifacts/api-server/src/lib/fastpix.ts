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

/**
 * Create a new live stream on FastPix.
 * Returns the streamId, streamKey, and playbackId needed for OBS/broadcasting.
 *
 * FastPix SDK v2 API:
 *   fastpix.liveStreams.create({ playbackSettings, inputMediaSettings })
 *   Response: { success, data: { streamId, streamKey, playbackIds, ... } }
 */
export async function createFastPixLiveStream() {
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

  const response = await fastpix.manageLiveStream.get({ streamId });
  return (response as any).data ?? response;
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
