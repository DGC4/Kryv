import { Router, type IRouter } from "express";
import { and, asc, eq, sql } from "drizzle-orm";
import { db, categoriesTable, channelsTable } from "@workspace/db";
import {
  ListCategoriesQueryParams,
  ListCategoriesResponse,
} from "@workspace/api-zod";
import { attachUserId } from "../lib/auth";
import { getActiveProfileMaturity } from "../lib/liveMaturity";
import { readSharedJson, writeSharedJson } from "../lib/realtime";

const router: IRouter = Router();
const CATEGORY_SUMMARY_CACHE_TTL_SECONDS = 10;

router.get("/categories", attachUserId, async (req, res): Promise<void> => {
  const query = ListCategoriesQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }

  const profileMaturity = await getActiveProfileMaturity(req);
  const visibilityScope =
    profileMaturity === "mature" ? "mature" : "restricted";
  const cacheKey = `kryv:categories:${query.data.kind ?? "all"}:${visibilityScope}:v1`;
  const cached = await readSharedJson<unknown>(cacheKey);
  const cachedResponse = cached
    ? ListCategoriesResponse.safeParse(cached)
    : null;
  if (cachedResponse?.success) {
    res.json(cachedResponse.data);
    return;
  }

  const visibleLiveChannelJoin =
    profileMaturity === "mature"
      ? and(
          eq(channelsTable.categoryId, categoriesTable.id),
          eq(channelsTable.isLive, true),
        )
      : and(
          eq(channelsTable.categoryId, categoriesTable.id),
          eq(channelsTable.isLive, true),
          eq(channelsTable.matureContent, false),
        );
  const rows = await db
    .select({
      id: categoriesTable.id,
      name: categoriesTable.name,
      slug: categoriesTable.slug,
      kind: categoriesTable.kind,
      imageUrl: categoriesTable.imageUrl,
      liveChannelCount: sql<number>`COUNT(${channelsTable.id})`.mapWith(Number),
      viewerCount:
        sql<number>`COALESCE(SUM(${channelsTable.viewerCount}), 0)`.mapWith(
          Number,
        ),
    })
    .from(categoriesTable)
    .leftJoin(channelsTable, visibleLiveChannelJoin)
    .where(
      query.data.kind ? eq(categoriesTable.kind, query.data.kind) : undefined,
    )
    .groupBy(
      categoriesTable.id,
      categoriesTable.name,
      categoriesTable.slug,
      categoriesTable.kind,
      categoriesTable.imageUrl,
    )
    .orderBy(asc(categoriesTable.name));

  const response = ListCategoriesResponse.parse(
    rows.map((category) => ({
      ...category,
      kind: category.kind as "live_game" | "genre",
    })),
  );
  writeSharedJson(cacheKey, response, CATEGORY_SUMMARY_CACHE_TTL_SECONDS).catch(
    () => undefined,
  );
  res.json(response);
});

export default router;
