import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { categoriesTable, db } from "@workspace/db";
import {
  GetCinemaHomeResponse,
  GetCinemaTitleParams,
  GetCinemaTitleResponse,
} from "@workspace/api-zod";
import { getPublishedCinemaTitleDetail, getPublishedCinemaTitles } from "../lib/cinemaCatalog";

const router: IRouter = Router();

router.get("/cinema/home", async (_req, res): Promise<void> => {
  const [publishedTitles, genres] = await Promise.all([
    getPublishedCinemaTitles(),
    db.select().from(categoriesTable).where(eq(categoriesTable.kind, "genre")),
  ]);

  const rows = [
    { title: "New on Kryv", items: publishedTitles },
    ...genres.map((genre) => ({
      title: genre.name,
      items: publishedTitles.filter((title) => (
        title.genres.some((value) => value.toLowerCase() === genre.name.toLowerCase())
      )),
    })),
  ].filter((row) => row.items.length > 0);

  res.json(GetCinemaHomeResponse.parse({ hero: publishedTitles[0] ?? null, rows }));
});

router.get("/cinema/titles/:id", async (req, res): Promise<void> => {
  const parsed = GetCinemaTitleParams.safeParse(req.params);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const title = await getPublishedCinemaTitleDetail(parsed.data.id);
  if (!title) {
    res.status(404).json({ error: "Cinema title is unavailable" });
    return;
  }

  res.json(GetCinemaTitleResponse.parse(title));
});

export default router;
