import { pgTable, text, serial, integer, timestamp, jsonb, boolean } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const visitorsTable = pgTable("visitors", {
  id: serial("id").primaryKey(),
  fingerprint: text("fingerprint"), // Browser fingerprint
  ip: text("ip"),
  userAgent: text("user_agent"),
  deviceType: text("device_type"),
  os: text("os"),
  browser: text("browser"),

  // Location data
  country: text("country"),
  city: text("city"),
  
  // Navigation tracking
  lastPage: text("last_page"),
  visitCount: integer("visit_count").notNull().default(1),
  
  // Link to registered user
  userId: integer("user_id").references(() => usersTable.id, { onDelete: "set null" }),
  username: text("username"),

  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
