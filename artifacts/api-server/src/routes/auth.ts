import { Router } from "express";
import bcrypt from "bcryptjs";
import { or, sql } from "drizzle-orm";
import { db, usersTable } from "@workspace/db";
import {
  clearSessionCookie,
  establishSession,
  OWNER_USERNAME,
  revokeCurrentSession,
} from "../lib/auth";
import { logActivity, trackDevice } from "../lib/tracking";
import { z } from "zod";

const router = Router();

const signupSchema = z.object({
  email: z.string().email().max(320),
  username: z.string().trim().min(3).max(30).regex(/^[A-Za-z0-9_]+$/, "Use only letters, numbers, and underscores."),
  password: z.string().min(12, "Use a password with at least 12 characters.").max(128),
});

const loginSchema = z.object({
  identifier: z.string().trim().min(1).max(320),
  password: z.string().min(1).max(128),
});

function publicUser(user: typeof usersTable.$inferSelect) {
  return {
    id: user.id,
    email: user.email,
    username: user.username,
    // This legacy column is display-only. Middleware resolves owner access from
    // the explicit platform_roles grant on every authenticated request.
    role: user.role === "owner" ? "owner" : "user",
    avatarUrl: user.avatarUrl,
  };
}

router.post("/signup", async (req, res): Promise<void> => {
  try {
    const parsed = signupSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid sign-up details" });
      return;
    }

    const { email, username, password } = parsed.data;
    if (username.toLowerCase() === OWNER_USERNAME.toLowerCase()) {
      res.status(409).json({ error: "This username is reserved." });
      return;
    }

    const [existing] = await db
      .select({ id: usersTable.id })
      .from(usersTable)
      .where(
        or(
          sql`LOWER(${usersTable.email}) = LOWER(${email})`,
          sql`LOWER(${usersTable.username}) = LOWER(${username})`,
        ),
      )
      .limit(1);

    if (existing) {
      res.status(409).json({ error: "Email or username already taken" });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const [user] = await db
      .insert(usersTable)
      .values({
        email,
        username,
        passwordHash,
        role: "user",
      })
      .returning();

    if (!user) throw new Error("User creation returned no record");
    await establishSession(req, res, user);

    void trackDevice(req, user.id).catch((error) => console.error("trackDevice error:", error));
    void logActivity(req, "signup", { userId: user.id }).catch((error) => console.error("logActivity error:", error));

    res.status(201).json({ user: publicUser(user) });
  } catch (error) {
    console.error("Signup failed", error);
    res.status(500).json({ error: "Unable to create account. Please try again." });
  }
});

router.post("/login", async (req, res): Promise<void> => {
  try {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid login details" });
      return;
    }

    const { identifier, password } = parsed.data;
    const [user] = await db
      .select()
      .from(usersTable)
      .where(
        or(
          sql`LOWER(${usersTable.email}) = LOWER(${identifier})`,
          sql`LOWER(${usersTable.username}) = LOWER(${identifier})`,
        ),
      )
      .limit(1);

    if (!user || user.banned) {
      res.status(401).json({ error: "Invalid credentials" });
      return;
    }

    const passwordMatch = await bcrypt.compare(password, user.passwordHash);
    if (!passwordMatch) {
      res.status(401).json({ error: "Invalid credentials" });
      return;
    }

    await db.update(usersTable).set({ lastLoginAt: new Date() }).where(sql`${usersTable.id} = ${user.id}`);
    await establishSession(req, res, user);

    void trackDevice(req, user.id).catch((error) => console.error("trackDevice error:", error));
    void logActivity(req, "login", { userId: user.id }).catch((error) => console.error("logActivity error:", error));

    res.json({ user: publicUser(user) });
  } catch (error) {
    console.error("Login failed", error);
    res.status(500).json({ error: "Unable to sign in. Please try again." });
  }
});

router.post("/logout", async (req, res): Promise<void> => {
  try {
    await revokeCurrentSession(req);
  } catch (error) {
    // The cookie is cleared even if a stale/expired session cannot be updated.
    console.error("Logout session revocation failed", error);
  }
  clearSessionCookie(res);
  res.sendStatus(204);
});

export default router;
