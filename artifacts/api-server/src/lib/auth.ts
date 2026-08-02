import type { NextFunction, Request, Response } from "express";
import { getAuth, clerkClient } from "@clerk/express";
import { eq } from "drizzle-orm";
import { db, usersTable } from "@workspace/db";

/** Attaches `req.userId` when signed in, but never rejects the request. */
export async function attachUserId(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  const auth = getAuth(req);
  (req as Request & { userId?: string }).userId = auth?.userId ?? undefined;
  next();
}

/** Rejects the request with 401 unless the caller is signed in. */
export function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const auth = getAuth(req);
  if (!auth?.userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  (req as Request & { userId?: string }).userId = auth.userId;
  next();
}

/** Rejects the request with 403 unless the caller's local user row has role "owner". */
export async function requireOwner(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const auth = getAuth(req);
  if (!auth?.userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const user = await getOrCreateUser(auth.userId);
  if (!user || user.role !== "owner") {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  next();
}

// ─────────────────────────────────────────────────────────────────────────────
// OWNER LOCK — FanoDGC is the permanent, irrevocable platform owner.
// This constant is the single source of truth. No API, no admin action,
// no database update can ever demote this account from "owner" role.
// The canonical display username is always preserved exactly as-is.
// ─────────────────────────────────────────────────────────────────────────────
const OWNER_USERNAME_KEY = "fanodgc";
const OWNER_DISPLAY_USERNAME = "FanoDGC";

function normalizeUsernameKey(username: string): string {
  return username.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function isOwnerAccount(username: string): boolean {
  return normalizeUsernameKey(username) === OWNER_USERNAME_KEY;
}

/**
 * JIT-provisions a row in our `users` table for the given Clerk user id.
 *
 * Owner-lock rules (enforced on EVERY call, not just creation):
 *  1. If the account's username normalizes to "fanodgc", the stored username
 *     is ALWAYS "FanoDGC" and the role is ALWAYS "owner" — no exceptions.
 *  2. Once a user row exists, the username is never changed (sign-up choice
 *     belongs to the user). Exception: rule #1 always overrides.
 *  3. No code path can demote the owner account to any other role.
 */
export async function getOrCreateUser(userId: string) {
  const [existing] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, userId));

  if (existing) {
    // Always re-enforce owner lock — covers any external DB tampering.
    if (isOwnerAccount(existing.username)) {
      if (existing.role !== "owner" || existing.username !== OWNER_DISPLAY_USERNAME) {
        const [enforced] = await db
          .update(usersTable)
          .set({ role: "owner", username: OWNER_DISPLAY_USERNAME })
          .where(eq(usersTable.id, userId))
          .returning();
        return enforced ?? existing;
      }
    }
    return existing;
  }

  // New user — pull display info from Clerk.
  const clerkUser = await clerkClient.users.getUser(userId);

  // Prefer Clerk username; fall back to name parts or email prefix.
  const rawUsername =
    clerkUser.username ||
    [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join("") ||
    clerkUser.emailAddresses[0]?.emailAddress?.split("@")[0] ||
    "viewer";

  // Apply owner lock: canonical display name + role regardless of Clerk value.
  const username = isOwnerAccount(rawUsername) ? OWNER_DISPLAY_USERNAME : rawUsername;
  const role = isOwnerAccount(rawUsername) ? "owner" : "user";

  const [created] = await db
    .insert(usersTable)
    .values({
      id: userId,
      username,
      avatarUrl: clerkUser.imageUrl || null,
      role,
    })
    .onConflictDoNothing()
    .returning();

  if (created) return created;

  // Lost a race with a concurrent request — re-read.
  const [row] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, userId));
  return row;
}
