import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import cookieParser from "cookie-parser";
import routes from "./routes";
import webhooksRouter from "./routes/webhooks";
import { attachUserId, verifyToken } from "./lib/auth";
import { trackVisitor } from "./middleware/visitor";

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
        scriptSrc: ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:", "https:", "blob:"],
        // Allow HLS media from FastPix CDN
        mediaSrc: [
          "'self'",
          "https://stream.fastpix.com",
          "blob:",
        ],
        connectSrc: [
          "'self'",
          "https://stream.fastpix.com",
          "https://api.fastpix.com",
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
  ? process.env.ALLOWED_ORIGINS.split(",").map((o) => o.trim())
  : ["http://localhost:5173", "http://localhost:3000"];

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
// Auth endpoints: strict limit to prevent brute-force / credential stuffing
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests, please try again later." },
});

// Stream key endpoints: prevent key enumeration / abuse
const streamKeyLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many stream key requests, please try again later." },
});

// General API limiter — prevents DDoS / scraping
const apiLimiter = rateLimit({
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
  next();
});
app.use("/api", apiLimiter);

// ── Body parsers ──────────────────────────────────────────────────────────────
// Webhook routes MUST receive the raw body for HMAC signature verification —
// mount these path-specific raw parsers BEFORE the global express.json().

// FastPix sends application/json but we need the raw buffer for HMAC verification
app.use("/api/webhooks/fastpix", express.raw({ type: "*/*" }));

app.use(express.json({ limit: "1mb" }));
app.use(cookieParser());
app.use(attachUserId);

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
app.get("/health", (_req, res) => res.json({ status: "ok" }));

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
app.get("/api/debug/paths", (req, res) => {
  if (process.env.NODE_ENV === "production") {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    const payload = verifyToken(authHeader.slice(7));
    if (!payload || payload.role !== "owner") {
      return res.status(403).json({ error: "Forbidden" });
    }
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
