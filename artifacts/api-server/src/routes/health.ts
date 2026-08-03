import { Router, type IRouter } from "express";
import { HealthCheckResponse } from "@workspace/api-zod";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { getMux } from "../lib/mux";
import { fastpix } from "../lib/fastpix";

const router: IRouter = Router();

router.get("/healthz", async (_req, res) => {
  let dbStatus = "ok";
  let muxStatus = "ok";
  let fastpixStatus = "ok";
  let errors: string[] = [];

  try {
    await db.execute(sql`SELECT 1`);
  } catch (err: any) {
    dbStatus = "error";
    errors.push(`Database error: ${err.message}`);
  }

  try {
    const mux = getMux();
    // A simple call to verify tokens
    await mux.video.assets.list({ limit: 1 });
  } catch (err: any) {
    if (err.name === "MuxNotConfiguredError") {
      muxStatus = "not_configured";
    } else {
      muxStatus = "error";
      errors.push(`Mux error: ${err.message}`);
    }
  }

  try {
    // Verify FastPix tokens
    await fastpix.video.media.list({ limit: 1 });
  } catch (err: any) {
    if (err.message?.includes("configured")) {
      fastpixStatus = "not_configured";
    } else {
      fastpixStatus = "error";
      errors.push(`FastPix error: ${err.message}`);
    }
  }

  const status = 
    dbStatus === "ok" && 
    (muxStatus === "ok" || muxStatus === "not_configured") &&
    (fastpixStatus === "ok" || fastpixStatus === "not_configured")
      ? "ok" 
      : "degraded";

  res.json({
    status,
    database: dbStatus,
    mux: muxStatus,
    fastpix: fastpixStatus,
    errors: errors.length > 0 ? errors : undefined,
    timestamp: new Date().toISOString(),
  });
});

export default router;
