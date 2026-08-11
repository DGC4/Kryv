import { Router, type IRouter } from "express";
import { desc, eq } from "drizzle-orm";
import {
  cinemaRightsWindowsTable,
  cinemaTitleAssetsTable,
  cinemaTitlesTable,
  db,
} from "@workspace/db";
import {
  CreateAdminCinemaAssetBody,
  CreateAdminCinemaAssetParams,
  CreateAdminCinemaAssetResponse,
  CreateAdminCinemaTitleBody,
  CreateAdminCinemaTitleResponse,
  ListAdminCinemaTitlesResponse,
} from "@workspace/api-zod";
import { requireOwner } from "../lib/auth";

const router: IRouter = Router();

function slugify(value: string) {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 96) || "cinema-title";
}

function toTitle(row: typeof cinemaTitlesTable.$inferSelect) {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    synopsis: row.synopsis,
    publishState: row.publishState as "draft" | "review" | "published" | "archived",
    maturityLevel: row.maturityLevel as "kids" | "standard" | "mature",
    editorialRank: row.editorialRank,
    adEligible: row.adEligible,
    posterUrl: row.posterUrl,
    backdropUrl: row.backdropUrl,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

router.get("/admin/cinema/titles", requireOwner, async (_req, res): Promise<void> => {
  const titles = await db.select().from(cinemaTitlesTable).orderBy(desc(cinemaTitlesTable.updatedAt));
  res.json(ListAdminCinemaTitlesResponse.parse(titles.map(toTitle)));
});

router.post("/admin/cinema/titles", requireOwner, async (req, res): Promise<void> => {
  const parsed = CreateAdminCinemaTitleBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const value = parsed.data;
  const baseSlug = slugify(value.title);
  const existing = await db.select({ id: cinemaTitlesTable.id }).from(cinemaTitlesTable).where(eq(cinemaTitlesTable.slug, baseSlug)).limit(1);
  const slug = existing.length ? `${baseSlug}-${Date.now().toString(36)}` : baseSlug;
  const now = new Date();
  const [title] = await db.transaction(async (tx) => {
    const [created] = await tx.insert(cinemaTitlesTable).values({
      slug,
      title: value.title.trim(),
      synopsis: value.synopsis?.trim() || null,
      posterUrl: value.posterUrl ?? null,
      backdropUrl: value.backdropUrl ?? null,
      maturityLevel: value.maturityLevel ?? "standard",
      publishState: "draft",
      createdByUserId: req.user!.userId,
    }).returning();
    if (!created) throw new Error("Unable to create Cinema title.");
    await tx.insert(cinemaRightsWindowsTable).values({
      cinemaTitleId: created.id,
      territoryCodes: value.territoryCodes ?? [],
      entitlementType: "unconfigured",
      rightsReference: value.rightsReference.trim(),
      startsAt: now,
      createdByUserId: req.user!.userId,
    });
    return [created];
  });
  res.status(201).json(CreateAdminCinemaTitleResponse.parse(toTitle(title)));
});

router.post("/admin/cinema/titles/:id/assets", requireOwner, async (req, res): Promise<void> => {
  const params = CreateAdminCinemaAssetParams.safeParse(req.params);
  const parsed = CreateAdminCinemaAssetBody.safeParse(req.body);
  if (!params.success || !parsed.success) { res.status(400).json({ error: !params.success ? params.error.message : parsed.error.message }); return; }
  const [title] = await db.select({ id: cinemaTitlesTable.id }).from(cinemaTitlesTable).where(eq(cinemaTitlesTable.id, params.data.id)).limit(1);
  if (!title) { res.status(404).json({ error: "Cinema title not found" }); return; }
  const [asset] = await db.insert(cinemaTitleAssetsTable).values({
    cinemaTitleId: title.id,
    assetKind: parsed.data.assetKind,
    fastpixMediaId: parsed.data.fastpixMediaId ?? null,
    fastpixPlaybackId: parsed.data.fastpixPlaybackId,
    processingStatus: "ready",
    sourceProvenance: parsed.data.sourceProvenance.trim(),
    durationSeconds: parsed.data.durationSeconds ?? null,
    approvedAt: new Date(),
    approvedByUserId: req.user!.userId,
  }).returning();
  res.status(201).json(CreateAdminCinemaAssetResponse.parse({
    id: asset.id,
    cinemaTitleId: asset.cinemaTitleId,
    assetKind: asset.assetKind as "feature" | "trailer" | "preview" | "captions",
    processingStatus: asset.processingStatus as "waiting" | "processing" | "ready" | "errored",
    fastpixMediaId: asset.fastpixMediaId,
    fastpixPlaybackId: asset.fastpixPlaybackId,
  }));
});

export default router;
