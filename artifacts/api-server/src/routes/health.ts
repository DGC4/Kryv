import { Router, type IRouter } from "express";
import { HealthCheckResponse } from "@workspace/api-zod";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

import { fastpix } from "../lib/fastpix";

const router: IRouter = Router();

router.get("/healthz", async (_req, res) => {
  let dbStatus = "ok";

  let fastpixStatus = "ok";
  let errors: string[] = [];

  try {
    await db.execute(sql`SELECT 1`);
  } catch (err: any) {
    dbStatus = "error";
    errors.push(`Database error: ${err.message}`);
  }



  try {
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

    (fastpixStatus === "ok" || fastpixStatus === "not_configured")
      ? "ok" 
      : "degraded";

  res.json({
    status,
    database: dbStatus,

    fastpix: fastpixStatus,
    errors: errors.length > 0 ? errors : undefined,
    timestamp: new Date().toISOString(),
  });
});

export default router;
