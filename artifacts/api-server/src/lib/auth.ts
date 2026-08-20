import crypto from "crypto";
import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { and, eq, gt, isNull, or } from "drizzle-orm";
import {
  db,
  platformRolesTable,
  userSessionsTable,
  usersTable,
} from "@workspace/db";

const JWT_SECRET =
  process.env.JWT_SECRET || "kryv-dev-only-secret-do-not-use-in-production";
const REALTIME_TOKEN_SECRET = process.env.KRYV_REALTIME_TOKEN_SECRET?.trim();
const SESSION_DAYS = Number.parseInt(process.env.KRYV_SESSION_DAYS ?? "7", 10);
const SESSION_TTL_MS =
  Math.max(1, Math.min(Number.isFinite(SESSION_DAYS) ? SESSION_DAYS : 7, 30)) *
  24 *
  60 *
  60 *
  1000;
const SESSION_COOKIE_NAME =
  process.env.NODE_ENV === "production"
    ? "__Host-kryv_session"
    : "kryv_session";
const PROFILE_GRANT_COOKIE_NAME =
  process.env.NODE_ENV === "production"
    ? "__Host-kryv_profile"
    : "kryv_profile";
const PROFILE_GRANT_TTL_MS = 15 * 60 * 1000;

export interface AuthPayload {
  userId: number;
  username: string;
  role: string;
  sessionId?: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthPayload;
      authMethod?: "session" | "bearer";
      activeProfileId?: number;
    }
  }
}

function hashOpaqueToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("base64url");
}

function randomSessionToken(): string {
  return crypto.randomBytes(32).toString("base64url");
}

function requestIpHash(req: Request): string | null {
  const rawIp = req.ip || req.socket.remoteAddress || "";
  if (!rawIp) return null;
  return crypto.createHash("sha256").update(rawIp).digest("base64url");
}

function sessionCookieOptions(expiresAt: Date) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    expires: expiresAt,
  };
}

function sessionClearCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
  };
}

function trustedRequestOrigins(req: Request): Set<string> {
  const origins = new Set<string>();
  const host = req.get("host");
  if (host) origins.add(`${req.protocol}://${host}`);

  const configured = [process.env.KRYV_APP_URL, process.env.ALLOWED_ORIGINS]
    .filter((value): value is string => Boolean(value?.trim()))
    .flatMap((value) => value.split(","))
    .map((value) => value.trim())
    .filter(Boolean);
  for (const origin of configured) origins.add(origin);
  return origins;
}

/**
 * Access JWTs remain available only for short-lived, controlled realtime
 * compatibility. Browser application sessions are opaque HttpOnly cookies and
 * are never returned to the UI.
 */
export function signToken(payload: AuthPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "15m" });
}

export function verifyToken(token: string): AuthPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as AuthPayload;
  } catch {
    return null;
  }
}

export function signRealtimeToken(payload: AuthPayload): string {
  return jwt.sign(payload, REALTIME_TOKEN_SECRET || JWT_SECRET, {
    expiresIn: "15m",
  });
}

export function verifyRealtimeToken(token: string): AuthPayload | null {
  if (REALTIME_TOKEN_SECRET) {
    try {
      return jwt.verify(token, REALTIME_TOKEN_SECRET) as AuthPayload;
    } catch {
      // Dedicated realtime credentials are required whenever their secret is configured.
      return null;
    }
  }
  return verifyToken(token);
}

async function resolvePlatformRole(
  userId: number,
  now: Date,
): Promise<"user" | "owner"> {
  const [ownerGrant] = await db
    .select({ id: platformRolesTable.id })
    .from(platformRolesTable)
    .where(
      and(
        eq(platformRolesTable.userId, userId),
        eq(platformRolesTable.role, "owner"),
        isNull(platformRolesTable.revokedAt),
        or(
          isNull(platformRolesTable.expiresAt),
          gt(platformRolesTable.expiresAt, now),
        ),
      ),
    )
    .limit(1);
  return ownerGrant ? "owner" : "user";
}

/** Creates a revocable opaque browser session and writes only its raw value to a secure cookie. */
export async function establishSession(
  req: Request,
  res: Response,
  user: typeof usersTable.$inferSelect,
): Promise<void> {
  const token = randomSessionToken();
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  const sessionId = crypto.randomUUID();

  await db.insert(userSessionsTable).values({
    id: sessionId,
    userId: user.id,
    tokenHash: hashOpaqueToken(token),
    sessionVersion: user.sessionVersion,
    expiresAt,
    ipHash: requestIpHash(req),
    userAgent: req.get("user-agent") ?? null,
  });

  res.cookie(SESSION_COOKIE_NAME, token, sessionCookieOptions(expiresAt));
}

/** Revokes only the browser session presented by this request. */
export async function revokeCurrentSession(
  req: Request,
  reason = "logout",
): Promise<void> {
  const token = req.cookies?.[SESSION_COOKIE_NAME];
  if (typeof token !== "string" || !token) return;
  await db
    .update(userSessionsTable)
    .set({ revokedAt: new Date(), revokedReason: reason })
    .where(
      and(
        eq(userSessionsTable.tokenHash, hashOpaqueToken(token)),
        isNull(userSessionsTable.revokedAt),
      ),
    );
}

/** Invalidates all active sessions for an account, for use after bans, role changes, or credential recovery. */
export async function revokeAllUserSessions(
  userId: number,
  reason: string,
): Promise<void> {
  await db.transaction(async (txn) => {
    await txn
      .update(usersTable)
      .set({ sessionVersion: crypto.randomInt(1, 2_147_483_647) })
      .where(eq(usersTable.id, userId));
    await txn
      .update(userSessionsTable)
      .set({ revokedAt: new Date(), revokedReason: reason })
      .where(
        and(
          eq(userSessionsTable.userId, userId),
          isNull(userSessionsTable.revokedAt),
        ),
      );
  });
}

export function clearSessionCookie(res: Response): void {
  res.clearCookie(SESSION_COOKIE_NAME, sessionClearCookieOptions());
  res.clearCookie(PROFILE_GRANT_COOKIE_NAME, sessionClearCookieOptions());
}

/**
 * Stores only a short-lived, signed profile selection in an HttpOnly cookie.
 * The grant is bound to the current opaque session identifier, so revoking or
 * rotating the account session automatically invalidates profile selection.
 */
export function establishActiveProfileGrant(
  req: Request,
  res: Response,
  profileId: number,
): void {
  if (!req.user?.sessionId)
    throw new Error(
      "An active session is required to select a viewer profile.",
    );
  const expiresAt = new Date(Date.now() + PROFILE_GRANT_TTL_MS);
  const token = jwt.sign(
    {
      userId: req.user.userId,
      sessionId: req.user.sessionId,
      profileId,
      purpose: "viewer_profile",
    },
    JWT_SECRET,
    { expiresIn: Math.floor(PROFILE_GRANT_TTL_MS / 1000) },
  );
  res.cookie(PROFILE_GRANT_COOKIE_NAME, token, sessionCookieOptions(expiresAt));
}

export function clearActiveProfileGrant(res: Response): void {
  res.clearCookie(PROFILE_GRANT_COOKIE_NAME, sessionClearCookieOptions());
}

/** Attaches a current, non-banned user from a revocable opaque session cookie. */
export async function attachUserId(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const token = req.cookies?.[SESSION_COOKIE_NAME];
    if (typeof token !== "string" || !token) {
      next();
      return;
    }

    const now = new Date();
    const [row] = await db
      .select({ session: userSessionsTable, user: usersTable })
      .from(userSessionsTable)
      .innerJoin(usersTable, eq(userSessionsTable.userId, usersTable.id))
      .where(
        and(
          eq(userSessionsTable.tokenHash, hashOpaqueToken(token)),
          isNull(userSessionsTable.revokedAt),
          gt(userSessionsTable.expiresAt, now),
        ),
      )
      .limit(1);

    if (
      !row ||
      row.user.banned ||
      row.session.sessionVersion !== row.user.sessionVersion
    ) {
      if (row) {
        await db
          .update(userSessionsTable)
          .set({
            revokedAt: now,
            revokedReason: row.user.banned
              ? "account_banned"
              : "session_version_changed",
          })
          .where(eq(userSessionsTable.id, row.session.id));
      }
      next();
      return;
    }

    const role = await resolvePlatformRole(row.user.id, now);
    req.user = {
      userId: row.user.id,
      username: row.user.username,
      role,
      sessionId: row.session.id,
    };
    req.authMethod = "session";

    const profileGrant = req.cookies?.[PROFILE_GRANT_COOKIE_NAME];
    if (typeof profileGrant === "string" && profileGrant) {
      try {
        const payload = jwt.verify(profileGrant, JWT_SECRET) as {
          userId?: unknown;
          sessionId?: unknown;
          profileId?: unknown;
          purpose?: unknown;
        };
        if (
          payload.purpose === "viewer_profile" &&
          payload.userId === row.user.id &&
          payload.sessionId === row.session.id &&
          Number.isInteger(payload.profileId) &&
          (payload.profileId as number) > 0
        ) {
          req.activeProfileId = payload.profileId as number;
        }
      } catch {
        // A stale, expired, or malformed selection grant is ignored. It never
        // changes account authentication and will be replaced on profile select.
      }
    }

    // Opportunistic activity tracking never changes the authorization decision.
    void db
      .update(userSessionsTable)
      .set({ lastSeenAt: now })
      .where(eq(userSessionsTable.id, row.session.id));
  } catch (error) {
    // Authentication failures must not make public routes unavailable.
    console.error("Session authentication failed", error);
  }
  next();
}

/**
 * Cookie-authenticated unsafe requests must carry a trusted Origin. This blocks
 * cross-site form/fetch requests from exercising a signed-in browser session.
 */
export function requireTrustedSessionOrigin(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (
    !req.user ||
    req.authMethod !== "session" ||
    ["GET", "HEAD", "OPTIONS"].includes(req.method)
  ) {
    next();
    return;
  }

  const origin = req.get("origin");
  if (!origin || !trustedRequestOrigins(req).has(origin)) {
    res.status(403).json({ error: "Cross-site request blocked" });
    return;
  }
  next();
}

export function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (!req.user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  next();
}

export function requireOwner(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (!req.user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  if (req.user.role !== "owner") {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  next();
}

/** Kept only to reserve a display name in product UI; it never grants a role. */
export const OWNER_USERNAME = "FanoDGC";

export function isOwnerAccount(username: string): boolean {
  return username.toLowerCase() === OWNER_USERNAME.toLowerCase();
}
