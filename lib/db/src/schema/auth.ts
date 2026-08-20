import {
  index,
  integer,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { usersTable } from "./users";

/**
 * Platform-wide privileges are explicit, reviewable grants. They are deliberately
 * independent of usernames so a display-name change or public registration can
 * never create administrative authority.
 */
export const platformRolesTable = pgTable(
  "platform_roles",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    role: text("role").notNull(),
    grantedByUserId: integer("granted_by_user_id").references(() => usersTable.id, {
      onDelete: "set null",
    }),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    revokedByUserId: integer("revoked_by_user_id").references(() => usersTable.id, {
      onDelete: "set null",
    }),
    revocationReason: text("revocation_reason"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    userRoleUnique: uniqueIndex("platform_roles_user_role_unique").on(
      table.userId,
      table.role,
    ),
    activeRoleIdx: index("platform_roles_active_role_idx").on(
      table.role,
      table.revokedAt,
      table.expiresAt,
    ),
  }),
);

/**
 * Browser sessions hold only a random opaque value in an HttpOnly cookie. The
 * database stores a one-way hash, allowing a session to be revoked immediately
 * without exposing usable credentials if the database is inspected.
 */
export const userSessionsTable = pgTable(
  "user_sessions",
  {
    id: text("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull(),
    sessionVersion: integer("session_version").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    revokedReason: text("revoked_reason"),
    ipHash: text("ip_hash"),
    userAgent: text("user_agent"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    tokenHashUnique: uniqueIndex("user_sessions_token_hash_unique").on(table.tokenHash),
    activeUserIdx: index("user_sessions_user_active_idx").on(
      table.userId,
      table.revokedAt,
      table.expiresAt,
    ),
  }),
);

export type PlatformRole = typeof platformRolesTable.$inferSelect;
export type UserSession = typeof userSessionsTable.$inferSelect;
