import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import cors from "cors";
import cookieParser from "cookie-parser";
import routes from "./routes";
import webhooksRouter from "./routes/webhooks";
import { attachUserId } from "./lib/auth";
import { trackVisitor } from "./middleware/visitor";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Middleware
app.use(cors());

// Mux webhooks MUST receive the raw body for signature verification —
// mount this path-specific raw parser BEFORE the global express.json().
app.use("/api/webhooks/mux", express.raw({ type: "application/json" }));

app.use(express.json());
app.use(cookieParser());
app.use(attachUserId);
app.use((req, res, next) => {
  // Fire-and-forget visitor tracking.
  trackVisitor(req, res).catch((err) =>
    console.error("trackVisitor error:", err),
  );
  next();
});

// Webhook routes (no auth middleware needed — verified by Mux signature)
app.use("/api", webhooksRouter);

// API Routes
app.use("/api", routes);

// Health check
app.get("/health", (_req, res) => res.json({ status: "ok" }));

// Serve frontend in production
// On Render, the build command puts the frontend dist in artifacts/blyze/dist
// Our current file is in artifacts/api-server/dist/index.mjs (after esbuild)
// So __dirname is artifacts/api-server/dist
// Serve frontend in production
const possibleDistPaths = [
  path.resolve(__dirname, "../../blyze/dist"),
  path.resolve(__dirname, "../../../artifacts/blyze/dist"),
  path.resolve(process.cwd(), "artifacts/blyze/dist"),
  path.resolve(process.cwd(), "blyze/dist"),
  "/opt/render/project/src/artifacts/blyze/dist"
];

let frontendDist = "";
for (const p of possibleDistPaths) {
  if (fs.existsSync(p)) {
    frontendDist = p;
    break;
  }
}

// Debug endpoint to check filesystem structure (owner only)
app.get("/api/debug/paths", (req, res) => {
  const muxEnv = {};
  Object.keys(process.env).forEach(k => {
    if (k.includes("MUX")) {
      muxEnv[k] = {
        length: process.env[k]?.length || 0,
        hasLeadingSpace: process.env[k]?.startsWith(" ") || false,
        hasTrailingSpace: process.env[k]?.endsWith(" ") || false,
      };
    }
  });

  res.json({
    cwd: process.cwd(),
    __dirname,
    possibleDistPaths,
    actualDistPath: frontendDist,
    envKeys: Object.keys(process.env).filter(k => k.includes("MUX")),
    muxEnv,
    filesInCwd: fs.existsSync(process.cwd()) ? fs.readdirSync(process.cwd()) : [],
    filesInParent: fs.existsSync(path.resolve(process.cwd(), "..")) ? fs.readdirSync(path.resolve(process.cwd(), "..")) : [],
  });
});

if (frontendDist) {
  console.log("Serving frontend from:", frontendDist);
  app.use(express.static(frontendDist));
  app.get("*", (req, res) => {
    // If it's an API route that wasn't matched, return 404
    if (req.path.startsWith("/api")) return res.status(404).json({ error: "API route not found" });
    
    // Otherwise serve index.html for SPA routing
    const indexPath = path.join(frontendDist, "index.html");
    if (fs.existsSync(indexPath)) {
      res.sendFile(indexPath);
    } else {
      res.status(404).send(`Kryv API is running, but index.html was not found in ${frontendDist}`);
    }
  });
} else {
  // Fallback for when the frontend isn't built or path is wrong
  app.get("/", (req, res) => {
    res.send(`Kryv API is running. Frontend not found. Checked paths: ${possibleDistPaths.join(", ")}`);
  });
}

export default app;
