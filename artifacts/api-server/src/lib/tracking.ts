import { db, activityLogsTable, deviceHistoryTable, visitorsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import type { Request } from "express";

export async function logActivity(req: Request, action: string, metadata: any = {}) {
  const userId = req.user?.userId;
  const ip = req.ip || req.header("x-forwarded-for") || req.socket.remoteAddress;
  const userAgent = req.header("user-agent");

  try {
    await db.insert(activityLogsTable).values({
      userId,
      action,
      ip,
      userAgent,
      metadata,
    });
  } catch (err) {
    console.error("Failed to log activity:", err);
  }
}

export async function trackDevice(req: Request, userId: number) {
  const ip = req.ip || req.header("x-forwarded-for") || req.socket.remoteAddress;
  const userAgent = req.header("user-agent");
  const fingerprint = req.header("x-fingerprint"); // Optional header

  try {
    const [existing] = await db
      .select()
      .from(deviceHistoryTable)
      .where(
        and(
          eq(deviceHistoryTable.userId, userId),
          eq(deviceHistoryTable.ip, ip || ""),
          eq(deviceHistoryTable.deviceBrowser, userAgent || "")
        )
      );

    if (existing) {
      await db
        .update(deviceHistoryTable)
        .set({
          loginCount: existing.loginCount + 1,
          lastSeen: new Date(),
        })
        .where(eq(deviceHistoryTable.id, existing.id));
    } else {
      await db.insert(deviceHistoryTable).values({
        userId,
        ip,
        deviceBrowser: userAgent,
        fingerprint,
        loginCount: 1,
      });
    }
  } catch (err) {
    console.error("Failed to track device:", err);
  }
}
