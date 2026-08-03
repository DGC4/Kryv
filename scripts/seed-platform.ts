import { db, emotesTable, categoriesTable } from "../lib/db/src";
import { eq } from "drizzle-orm";

async function seed() {
  console.log("Seeding platform data...");

  // Seed Categories
  const categories = [
    { name: "Slots & Casino", slug: "slots-casino", kind: "live_game", imageUrl: "https://kick.com/categories/slots-casino.png" },
    { name: "Just Chatting", slug: "just-chatting", kind: "live_game", imageUrl: "https://kick.com/categories/just-chatting.png" },
    { name: "IRL", slug: "irl", kind: "live_game", imageUrl: "https://kick.com/categories/irl.png" },
    { name: "VALORANT", slug: "valorant", kind: "live_game", imageUrl: "https://kick.com/categories/valorant.png" },
    { name: "Music", slug: "music", kind: "live_game", imageUrl: "https://kick.com/categories/music.png" },
  ];

  for (const cat of categories) {
    const [existing] = await db.select().from(categoriesTable).where(eq(categoriesTable.slug, cat.slug));
    if (!existing) {
      await db.insert(categoriesTable).values(cat);
      console.log(`Added category: ${cat.name}`);
    }
  }

  // Seed Global Emotes
  const emotes = [
    { code: "KryvHype", imageUrl: "https://cdn.example.com/emotes/hype.png", isGlobal: true },
    { code: "KryvLUL", imageUrl: "https://cdn.example.com/emotes/lul.png", isGlobal: true },
    { code: "KryvLove", imageUrl: "https://cdn.example.com/emotes/love.png", isGlobal: true },
    { code: "KryvSad", imageUrl: "https://cdn.example.com/emotes/sad.png", isGlobal: true },
  ];

  for (const emote of emotes) {
    const [existing] = await db.select().from(emotesTable).where(eq(emotesTable.code, emote.code));
    if (!existing) {
      await db.insert(emotesTable).values(emote);
      console.log(`Added emote: ${emote.code}`);
    }
  }

  console.log("Platform seeding complete!");
  process.exit(0);
}

seed().catch((err) => {
  console.error("Platform seed failed:", err);
  process.exit(1);
});
