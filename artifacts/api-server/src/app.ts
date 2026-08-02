import express from "express";
import path from "path";
import fs from "fs";
import cors from "cors";
import cookieParser from "cookie-parser";
import routes from "./routes";
import { clerkMiddleware } from "@clerk/express";
import { CLERK_PROXY_PATH, clerkProxyMiddleware } from "./middlewares/clerkProxyMiddleware";
import { attachUserId } from "./lib/auth";

const app = express();

// Middleware
app.use(CLERK_PROXY_PATH, clerkProxyMiddleware());
app.use(cors());
app.use(express.json());
app.use(cookieParser());
app.use(clerkMiddleware());
app.use(attachUserId);

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
