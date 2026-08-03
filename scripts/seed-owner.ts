import { db, usersTable } from "../lib/db/src";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";

async function seed() {
  const username = "FanoDGC";
  const email = "fano@kryv.build";
  const password = "onlyus123";
  const role = "owner";

  console.log(`Checking for owner account: ${username}...`);

  const [existing] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.username, username));

  if (existing) {
    console.log("Owner account already exists. Updating password and role...");
    const passwordHash = await bcrypt.hash(password, 10);
    await db
      .update(usersTable)
      .set({ passwordHash, role, email })
      .where(eq(usersTable.id, existing.id));
  } else {
    console.log("Creating owner account...");
    const passwordHash = await bcrypt.hash(password, 10);
    await db.insert(usersTable).values({
      email,
      username,
      passwordHash,
      role,
    });
  }

  console.log("Owner account seeded successfully!");
  process.exit(0);
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
