import { Router, type IRouter } from "express";
import { desc, eq, sql } from "drizzle-orm";
import { db, categoriesTable, channelsTable } from "@workspace/db";
import { GetDiscoverSummaryResponse } from "@workspace/api-zod";
import { toChannelSummary } from "../lib/channelSerializer";

const router: IRouter = Router();

router.get("/discover/summary", async (_req, res): Promise<void> => {
  const liveChannels = await db
    .select()
    .from(channelsTable)
    .where(eq(channelsTable.isLive, true))
    .orderBy(desc(channelsTable.viewerCount));

  const featuredChannels = await Promise.all(
    liveChannels.slice(0, 8).map(toChannelSummary),
  );

  const categories = await db.select().from(categoriesTable);
  const topCategories = await Promise.all(
    categories.slice(0, 8).map(async (category) => {
      const channelsInCategory = liveChannels.filter(
        (c) => c.categoryId === category.id,
      );
      return {
        id: category.id,
        name: category.name,
        slug: category.slug,
        kind: category.kind as "live_game" | "genre",
        imageUrl: category.imageUrl,
        liveChannelCount: channelsInCategory.length,
        viewerCount: channelsInCategory.reduce(
          (sum, c) => sum + c.viewerCount,
          0,
        ),
      };
    }),
  );

  const totalViewers = liveChannels.reduce((sum, c) => sum + c.viewerCount, 0);

  res.json(
    GetDiscoverSummaryResponse.parse({
      featuredChannels,
      topCategories,
      totalLiveChannels: liveChannels.length,
      totalViewers,
    }),
  );
});

export default router;
