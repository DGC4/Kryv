import { Router, type IRouter } from "express";
import { desc, eq } from "drizzle-orm";
import { db, categoriesTable, videosTable } from "@workspace/db";
import { GetCinemaHomeResponse } from "@workspace/api-zod";
import { toVideoSummary } from "../lib/videoSerializer";

const router: IRouter = Router();

router.get("/cinema/home", async (_req, res): Promise<void> => {
  const originals = await db
    .select()
    .from(videosTable)
    .where(eq(videosTable.contentType, "original"))
    .orderBy(desc(videosTable.createdAt));

  const hero = originals[0] ? await toVideoSummary(originals[0]) : null;

  const genres = await db
    .select()
    .from(categoriesTable)
    .where(eq(categoriesTable.kind, "genre"));

  const rows = await Promise.all(
    genres.map(async (genre) => {
      const items = await Promise.all(
        originals
          .filter((v) => v.categoryId === genre.id)
          .map(toVideoSummary),
      );
      return { title: genre.name, items };
    }),
  );

  res.json(
    GetCinemaHomeResponse.parse({
      hero,
      rows: rows.filter((row) => row.items.length > 0),
    }),
  );
});

export default router;
