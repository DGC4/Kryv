import crypto from "node:crypto";
import type { Request } from "express";
import { and, eq, gt, isNull, or } from "drizzle-orm";
import {
  auditLogsTable,
  channelRolesTable,
  channelsTable,
  db,
} from "@workspace/db";

export type ChannelPermission =
  | "chat.moderate"
  | "chat.configure"
  | "stream.metadata"
  | "stream.manage"
  | "content.manage"
  | "analytics.view"
  | "community.manage";

const OWNER_CHANNEL_PERMISSIONS: readonly ChannelPermission[] = [
  "chat.moderate",
  "chat.configure",
  "stream.metadata",
  "stream.manage",
  "content.manage",
  "analytics.view",
  "community.manage",
];

const DEFAULT_MODERATOR_PERMISSIONS: readonly ChannelPermission[] = [
  "chat.moderate",
  "chat.configure",
  "community.manage",
];

function normalizePermissions(value: unknown, role: string): Set<ChannelPermission> {
  if (Array.isArray(value)) {
    return new Set(value.filter((item): item is ChannelPermission => typeof item === "string"));
  }

  if (value && typeof value === "object") {
    return new Set(
      Object.entries(value)
        .filter(([, enabled]) => enabled === true)
        .map(([permission]) => permission as ChannelPermission),
    );
  }

  return new Set(
    role === "moderator" ? DEFAULT_MODERATOR_PERMISSIONS : [],
  );
}

export async function hasChannelPermission(
  user: Express.Request["user"] | undefined,
  channelId: number,
  permission: ChannelPermission,
): Promise<boolean> {
  if (!user || !Number.isSafeInteger(channelId) || channelId < 1) {
    return false;
  }

  if (user.role === "owner") {
    return true;
  }

  const [channel] = await db
    .select({ ownerUserId: channelsTable.ownerUserId })
    .from(channelsTable)
    .where(eq(channelsTable.id, channelId));

  if (!channel) {
    return false;
  }

  if (channel.ownerUserId === user.userId) {
    return OWNER_CHANNEL_PERMISSIONS.includes(permission);
  }

  const [assignment] = await db
    .select({ role: channelRolesTable.role, permissions: channelRolesTable.permissions })
    .from(channelRolesTable)
    .where(
      and(
        eq(channelRolesTable.channelId, channelId),
        eq(channelRolesTable.userId, user.userId),
        isNull(channelRolesTable.revokedAt),
        or(isNull(channelRolesTable.expiresAt), gt(channelRolesTable.expiresAt, new Date())),
      ),
    );

  if (!assignment) {
    return false;
  }

  return normalizePermissions(assignment.permissions, assignment.role).has(permission);
}

export interface AuditEntry {
  action: string;
  targetType: string;
  targetId?: string | number | null;
  reason?: string | null;
  beforeState?: Record<string, unknown> | null;
  afterState?: Record<string, unknown> | null;
}

function hashIp(ip: string | undefined): string | null {
  if (!ip) {
    return null;
  }

  const salt = process.env.AUDIT_IP_HASH_SALT;
  if (!salt) {
    return null;
  }

  return crypto.createHash("sha256").update(`${salt}:${ip}`).digest("hex");
}

export async function writeAuditLog(req: Request, entry: AuditEntry): Promise<void> {
  try {
    await db.insert(auditLogsTable).values({
      actorUserId: req.user?.userId ?? null,
      action: entry.action,
      targetType: entry.targetType,
      targetId: entry.targetId === undefined || entry.targetId === null ? null : String(entry.targetId),
      reason: entry.reason ?? null,
      beforeState: entry.beforeState ?? null,
      afterState: entry.afterState ?? null,
      requestId: typeof req.headers["x-request-id"] === "string" ? req.headers["x-request-id"] : null,
      sessionId: typeof req.headers["x-session-id"] === "string" ? req.headers["x-session-id"] : null,
      ipHash: hashIp(req.ip),
    });
  } catch (error) {
    // Audit records must never reveal sensitive state or take down a safe request.
    // The caller's request ID allows infrastructure logs to correlate this failure.
    console.error("Failed to write audit log", {
      action: entry.action,
      targetType: entry.targetType,
      requestId: req.headers["x-request-id"],
      error: error instanceof Error ? error.message : "unknown error",
    });
  }
}
