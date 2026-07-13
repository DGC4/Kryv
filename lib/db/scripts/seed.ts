import { db } from "../src/index";
import { categoriesTable } from "../src/schema/categories";

// Seeds only structural taxonomy (browse categories/genres) — no fake
// channels, streams, or videos. Live/VOD content is only ever created
// through real user actions (real Mux live streams and uploads), never
// mocked, per project convention.
const liveCategories = [
  { name: "Just Chatting", slug: "just-chatting" },
  { name: "Gaming", slug: "gaming" },
  { name: "Music", slug: "music" },
  { name: "IRL", slug: "irl" },
  { name: "Sports", slug: "sports" },
  { name: "Art", slug: "art" },
];

const genres = [
  { name: "Action", slug: "action" },
  { name: "Drama", slug: "drama" },
  { name: "Comedy", slug: "comedy" },
  { name: "Sci-Fi & Fantasy", slug: "sci-fi-fantasy" },
  { name: "Documentary", slug: "documentary" },
  { name: "Anime", slug: "anime" },
];

async function main() {
  for (const c of liveCategories) {
    await db
      .insert(categoriesTable)
      .values({ ...c, kind: "live_game" })
      .onConflictDoNothing({ target: categoriesTable.slug });
  }
  for (const g of genres) {
    await db
      .insert(categoriesTable)
      .values({ ...g, kind: "genre" })
      .onConflictDoNothing({ target: categoriesTable.slug });
  }
  console.log("Seeded categories.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
