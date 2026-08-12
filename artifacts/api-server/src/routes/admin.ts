import { Router, type IRouter } from "express";
import { asc, eq, sql } from "drizzle-orm";
import {
  db,
  usersTable,
  channelsTable,
  videosTable,
  featureFlagsTable,
} from "@workspace/db";
import {
  GetAdminStatsResponse,
  ListAdminUsersResponse,
  UpdateAdminUserParams,
  UpdateAdminUserBody,
  UpdateAdminUserResponse,
  ListAdminChannelsResponse,
  DeleteAdminChannelParams,
  ListAdminVideosResponse,
  DeleteAdminVideoParams,
  ListAdminFeatureFlagsResponse,
  UpdateAdminFeatureFlagParams,
  UpdateAdminFeatureFlagBody,
  UpdateAdminFeatureFlagResponse,
} from "@workspace/api-zod";
import { requireOwner } from "../lib/auth";
import { toChannelSummary } from "../lib/channelSerializer";
import { toVideoSummary } from "../lib/videoSerializer";
import { writeAuditLog } from "../lib/operations";

const OPERATIONAL_FLAG_COPY: Record<string, string> = {
  crypto_commerce: "Crypto-only invoices for channel support and subscriptions. Disable immediately if provider callbacks or settlement monitoring are unhealthy.",
  ads_delivery: "Viewer ad decision and eligible ad-break delivery. Keep disabled until consent, frequency caps, and impression monitoring are operational.",
};

function toAdminFeatureFlag(row: { key: string; enabled: boolean; description: string | null; updatedAt: Date }) {
  return {
    key: row.key,
    enabled: row.enabled,
    description: row.description || OPERATIONAL_FLAG_COPY[row.key] || "Platform operational feature flag.",
    updatedAt: row.updatedAt.toISOString(),
  };
}

const router: IRouter = Router();

router.get("/admin/feature-flags", requireOwner, async (_req, res): Promise<void> => {
  const flags = await db
    .select({ key: featureFlagsTable.key, enabled: featureFlagsTable.enabled, description: featureFlagsTable.description, updatedAt: featureFlagsTable.updatedAt })
    .from(featureFlagsTable)
    .orderBy(asc(featureFlagsTable.key));

  res.json(ListAdminFeatureFlagsResponse.parse(flags.filter((flag) => flag.key in OPERATIONAL_FLAG_COPY).map(toAdminFeatureFlag)));
});

router.patch("/admin/feature-flags/:key", requireOwner, async (req, res): Promise<void> => {
  const params = UpdateAdminFeatureFlagParams.safeParse(req.params);
  const body = UpdateAdminFeatureFlagBody.safeParse(req.body);
  if (!params.success || !body.success) {
    res.status(400).json({ error: params.success ? body.error.message : params.error.message });
    return;
  }

  const key = params.data.key;
  if (!(key in OPERATIONAL_FLAG_COPY)) {
    res.status(404).json({ error: "Operational feature flag not found" });
    return;
  }

  const [before] = await db
    .select({ key: featureFlagsTable.key, enabled: featureFlagsTable.enabled, description: featureFlagsTable.description, updatedAt: featureFlagsTable.updatedAt })
    .from(featureFlagsTable)
    .where(eq(featureFlagsTable.key, key));
  if (!before) {
    res.status(404).json({ error: "Operational feature flag has not been provisioned" });
    return;
  }

  const [updated] = await db
    .update(featureFlagsTable)
    .set({ enabled: body.data.enabled, updatedByUserId: req.user!.userId, updatedAt: new Date() })
    .where(eq(featureFlagsTable.key, key))
    .returning({ key: featureFlagsTable.key, enabled: featureFlagsTable.enabled, description: featureFlagsTable.description, updatedAt: featureFlagsTable.updatedAt });

  await writeAuditLog(req, {
    action: updated.enabled ? "feature_flag.enabled" : "feature_flag.disabled",
    targetType: "feature_flag",
    targetId: key,
    beforeState: toAdminFeatureFlag(before),
    afterState: toAdminFeatureFlag(updated),
  });

  res.json(UpdateAdminFeatureFlagResponse.parse(toAdminFeatureFlag(updated)));
});

router.get("/admin/stats", requireOwner, async (_req, res): Promise<void> => {
  const [users] = await db
    .select({
      totalUsers: sql<number>`count(*)`.mapWith(Number),
      bannedUsers: sql<number>`count(*) filter (where ${usersTable.banned})`.mapWith(
        Number,
      ),
    })
    .from(usersTable);

  const [channels] = await db
    .select({
      totalChannels: sql<number>`count(*)`.mapWith(Number),
      liveChannels: sql<number>`count(*) filter (where ${channelsTable.isLive})`.mapWith(
        Number,
      ),
    })
    .from(channelsTable);

  const [videos] = await db
    .select({
      totalVideos: sql<number>`count(*)`.mapWith(Number),
      totalViews: sql<number>`coalesce(sum(${videosTable.viewCount}), 0)`.mapWith(
        Number,
      ),
    })
    .from(videosTable);

  res.json(
    GetAdminStatsResponse.parse({
      totalUsers: users?.totalUsers ?? 0,
      bannedUsers: users?.bannedUsers ?? 0,
      totalChannels: channels?.totalChannels ?? 0,
      liveChannels: channels?.liveChannels ?? 0,
      totalVideos: videos?.totalVideos ?? 0,
      totalViews: videos?.totalViews ?? 0,
    }),
  );
});

router.get("/admin/users", requireOwner, async (_req, res): Promise<void> => {
  const rows = await db.select().from(usersTable);
  res.json(ListAdminUsersResponse.parse(rows));
});

router.patch(
  "/admin/users/:id",
  requireOwner,
  async (req, res): Promise<void> => {
    const params = UpdateAdminUserParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    const parsed = UpdateAdminUserBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const targetUserId = Number(params.data.id);
    if (!Number.isSafeInteger(targetUserId) || targetUserId < 1) {
      res.status(400).json({ error: "Invalid user ID" });
      return;
    }

    const [existing] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, targetUserId));
    if (!existing) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    // FanoDGC (owner) is permanently protected — no modification allowed via any endpoint.
    if (existing.role === "owner") {
      res.status(403).json({ error: "The owner account cannot be modified." });
      return;
    }
    // Block any attempt to grant owner role to another account.
    if ((parsed.data as any).role === "owner") {
      res.status(403).json({ error: "Cannot assign owner role via this endpoint." });
      return;
    }

    const [updated] = await db
      .update(usersTable)
      .set(parsed.data)
      .where(eq(usersTable.id, targetUserId))
      .returning();

    res.json(UpdateAdminUserResponse.parse(updated));
  },
);

router.get(
  "/admin/channels",
  requireOwner,
  async (_req, res): Promise<void> => {
    const rows = await db.select().from(channelsTable);
    const results = await Promise.all(rows.map(toChannelSummary));
    res.json(ListAdminChannelsResponse.parse(results));
  },
);

router.delete(
  "/admin/channels/:id",
  requireOwner,
  async (req, res): Promise<void> => {
    const params = DeleteAdminChannelParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    const [deleted] = await db
      .delete(channelsTable)
      .where(eq(channelsTable.id, params.data.id))
      .returning();
    if (!deleted) {
      res.status(404).json({ error: "Channel not found" });
      return;
    }
    res.status(204).end();
  },
);

router.get("/admin/videos", requireOwner, async (_req, res): Promise<void> => {
  const rows = await db.select().from(videosTable);
  const results = await Promise.all(rows.map(toVideoSummary));
  res.json(ListAdminVideosResponse.parse(results));
});

router.delete(
  "/admin/videos/:id",
  requireOwner,
  async (req, res): Promise<void> => {
    const params = DeleteAdminVideoParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    const [deleted] = await db
      .delete(videosTable)
      .where(eq(videosTable.id, params.data.id))
      .returning();
    if (!deleted) {
      res.status(404).json({ error: "Video not found" });
      return;
    }
    res.status(204).end();
  },
);

export default router;
