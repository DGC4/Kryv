import { pgTable, serial, integer, text, timestamp } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const deviceHistoryTable = pgTable("device_history", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => usersTable.id, { onDelete: "cascade" }).notNull(),
  fingerprint: text("fingerprint"),
  deviceName: text("device_name"),
  deviceOs: text("device_os"),
  deviceBrowser: text("device_browser"),
  ip: text("ip"),
  lastSeen: timestamp("last_seen", { withTimezone: true }).defaultNow(),
  loginCount: integer("login_count").notNull().default(1),
});
