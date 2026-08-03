import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { eq } from "drizzle-orm";
import { db, usersTable } from "@workspace/db";

// JWT_SECRET MUST be set in production (enforced in app.ts at startup).
// The fallback is only used in local development (NODE_ENV !== 'production').
const JWT_SECRET = process.env.JWT_SECRET || "kryv-dev-only-secret-do-not-use-in-production";

export interface AuthPayload {
  userId: number;
  username: string;
  role: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthPayload;
    }
  }
}

/** Signs a new JWT for the given user. */
export function signToken(payload: AuthPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "30d" });
}

/** Verifies a JWT and returns the payload. */
export function verifyToken(token: string): AuthPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as AuthPayload;
  } catch {
    return null;
  }
}

/** Attaches `req.user` when a valid Bearer token is provided. */
export async function attachUserId(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.slice(7);
    const payload = verifyToken(token);
    if (payload) {
      req.user = payload;
    }
  }
  next();
}

/** Rejects the request with 401 unless a valid token is provided. */
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

/** Rejects the request with 403 unless the caller has role "owner". */
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

// ─────────────────────────────────────────────────────────────────────────────
// OWNER LOCK — FanoDGC is the permanent, irrevocable platform owner.
// ─────────────────────────────────────────────────────────────────────────────
export const OWNER_USERNAME = "FanoDGC";

export function isOwnerAccount(username: string): boolean {
  return username.toLowerCase() === OWNER_USERNAME.toLowerCase();
}
