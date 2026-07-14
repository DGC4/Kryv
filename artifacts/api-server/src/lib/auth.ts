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

// The platform owner account is identified by this username (case-insensitive,
// spaces/punctuation ignored) and is auto-promoted to role "owner" the moment
// it signs in — there is no separate admin-invite flow yet.
const OWNER_USERNAME_KEY = "fanodgc";
function normalizeUsernameKey(username: string): string {
  return username.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/**
 * JIT-provisions a row in our `users` table for the given Clerk user id,
 * pulling display name / avatar from Clerk on first sight and reusing the
 * local row afterward. Auto-promotes the designated owner username to role
 * "owner" on creation or on any later sign-in if it hasn't been promoted yet.
 */
export async function getOrCreateUser(userId: string) {
  const [existing] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, userId));
  if (existing) {
    if (
      existing.role !== "owner" &&
      normalizeUsernameKey(existing.username) === OWNER_USERNAME_KEY
    ) {
      const [promoted] = await db
        .update(usersTable)
        .set({ role: "owner" })
        .where(eq(usersTable.id, userId))
        .returning();
      return promoted ?? existing;
    }
    return existing;
  }

  const clerkUser = await clerkClient.users.getUser(userId);
  const username =
    clerkUser.username ||
    [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(" ") ||
    clerkUser.emailAddresses[0]?.emailAddress?.split("@")[0] ||
    "viewer";
  const role = normalizeUsernameKey(username) === OWNER_USERNAME_KEY ? "owner" : "user";

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
