import type { Request, Response, NextFunction } from "express";
import { db, visitorsTable } from "@workspace/db";
import { eq, and, sql } from "drizzle-orm";

export async function trackVisitor(req: Request, _res: Response) {
  // Skip for non-GET requests or static assets if needed, but for now we track all
  if (req.path.startsWith("/api/webhooks")) return;

  const forwarded = req.header("x-forwarded-for");
  const ip =
    req.ip ||
    (Array.isArray(forwarded) ? forwarded[0] : forwarded?.split(",")[0]) ||
    req.socket.remoteAddress ||
    "";
  const userAgent = req.header("user-agent") || "";
  const fingerprint = req.header("x-fingerprint");

  try {
    const [existing] = await db
      .select()
      .from(visitorsTable)
      .where(
        fingerprint 
          ? eq(visitorsTable.fingerprint, fingerprint) 
          : and(eq(visitorsTable.ip, ip), eq(visitorsTable.userAgent, userAgent))
      );

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
    } else {
      await db.insert(visitorsTable).values({
        ip,
        userAgent,
        fingerprint,
        lastPage: req.path,
        visitCount: 1,
        userId: req.user?.userId,
        username: req.user?.username,
      });
    }
  } catch (err) {
    console.error("Visitor tracking failed:", err);
  }

}
