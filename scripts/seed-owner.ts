import { and, eq, isNull, sql } from "drizzle-orm";
import {
  auditLogsTable,
  db,
  platformRolesTable,
  userSessionsTable,
  usersTable,
} from "../lib/db/src";

const email = process.env.OWNER_BOOTSTRAP_EMAIL?.trim().toLowerCase();
const confirmation = process.env.OWNER_BOOTSTRAP_CONFIRM;

if (!email) {
  throw new Error("OWNER_BOOTSTRAP_EMAIL must identify an existing account to promote.");
}
if (confirmation !== "PROMOTE_EXISTING_OWNER") {
  throw new Error("Set OWNER_BOOTSTRAP_CONFIRM=PROMOTE_EXISTING_OWNER after verifying the target account.");
}

async function bootstrapOwner(): Promise<void> {
  const [user] = await db
    .select()
    .from(usersTable)
    .where(sql`LOWER(${usersTable.email}) = ${email}`)
    .limit(1);

  if (!user) {
    throw new Error("No existing account matches OWNER_BOOTSTRAP_EMAIL. Public bootstrap cannot create an owner.");
  }
  if (user.banned) {
    throw new Error("A banned account cannot be promoted to owner.");
  }

  await db.transaction(async (txn) => {
    await txn
      .insert(platformRolesTable)
      .values({ userId: user.id, role: "owner" })
      .onConflictDoUpdate({
        target: [platformRolesTable.userId, platformRolesTable.role],
        set: {
          revokedAt: null,
          revokedByUserId: null,
          revocationReason: null,
          expiresAt: null,
          updatedAt: new Date(),
        },
      });

    await txn
      .update(usersTable)
      .set({
        role: "owner",
        sessionVersion: sql`${usersTable.sessionVersion} + 1`,
      })
      .where(eq(usersTable.id, user.id));

    await txn
      .update(userSessionsTable)
      .set({ revokedAt: new Date(), revokedReason: "owner_role_granted" })
      .where(and(eq(userSessionsTable.userId, user.id), isNull(userSessionsTable.revokedAt)));

    await txn.insert(auditLogsTable).values({
      actorUserId: user.id,
      action: "platform_role.owner_granted",
      targetType: "user",
      targetId: String(user.id),
      reason: "Controlled owner bootstrap",
      afterState: { role: "owner", source: "scripts/seed-owner.ts" },
    });
  });

  console.log(`Owner role granted to existing account id=${user.id}; all prior sessions were revoked.`);
}

void bootstrapOwner().catch((error) => {
  console.error("Owner bootstrap failed:", error instanceof Error ? error.message : error);
  process.exit(1);
});
