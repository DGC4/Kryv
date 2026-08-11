import { Router, type IRouter } from "express";
import { desc, eq } from "drizzle-orm";
import {
  categoriesTable,
  cinemaRightsWindowsTable,
  cinemaTitleAssetsTable,
  cinemaTitlesTable,
  db,
} from "@workspace/db";
import { GetCinemaHomeResponse, GetCinemaTitleParams, GetCinemaTitleResponse } from "@workspace/api-zod";

const router: IRouter = Router();

type CinemaTitleRow = typeof cinemaTitlesTable.$inferSelect;
type CinemaAssetRow = typeof cinemaTitleAssetsTable.$inferSelect;
type CinemaRightsWindowRow = typeof cinemaRightsWindowsTable.$inferSelect;

function textList(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function isGloballyAvailable(window: CinemaRightsWindowRow, now: Date) {
  return window.entitlementType !== "unconfigured"
    && window.startsAt <= now
    && (!window.endsAt || window.endsAt >= now)
    && textList(window.territoryCodes).length === 0;
}

function toPublicTitle(
  title: CinemaTitleRow,
  assets: CinemaAssetRow[],
  rightsWindows: CinemaRightsWindowRow[],
  now: Date,
) {
  const feature = assets.find((asset) => asset.assetKind === "feature" && asset.processingStatus === "ready" && Boolean(asset.fastpixPlaybackId));
  const entitlement = rightsWindows.find((window) => isGloballyAvailable(window, now));
  if (!feature || !entitlement || !feature.fastpixPlaybackId) return null;
  const trailer = assets.find((asset) => asset.assetKind === "trailer" && asset.processingStatus === "ready" && Boolean(asset.fastpixPlaybackId));
  return {
    id: title.id,
    slug: title.slug,
    title: title.title,
    synopsis: title.synopsis,
    maturityLevel: title.maturityLevel as "kids" | "standard" | "mature",
    genres: textList(title.genres),
    posterUrl: title.posterUrl,
    backdropUrl: title.backdropUrl,
    runtimeSeconds: title.runtimeSeconds ?? feature.durationSeconds,
    featurePlaybackId: feature.fastpixPlaybackId,
    trailerPlaybackId: trailer?.fastpixPlaybackId ?? null,
    entitlementType: entitlement.entitlementType as "free" | "subscription" | "rental" | "purchase",
    publishedAt: title.publishedAt,
  };
}

async function getPublishedCinemaTitles() {
  const [titles, assets, rightsWindows] = await Promise.all([
    db.select().from(cinemaTitlesTable).where(eq(cinemaTitlesTable.publishState, "published")).orderBy(desc(cinemaTitlesTable.editorialRank), desc(cinemaTitlesTable.publishedAt)),
    db.select().from(cinemaTitleAssetsTable),
    db.select().from(cinemaRightsWindowsTable),
  ]);
  const now = new Date();
  return titles.map((title) => toPublicTitle(
    title,
    assets.filter((asset) => asset.cinemaTitleId === title.id),
    rightsWindows.filter((window) => window.cinemaTitleId === title.id),
    now,
  )).filter((title): title is NonNullable<typeof title> => title !== null);
}

router.get("/cinema/home", async (_req, res): Promise<void> => {
  const [publishedTitles, genres] = await Promise.all([
    getPublishedCinemaTitles(),
    db.select().from(categoriesTable).where(eq(categoriesTable.kind, "genre")),
  ]);

  const rows = [
    { title: "New on Kryv", items: publishedTitles },
    ...genres.map((genre) => ({
      title: genre.name,
      items: publishedTitles.filter((title) => title.genres.some((value) => value.toLowerCase() === genre.name.toLowerCase())),
    })),
  ].filter((row) => row.items.length > 0);

  res.json(GetCinemaHomeResponse.parse({ hero: publishedTitles[0] ?? null, rows }));
});

router.get("/cinema/titles/:id", async (req, res): Promise<void> => {
  const parsed = GetCinemaTitleParams.safeParse(req.params);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const title = (await getPublishedCinemaTitles()).find((item) => item.id === parsed.data.id);
  if (!title) { res.status(404).json({ error: "Cinema title is unavailable" }); return; }
  res.json(GetCinemaTitleResponse.parse(title));
});

export default router;
