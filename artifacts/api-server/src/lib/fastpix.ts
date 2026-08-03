import FastPix from "@fastpix/fastpix-node";

// Map user's .env names to what FastPix SDK expects or use them directly
const accessTokenId = process.env.FASTPIX_ACCESS_TOKEN_ID || process.env.ACCESS_TOKEN;
const secretKey = process.env.FASTPIX_SECRET_KEY || process.env.SECRET_KEY;
const webhookSecret = process.env.FASTPIX_WEBHOOK_SECRET || process.env.MUX_WEBHOOK_SECRET;

if (!accessTokenId || !secretKey) {
  console.warn("FastPix credentials not found. Set ACCESS_TOKEN and SECRET_KEY in environment.");
}

export const fastpix = new FastPix({
  accessTokenId: accessTokenId || "",
  secretKey: secretKey || "",
  webhookSecret: webhookSecret || "",
});

export class FastPixNotConfiguredError extends Error {
  constructor() {
    super("FastPix is not configured. Please set ACCESS_TOKEN and SECRET_KEY.");
  }
}

/**
 * Create a new live stream on FastPix.
 */
export async function createFastPixLiveStream() {
  if (!accessTokenId || !secretKey) {
    throw new FastPixNotConfiguredError();
  }

  const liveStream = await fastpix.live.streams.create({
    playbackPolicy: ["public"],
    newAssetSettings: { playbackPolicy: ["public"] },
  });

  const playbackId = liveStream.playbackIds?.[0]?.id;
  const streamKey = liveStream.streamKey;

  return {
    fastpixLiveStreamId: liveStream.id,
    fastpixStreamKey: streamKey,
    fastpixPlaybackId: playbackId,
  };
}

/**
 * Get an existing live stream from FastPix.
 */
export async function getFastPixLiveStream(streamId: string) {
  if (!accessTokenId || !secretKey) {
    throw new FastPixNotConfiguredError();
  }

  return await fastpix.live.streams.retrieve(streamId);
}

/**
 * Creates a direct upload session so the browser can PUT a raw video file straight to FastPix.
 */
export async function createFastPixDirectUpload(corsOrigin: string) {
  if (!accessTokenId || !secretKey) {
    throw new FastPixNotConfiguredError();
  }

  const upload = await fastpix.video.uploads.create({
    corsOrigin,
    newAssetSettings: {
      playbackPolicy: ["public"],
    },
  });

  return {
    fastpixUploadId: upload.id,
    uploadUrl: upload.url,
  };
}
