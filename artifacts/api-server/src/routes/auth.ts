import { Router } from "express";
import bcrypt from "bcryptjs";
import { eq, or } from "drizzle-orm";
import { db, usersTable } from "@workspace/db";
import { signToken, OWNER_USERNAME } from "../lib/auth";
import { z } from "zod";

const router = Router();

const signupSchema = z.object({
  email: z.string().email(),
  username: z.string().min(3).max(30),
  password: z.string().min(6),
});

const loginSchema = z.object({
  identifier: z.string(), // email or username
  password: z.string(),
});

router.post("/signup", async (req, res) => {
  try {
    const parsed = signupSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.message });
    }

    const { email, username, password } = parsed.data;

    // Check if user already exists
    const [existing] = await db
      .select()
      .from(usersTable)
      .where(or(eq(usersTable.email, email), eq(usersTable.username, username)));

    if (existing) {
      return res.status(409).json({ error: "Email or username already taken" });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    
    // Check if this is the owner account
    const role = username.toLowerCase() === OWNER_USERNAME.toLowerCase() ? "owner" : "user";
    const finalUsername = role === "owner" ? OWNER_USERNAME : username;

    const [user] = await db
      .insert(usersTable)
      .values({
        email,
        username: finalUsername,
        passwordHash,
        role,
      })
      .returning();

    const token = signToken({
      userId: user.id,
      username: user.username,
      role: user.role,
    });

    res.status(201).json({
      token,
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        role: user.role,
        avatarUrl: user.avatarUrl,
      },
    });
  } catch (err) {
    console.error("Signup error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/login", async (req, res) => {
  try {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.message });
    }

    const { identifier, password } = parsed.data;

    const [user] = await db
      .select()
      .from(usersTable)
      .where(or(eq(usersTable.email, identifier), eq(usersTable.username, identifier)));

    if (!user) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const passwordMatch = await bcrypt.compare(password, user.passwordHash);
    if (!passwordMatch) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    // Enforce owner lock on login just in case
    if (user.username.toLowerCase() === OWNER_USERNAME.toLowerCase() && user.role !== "owner") {
        await db.update(usersTable).set({ role: "owner", username: OWNER_USERNAME }).where(eq(usersTable.id, user.id));
        user.role = "owner";
        user.username = OWNER_USERNAME;
    }

    const token = signToken({
      userId: user.id,
      username: user.username,
      role: user.role,
    });

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        role: user.role,
        avatarUrl: user.avatarUrl,
      },
    });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
