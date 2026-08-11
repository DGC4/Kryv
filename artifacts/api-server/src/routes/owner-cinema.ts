import { Router, type IRouter } from "express";
import { and, desc, eq, gte, isNull, or } from "drizzle-orm";
import {
  auditLogsTable,
  cinemaRightsWindowsTable,
  cinemaTitleAssetsTable,
  cinemaTitlesTable,
  db,
} from "@workspace/db";
import {
  CreateAdminCinemaAssetBody,
  CreateAdminCinemaAssetParams,
  CreateAdminCinemaAssetResponse,
  CreateAdminCinemaRightsWindowBody,
  CreateAdminCinemaRightsWindowParams,
  CreateAdminCinemaRightsWindowResponse,
  CreateAdminCinemaTitleBody,
  CreateAdminCinemaTitleResponse,
  GetAdminCinemaTitleParams,
  GetAdminCinemaTitleResponse,
  ListAdminCinemaTitlesResponse,
  UpdateAdminCinemaTitleBody,
  UpdateAdminCinemaTitleParams,
  UpdateAdminCinemaTitleResponse,
} from "@workspace/api-zod";
import { requireOwner } from "../lib/auth";
import { writeAuditLog } from "../lib/operations";

const router: IRouter = Router();

type CinemaTitleRow = typeof cinemaTitlesTable.$inferSelect;
type CinemaAssetRow = typeof cinemaTitleAssetsTable.$inferSelect;
type CinemaRightsWindowRow = typeof cinemaRightsWindowsTable.$inferSelect;

function slugify(value: string) {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 96) || "cinema-title";
}

function toTitle(row: CinemaTitleRow) {
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

function toAsset(row: CinemaAssetRow) {
  return {
    id: row.id,
    cinemaTitleId: row.cinemaTitleId,
    assetKind: row.assetKind as "feature" | "trailer" | "preview" | "captions",
    processingStatus: row.processingStatus as "waiting" | "processing" | "ready" | "errored",
    fastpixMediaId: row.fastpixMediaId,
    fastpixPlaybackId: row.fastpixPlaybackId,
    sourceProvenance: row.sourceProvenance,
    language: row.language,
    durationSeconds: row.durationSeconds,
    approvedAt: row.approvedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function toRightsWindow(row: CinemaRightsWindowRow) {
  return {
    id: row.id,
    cinemaTitleId: row.cinemaTitleId,
    territoryCodes: Array.isArray(row.territoryCodes) ? row.territoryCodes.filter((code): code is string => typeof code === "string") : [],
    entitlementType: row.entitlementType as "unconfigured" | "free" | "subscription" | "rental" | "purchase",
    rightsReference: row.rightsReference,
    startsAt: row.startsAt,
    endsAt: row.endsAt,
    createdAt: row.createdAt,
  };
}

async function findTitle(id: number) {
  const [title] = await db.select().from(cinemaTitlesTable).where(eq(cinemaTitlesTable.id, id)).limit(1);
  return title;
}

async function getTitleDetail(title: CinemaTitleRow) {
  const [assets, rightsWindows, activity] = await Promise.all([
    db.select().from(cinemaTitleAssetsTable).where(eq(cinemaTitleAssetsTable.cinemaTitleId, title.id)).orderBy(desc(cinemaTitleAssetsTable.updatedAt)),
    db.select().from(cinemaRightsWindowsTable).where(eq(cinemaRightsWindowsTable.cinemaTitleId, title.id)).orderBy(desc(cinemaRightsWindowsTable.startsAt)),
    db.select({
      id: auditLogsTable.id,
      action: auditLogsTable.action,
      targetType: auditLogsTable.targetType,
      targetId: auditLogsTable.targetId,
      reason: auditLogsTable.reason,
      createdAt: auditLogsTable.createdAt,
    }).from(auditLogsTable).where(and(eq(auditLogsTable.targetType, "cinema_title"), eq(auditLogsTable.targetId, String(title.id)))).orderBy(desc(auditLogsTable.createdAt)).limit(20),
  ]);

  const now = new Date();
  const hasReadyFeature = assets.some((asset) => asset.assetKind === "feature" && asset.processingStatus === "ready" && Boolean(asset.fastpixPlaybackId));
  const hasActiveRightsWindow = rightsWindows.some((window) => window.entitlementType !== "unconfigured" && window.startsAt <= now && (!window.endsAt || window.endsAt >= now));
  const blockingReasons: string[] = [];
  if (!hasReadyFeature) blockingReasons.push("Add an approved feature asset with a ready playback identifier.");
  if (!hasActiveRightsWindow) blockingReasons.push("Add an active rights window with a configured entitlement.");

  return {
    ...toTitle(title),
    releaseYear: title.releaseYear,
    runtimeSeconds: title.runtimeSeconds,
    contentRating: title.contentRating,
    genres: Array.isArray(title.genres) ? title.genres.filter((genre): genre is string => typeof genre === "string") : [],
    castMembers: Array.isArray(title.castMembers) ? title.castMembers.filter((member): member is string => typeof member === "string") : [],
    crew: Array.isArray(title.crew) ? title.crew.filter((member): member is string => typeof member === "string") : [],
    logoUrl: title.logoUrl,
    publishedAt: title.publishedAt,
    assets: assets.map(toAsset),
    rightsWindows: rightsWindows.map(toRightsWindow),
    readiness: {
      hasReadyFeature,
      hasActiveRightsWindow,
      isPublishEligible: blockingReasons.length === 0,
      blockingReasons,
    },
    activity,
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
  await writeAuditLog(req, { action: "cinema.title.created", targetType: "cinema_title", targetId: title.id, afterState: { title: title.title, publishState: title.publishState } });
  res.status(201).json(CreateAdminCinemaTitleResponse.parse(toTitle(title)));
});

router.get("/admin/cinema/titles/:id", requireOwner, async (req, res): Promise<void> => {
  const params = GetAdminCinemaTitleParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const title = await findTitle(params.data.id);
  if (!title) { res.status(404).json({ error: "Cinema title not found" }); return; }
  res.json(GetAdminCinemaTitleResponse.parse(await getTitleDetail(title)));
});

router.patch("/admin/cinema/titles/:id", requireOwner, async (req, res): Promise<void> => {
  const params = UpdateAdminCinemaTitleParams.safeParse(req.params);
  const parsed = UpdateAdminCinemaTitleBody.safeParse(req.body);
  if (!params.success || !parsed.success) { res.status(400).json({ error: !params.success ? params.error.message : parsed.error.message }); return; }
  const title = await findTitle(params.data.id);
  if (!title) { res.status(404).json({ error: "Cinema title not found" }); return; }

  const value = parsed.data;
  if (value.publishState === "published") {
    const detail = await getTitleDetail(title);
    if (!detail.readiness.isPublishEligible) {
      res.status(409).json({ error: "Cinema title is not publishable", blockingReasons: detail.readiness.blockingReasons });
      return;
    }
  }

  const beforeState = { title: title.title, publishState: title.publishState, editorialRank: title.editorialRank, adEligible: title.adEligible };
  const [updated] = await db.update(cinemaTitlesTable).set({
    ...(value.title !== undefined ? { title: value.title.trim() } : {}),
    ...(value.synopsis !== undefined ? { synopsis: value.synopsis?.trim() || null } : {}),
    ...(value.posterUrl !== undefined ? { posterUrl: value.posterUrl } : {}),
    ...(value.backdropUrl !== undefined ? { backdropUrl: value.backdropUrl } : {}),
    ...(value.logoUrl !== undefined ? { logoUrl: value.logoUrl } : {}),
    ...(value.maturityLevel !== undefined ? { maturityLevel: value.maturityLevel } : {}),
    ...(value.contentRating !== undefined ? { contentRating: value.contentRating?.trim() || null } : {}),
    ...(value.releaseYear !== undefined ? { releaseYear: value.releaseYear } : {}),
    ...(value.editorialRank !== undefined ? { editorialRank: value.editorialRank } : {}),
    ...(value.adEligible !== undefined ? { adEligible: value.adEligible } : {}),
    ...(value.publishState !== undefined ? {
      publishState: value.publishState,
      ...(value.publishState === "review" || value.publishState === "published" ? { reviewedByUserId: req.user!.userId } : {}),
      ...(value.publishState === "published" ? { publishedAt: title.publishedAt ?? new Date() } : {}),
    } : {}),
    updatedAt: new Date(),
  }).where(eq(cinemaTitlesTable.id, title.id)).returning();

  if (!updated) { res.status(500).json({ error: "Cinema title could not be updated" }); return; }
  await writeAuditLog(req, {
    action: value.publishState && value.publishState !== title.publishState ? `cinema.title.${value.publishState}` : "cinema.title.updated",
    targetType: "cinema_title",
    targetId: title.id,
    reason: value.reason,
    beforeState,
    afterState: { title: updated.title, publishState: updated.publishState, editorialRank: updated.editorialRank, adEligible: updated.adEligible },
  });
  res.json(UpdateAdminCinemaTitleResponse.parse(await getTitleDetail(updated)));
});

router.post("/admin/cinema/titles/:id/rights-windows", requireOwner, async (req, res): Promise<void> => {
  const params = CreateAdminCinemaRightsWindowParams.safeParse(req.params);
  const parsed = CreateAdminCinemaRightsWindowBody.safeParse(req.body);
  if (!params.success || !parsed.success) { res.status(400).json({ error: !params.success ? params.error.message : parsed.error.message }); return; }
  const title = await findTitle(params.data.id);
  if (!title) { res.status(404).json({ error: "Cinema title not found" }); return; }
  const value = parsed.data;
  if (value.endsAt && value.endsAt <= value.startsAt) { res.status(400).json({ error: "Rights window end must be after its start" }); return; }

  const [window] = await db.insert(cinemaRightsWindowsTable).values({
    cinemaTitleId: title.id,
    territoryCodes: value.territoryCodes ?? [],
    entitlementType: value.entitlementType,
    rightsReference: value.rightsReference.trim(),
    startsAt: value.startsAt,
    endsAt: value.endsAt ?? null,
    createdByUserId: req.user!.userId,
  }).returning();
  await writeAuditLog(req, { action: "cinema.rights_window.created", targetType: "cinema_title", targetId: title.id, afterState: { rightsWindowId: window.id, entitlementType: window.entitlementType, startsAt: window.startsAt, endsAt: window.endsAt } });
  res.status(201).json(CreateAdminCinemaRightsWindowResponse.parse(toRightsWindow(window)));
});

router.post("/admin/cinema/titles/:id/assets", requireOwner, async (req, res): Promise<void> => {
  const params = CreateAdminCinemaAssetParams.safeParse(req.params);
  const parsed = CreateAdminCinemaAssetBody.safeParse(req.body);
  if (!params.success || !parsed.success) { res.status(400).json({ error: !params.success ? params.error.message : parsed.error.message }); return; }
  const title = await findTitle(params.data.id);
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
  await writeAuditLog(req, { action: "cinema.asset.approved", targetType: "cinema_title", targetId: title.id, afterState: { assetId: asset.id, assetKind: asset.assetKind, fastpixMediaId: asset.fastpixMediaId } });
  res.status(201).json(CreateAdminCinemaAssetResponse.parse(toAsset(asset)));
});

export default router;
