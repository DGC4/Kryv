import express, { type Express, type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import { clerkMiddleware } from "@clerk/express";
import { publishableKeyFromHost } from "@clerk/shared/keys";
import router from "./routes";
import webhooksRouter from "./routes/webhooks";
import { logger } from "./lib/logger";
import {
  CLERK_PROXY_PATH,
  clerkProxyMiddleware,
  getClerkProxyHost,
} from "./middlewares/clerkProxyMiddleware";
import path from "path";
import fs from "fs";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);

app.use(CLERK_PROXY_PATH, clerkProxyMiddleware());

app.use(cors({ credentials: true, origin: true }));

// Mux webhooks need the raw request body for signature verification, so this
// is mounted before the JSON body parser below.
app.use(
  "/api/webhooks/mux",
  express.raw({ type: "application/json" }),
  webhooksRouter,
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(
  clerkMiddleware((req) => ({
    publishableKey: publishableKeyFromHost(
      getClerkProxyHost(req) ?? "",
      process.env.CLERK_PUBLISHABLE_KEY,
    ),
  })),
);

app.use("/api", router);

// Simple health check
app.get("/health", (_req: Request, res: Response) => {
  res.json({ status: "ok" });
});

// Provide a friendly root route to avoid "Cannot GET /" in browsers.
app.get("/", (_req: Request, res: Response) => {
  res.redirect("/health");
});

// If a built frontend exists in ../blyze/dist, serve it as static files so a single
// service can host both API and frontend. This is optional and will only run when
// the dist folder exists in the expected location after a build.
const frontendDist = path.join(__dirname, "..", "..", "blyze", "dist");
try {
  if (fs.existsSync(frontendDist)) {
    app.use(express.static(frontendDist));
    // Serve index.html for any route not handled by /api
    app.get("*", (req: Request, res: Response) => {
      // Don't interfere with API routes or Clerk proxy path
      if (req.path.startsWith("/api") || req.path.startsWith(CLERK_PROXY_PATH)) {
        // Let other handlers handle it (or return 404)
        return res.status(404).end();
      }
      res.sendFile(path.join(frontendDist, "index.html"));
    });
  }
} catch (err) {
  // eslint-disable-next-line no-console
  console.warn("Error while trying to enable static frontend serving:", err);
}

export default app;
