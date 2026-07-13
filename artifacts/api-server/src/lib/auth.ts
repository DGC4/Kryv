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

/**
 * JIT-provisions a row in our `users` table for the given Clerk user id,
 * pulling display name / avatar from Clerk on first sight and reusing the
 * local row afterward.
 */
export async function getOrCreateUser(userId: string) {
  const [existing] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, userId));
  if (existing) return existing;

  const clerkUser = await clerkClient.users.getUser(userId);
  const username =
    clerkUser.username ||
    [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(" ") ||
    clerkUser.emailAddresses[0]?.emailAddress?.split("@")[0] ||
    "viewer";

  const [created] = await db
    .insert(usersTable)
    .values({
      id: userId,
      username,
      avatarUrl: clerkUser.imageUrl || null,
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
