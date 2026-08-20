import crypto from "crypto";
import type { Request, Response } from "express";
import { db, visitorsTable } from "@workspace/db";
import { and, eq, sql } from "drizzle-orm";

const TRACKING_ENABLED = process.env.KRYV_ACTIVITY_TRACKING_ENABLED === "true";
const TRACKING_SALT = process.env.KRYV_ACTIVITY_TRACKING_SALT?.trim();

function hashIdentifier(value: string): string | null {
  if (!TRACKING_SALT || !value) return null;
  return crypto.createHmac("sha256", TRACKING_SALT).update(value).digest("base64url");
}

/**
 * Collects minimal first-party navigation telemetry only when explicitly enabled.
 * API calls, non-GET requests, static assets, raw IP addresses, user agents, and
 * untrusted browser fingerprints are intentionally excluded from persistence.
 */
export async function trackVisitor(req: Request, _res: Response): Promise<void> {
  if (!TRACKING_ENABLED || !TRACKING_SALT) return;
  if (req.method !== "GET" || req.path.startsWith("/api") || req.path.includes(".")) return;

  const ip = hashIdentifier(req.ip || req.socket.remoteAddress || "");
  const userAgent = hashIdentifier(req.header("user-agent") || "");
  if (!ip || !userAgent) return;

  try {
    const [existing] = await db
      .select()
      .from(visitorsTable)
      .where(and(eq(visitorsTable.ip, ip), eq(visitorsTable.userAgent, userAgent)))
      .limit(1);

    if (existing) {
      await db
        .update(visitorsTable)
        .set({
          visitCount: sql`${visitorsTable.visitCount} + 1`,
          lastPage: req.path,
          updatedAt: new Date(),
          userId: req.user?.userId || existing.userId,
          username: req.user?.username || existing.username,
        })
        .where(eq(visitorsTable.id, existing.id));
      return;
    }

    await db.insert(visitorsTable).values({
      ip,
      userAgent,
      fingerprint: null,
      lastPage: req.path,
      visitCount: 1,
      userId: req.user?.userId,
      username: req.user?.username,
    });
  } catch (error) {
    console.error("Visitor tracking failed", error);
  }
}
