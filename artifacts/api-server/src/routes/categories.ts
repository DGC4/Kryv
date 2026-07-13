import { Router, type IRouter } from "express";
import { eq, and, count } from "drizzle-orm";
import { db, categoriesTable, channelsTable } from "@workspace/db";
import {
  ListCategoriesQueryParams,
  ListCategoriesResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/categories", async (req, res): Promise<void> => {
  const query = ListCategoriesQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }

  const rows = query.data.kind
    ? await db
        .select()
        .from(categoriesTable)
        .where(eq(categoriesTable.kind, query.data.kind))
    : await db.select().from(categoriesTable);

  const results = await Promise.all(
    rows.map(async (category) => {
      const [liveRow] = await db
        .select({ n: count() })
        .from(channelsTable)
        .where(
          and(
            eq(channelsTable.categoryId, category.id),
            eq(channelsTable.isLive, true),
          ),
        );
      const liveChannelCount = liveRow?.n ?? 0;

      const channels = await db
        .select({ viewerCount: channelsTable.viewerCount })
        .from(channelsTable)
        .where(
          and(
            eq(channelsTable.categoryId, category.id),
            eq(channelsTable.isLive, true),
          ),
        );
      const viewerCount = channels.reduce((sum, c) => sum + c.viewerCount, 0);

      return {
        id: category.id,
        name: category.name,
        slug: category.slug,
        kind: category.kind as "live_game" | "genre",
        imageUrl: category.imageUrl,
        liveChannelCount,
        viewerCount,
      };
    }),
  );

  res.json(ListCategoriesResponse.parse(results));
});

export default router;
