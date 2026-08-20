import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import cors from "cors";
import helmet from "helmet";
import rateLimit, { MemoryStore, type Options, type Store } from "express-rate-limit";
import { RedisStore, type RedisReply } from "rate-limit-redis";
import cookieParser from "cookie-parser";
import routes from "./routes";
import webhooksRouter from "./routes/webhooks";
import { attachUserId, requireOwner, requireTrustedSessionOrigin } from "./lib/auth";
import { trackVisitor } from "./middleware/visitor";
import { getSharedStateClient } from "./lib/realtime";
import { logger } from "./lib/logger";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ── Enforce JWT_SECRET in production ──────────────────────────────────────────
if (process.env.NODE_ENV === "production" && !process.env.JWT_SECRET) {
  throw new Error(
    "JWT_SECRET environment variable is required in production. Set it in Render environment variables."
  );
}

const app = express();

// Trust the first proxy hop (Replit's ingress / Render's load balancer).
// Required for express-rate-limit to read X-Forwarded-For correctly.
app.set("trust proxy", 1);

// ── Security headers (Helmet) ─────────────────────────────────────────────────
// Helmet sets a suite of HTTP headers that protect against common web vulnerabilities
// (XSS, clickjacking, MIME sniffing, etc.)
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
        frameAncestors: ["'self'"],
        imgSrc: ["'self'", "data:", "https:", "blob:"],
        // FastPix serves a public entry manifest from stream.fastpix.com, then
        // delegates signed rendition playlists and fMP4 segments to provider
        // subdomains. hls.js retrieves those playlists/segments through fetch,
        // so both media and connect policies must allow the FastPix domain family.
        mediaSrc: [
          "'self'",
          "https://stream.fastpix.com",
          "https://*.fastpix.com",
          "blob:",
        ],
        connectSrc: [
          "'self'",
          "https://stream.fastpix.com",
          "https://api.fastpix.com",
          "https://*.fastpix.com",
        ],
        frameSrc: ["'none'"],
        objectSrc: ["'none'"],
      },
    },
    // Required for HLS.js to work (uses SharedArrayBuffer / cross-origin isolation)
    crossOriginEmbedderPolicy: false,
  })
);

// ── CORS ──────────────────────────────────────────────────────────────────────
// In production, only allow the Render-hosted origin.
// Set ALLOWED_ORIGINS in Render env vars (comma-separated) to add custom domains.
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(",").map((o) => o.trim()).filter(Boolean)
  : process.env.NODE_ENV === "production"
    ? []
    : ["http://localhost:5173", "http://localhost:3000"];

if (process.env.NODE_ENV === "production" && allowedOrigins.length === 0) {
  throw new Error("ALLOWED_ORIGINS must be configured in production.");
}

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (mobile apps, curl, Render health checks)
      if (!origin) return callback(null, true);
      if (
        allowedOrigins.includes(origin) ||
        process.env.NODE_ENV !== "production"
      ) {
        return callback(null, true);
      }
      return callback(new Error(`CORS: origin ${origin} not allowed`));
    },
    credentials: true,
  })
);

// ── Rate limiting ─────────────────────────────────────────────────────────────
// Redis-compatible shared counters are used when configured so all API instances
// enforce the same limits. A local fallback keeps the API fail-safe if shared state
// is temporarily unavailable during deployment or cache recovery.
class ResilientRateLimitStore implements Store {
  prefix: string;
  localKeys = false;
  private readonly local = new MemoryStore();

  constructor(private readonly shared: RedisStore, prefix: string) {
    this.prefix = prefix;
  }

  init(options: Options) {
    this.shared.init?.(options);
    this.local.init(options);
  }

  async increment(key: string) {
    try {
      return await this.shared.increment(key);
    } catch (error) {
      // Do not turn a transient cache reconnect into an API outage. The fallback
      // remains rate-limited locally and is observable in structured logs.
      logger.warn({ error, keyPrefix: this.prefix }, "Falling back to local rate-limit state");
      return this.local.increment(key);
    }
  }

  async decrement(key: string) {
    try {
      await this.shared.decrement(key);
    } catch {
      await this.local.decrement(key);
    }
  }

  async resetKey(key: string) {
    try {
      await this.shared.resetKey(key);
    } catch {
      await this.local.resetKey(key);
    }
  }

  async resetAll() {
    await this.local.resetAll();
  }

  shutdown() {
    this.local.shutdown();
  }
}

function sharedRateLimitStore(prefix: string): Store | undefined {
  const client = getSharedStateClient();
  if (!client) return undefined;
  const shared = new RedisStore({
    prefix,
    sendCommand: (...args: string[]): Promise<RedisReply> => client.call(...(args as [string, ...string[]])) as Promise<RedisReply>,
  });
  return new ResilientRateLimitStore(shared, prefix);
}

// Auth endpoints: strict limit to prevent brute-force / credential stuffing
const authLimiter = rateLimit({
  store: sharedRateLimitStore("kryv:rate:auth:"),
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests, please try again later." },
});

// Stream key endpoints: prevent key enumeration / abuse
const streamKeyLimiter = rateLimit({
  store: sharedRateLimitStore("kryv:rate:stream-key:"),
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many stream key requests, please try again later." },
});

// Chat writes have a tighter per-origin ceiling in addition to channel slow mode.
// This is intentionally scoped to POSTs; public message reads remain available to viewers.
const chatMessageLimiter = rateLimit({
  store: sharedRateLimitStore("kryv:rate:chat:"),
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.method !== "POST",
  message: { error: "You are sending chat messages too quickly. Please slow down." },
});

// General API limiter — prevents DDoS / scraping
// Guest invoice creation is intentionally stricter than general API traffic because it
// creates provider-side payment intents for unauthenticated visitors.
const guestCheckoutLimiter = rateLimit({
  store: sharedRateLimitStore("kryv:rate:guest-checkout:"),
  windowMs: 15 * 60 * 1000,
  max: 6,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many guest checkout attempts. Please wait before trying again." },
});

const apiLimiter = rateLimit({
  store: sharedRateLimitStore("kryv:rate:api:"),
  windowMs: 60 * 1000, // 1 minute
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests, please try again later." },
  // Webhooks are exempt — FastPix sends bursts during stream events
  skip: (req) => req.path.startsWith("/api/webhooks"),
});

// Apply rate limiters before routes
app.use("/api/signup", authLimiter);
app.use("/api/login", authLimiter);
app.use("/api/channels", (req, res, next) => {
  if (req.path.includes("/stream")) return streamKeyLimiter(req, res, next);
  if (/^\/\d+\/messages\/?$/.test(req.path)) return chatMessageLimiter(req, res, next);
  if (/^\/\d+\/guest-(tip|subscription-gift)\/?$/.test(req.path)) return guestCheckoutLimiter(req, res, next);
  next();
});
app.use("/api", apiLimiter);

// ── Body parsers ──────────────────────────────────────────────────────────────
// Webhook routes MUST receive the raw body for HMAC signature verification —
// mount these path-specific raw parsers BEFORE the global express.json().

// FastPix sends application/json but we need the raw buffer for HMAC verification
app.use("/api/webhooks/fastpix", express.raw({ type: "*/*" }));
// Plisio signs the JSON callback payload with a merchant-key HMAC.
app.use("/api/webhooks/plisio", express.raw({ type: "application/json" }));

app.use(express.json({ limit: "1mb" }));
app.use(cookieParser());
app.use(attachUserId);
app.use(requireTrustedSessionOrigin);

app.use((req, res, next) => {
  // Fire-and-forget visitor tracking.
  trackVisitor(req, res).catch((err) =>
    console.error("trackVisitor error:", err)
  );
  next();
});

// ── Webhook routes (verified by FastPix signature) ──────────────────────────────
app.use("/api", webhooksRouter);

// ── API Routes ────────────────────────────────────────────────────────────────
app.use("/api", routes);

// ── Health check ──────────────────────────────────────────────────────────────
// The response deliberately exposes deployment capability only, never secrets or
// wallet data. Uptime checks can distinguish an API that is alive from a topology
// that still relies on local fallbacks while Redis, realtime, and worker services
// are not deployed.
app.get("/health", (_req, res) => {
  const cacheConfigured = Boolean(process.env.KRYV_CACHE_REDIS_URL?.trim());
  const queueConfigured = Boolean(process.env.KRYV_QUEUE_REDIS_URL?.trim());
  const realtimeConfigured = Boolean(process.env.KRYV_REALTIME_TOKEN_SECRET?.trim());
  res.json({
    status: "ok",
    mode: cacheConfigured && queueConfigured ? "distributed" : "free-tier-fallback",
    capabilities: {
      sharedCache: cacheConfigured,
      durableQueue: queueConfigured,
      realtimeTokenIssuer: realtimeConfigured,
      // Withdrawal execution is intentionally hard-disabled until the production
      // launch gate is completed; do not infer availability from an environment flag.
      providerWithdrawalsRuntimeEnabled: false,
      customerWalletCustodyRuntimeEnabled: false,
      scheduledPayoutRequestsRuntimeEnabled: false,
      adDeliveryRuntimeEnabled: false,
    },
  });
});

// ── Serve frontend in production ──────────────────────────────────────────────
const possibleDistPaths = [
  path.resolve(__dirname, "../../blyze/dist"),
  path.resolve(__dirname, "../../../artifacts/blyze/dist"),
  path.resolve(process.cwd(), "artifacts/blyze/dist"),
  path.resolve(process.cwd(), "blyze/dist"),
  "/opt/render/project/src/artifacts/blyze/dist",
];

let frontendDist = "";
for (const p of possibleDistPaths) {
  if (fs.existsSync(p)) {
    frontendDist = p;
    break;
  }
}

// ── Debug endpoint — OWNER-ONLY ───────────────────────────────────────────────
// Protected: requires a valid JWT with role=owner in production.
// This endpoint is intentionally kept for operational debugging but locked down.
app.get("/api/debug/paths", requireOwner, (req, res) => {
  if (process.env.NODE_ENV === "production" && process.env.KRYV_DEBUG_ENDPOINTS_ENABLED !== "true") {
    return res.sendStatus(404);
  }

  const fastpixEnv: Record<string, object> = {};
  Object.keys(process.env).forEach((k) => {
    if (
      k.includes("FASTPIX") ||
      k.includes("ACCESS_TOKEN") ||
      k.includes("SECRET_KEY")
    ) {
      fastpixEnv[k] = {
        length: process.env[k]?.length || 0,
        hasLeadingSpace: process.env[k]?.startsWith(" ") || false,
        hasTrailingSpace: process.env[k]?.endsWith(" ") || false,
        set: !!process.env[k],
      };
    }
  });

  res.json({
    cwd: process.cwd(),
    __dirname,
    possibleDistPaths,
    actualDistPath: frontendDist,
    fastpixEnv,
    nodeEnv: process.env.NODE_ENV,
    filesInCwd: fs.existsSync(process.cwd())
      ? fs.readdirSync(process.cwd())
      : [],
  });
});

if (frontendDist) {
  console.log("Serving frontend from:", frontendDist);
  app.use(express.static(frontendDist));
  app.get("*", (req, res) => {
    // If it's an API route that wasn't matched, return 404
    if (req.path.startsWith("/api"))
      return res.status(404).json({ error: "API route not found" });

    // Otherwise serve index.html for SPA routing
    const indexPath = path.join(frontendDist, "index.html");
    if (fs.existsSync(indexPath)) {
      res.sendFile(indexPath);
    } else {
      res
        .status(404)
        .send(
          `Kryv API is running, but index.html was not found in ${frontendDist}`
        );
    }
  });
} else {
  // Fallback for when the frontend isn't built or path is wrong
  app.get("/", (_req, res) => {
    res.send(
      `Kryv API is running. Frontend not found. Checked paths: ${possibleDistPaths.join(", ")}`
    );
  });
}

export default app;
