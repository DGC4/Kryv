import express from "express";
import path from "path";
import fs from "fs";
import cors from "cors";
import cookieParser from "cookie-parser";
import routes from "./routes";
import webhooksRouter from "./routes/webhooks";
import { attachUserId } from "./lib/auth";
import { trackVisitor } from "./middleware/visitor";

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
  trackVisitor(req, res, () => {}).catch(err => console.error("trackVisitor error:", err));
  next();
});

// Webhook routes (no auth middleware needed — verified by Mux signature)
app.use("/api", webhooksRouter);

// API Routes
app.use("/api", routes);

// Health check
app.get("/health", (_req, res) => res.json({ status: "ok" }));

// Serve frontend in production
const frontendDist = path.join(__dirname, "..", "..", "blyze", "dist");
if (fs.existsSync(frontendDist)) {
  app.use(express.static(frontendDist));
  app.get("*", (req, res) => {
    if (req.path.startsWith("/api")) return res.status(404).end();
    res.sendFile(path.join(frontendDist, "index.html"));
  });
}

export default app;
