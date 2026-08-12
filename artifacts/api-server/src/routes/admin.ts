import { Router, type IRouter } from "express";
import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import {
  db,
  usersTable,
  channelsTable,
  activityLogsTable,
  deviceHistoryTable,
  userActivityPresenceTable,
  videosTable,
  featureFlagsTable,
  creatorBalancesTable,
  creatorBalanceMovementsTable,
  creatorPayoutProfilesTable,
  payoutRequestsTable,
  payoutApprovalsTable,
} from "@workspace/db";
import {
  GetAdminStatsResponse,
  ListAdminUsersResponse,
  UpdateAdminUserParams,
  UpdateAdminUserBody,
  UpdateAdminUserResponse,
  GetAdminUserActivityParams,
  GetAdminUserActivityResponse,
  ListAdminChannelsResponse,
  DeleteAdminChannelParams,
  ListAdminVideosResponse,
  DeleteAdminVideoParams,
  ListAdminFeatureFlagsResponse,
  UpdateAdminFeatureFlagParams,
  UpdateAdminFeatureFlagBody,
  UpdateAdminFeatureFlagResponse,
  GetAdminFinanceOverviewResponse,
  ListAdminPayoutProfilesResponse,
  ReviewAdminPayoutProfileParams,
  ReviewAdminPayoutProfileBody,
  ReviewAdminPayoutProfileResponse,
  ListAdminPayoutRequestsResponse,
  ReviewAdminPayoutRequestParams,
  ReviewAdminPayoutRequestBody,
  ReviewAdminPayoutRequestResponse,
} from "@workspace/api-zod";
import { requireOwner } from "../lib/auth";
import { toChannelSummary } from "../lib/channelSerializer";
import { toVideoSummary } from "../lib/videoSerializer";
import { writeAuditLog } from "../lib/operations";
import { getPlisioAssetSnapshots, isPlisioConfigured, isSupportedKryvCryptoCode } from "../lib/plisio";

const OPERATIONAL_FLAG_COPY: Record<string, string> = {
  crypto_commerce: "Crypto-only invoices for channel support and subscriptions. Disable immediately if provider callbacks or settlement monitoring are unhealthy.",
  ads_delivery: "Viewer ad decision and eligible ad-break delivery. Keep disabled until consent, frequency caps, and impression monitoring are operational.",
  creator_payout_requests: "Creator payout request queue. Keep disabled until encrypted payout profiles, creator ledger monitoring, and owner review procedures are operational.",
  scheduled_payout_requests: "Scheduled daily, weekly, and monthly payout request generation. Keep disabled until a production scheduler, idempotency checks, and alerting are configured.",
  provider_withdrawals: "Provider withdrawal execution. Keep disabled until request IP, provider balances, fee estimation, reconciliation, and incident response are verified.",
  customer_wallet_custody: "Customer deposit addresses and stored crypto balances. Keep disabled until signed pay-in callbacks, ledger reconciliation, support procedures, and custody approvals are operational.",
};

function toAdminFeatureFlag(row: { key: string; enabled: boolean; description: string | null; updatedAt: Date }) {
  return {
    key: row.key,
    enabled: row.enabled,
    description: row.description || OPERATIONAL_FLAG_COPY[row.key] || "Platform operational feature flag.",
    updatedAt: row.updatedAt.toISOString(),
  };
}

function toDecimalString(value: unknown) {
  return typeof value === "string" ? value : String(value ?? "0");
}

function toAdminPayoutProfile(row: any) {
  return {
    id: row.id,
    currency: row.currency,
    addressMasked: row.addressMasked,
    confirmationStatus: row.confirmationStatus,
    reviewStatus: row.reviewStatus,
    confirmedAt: row.confirmedAt,
    updatedAt: row.updatedAt,
    channelId: row.channelId,
    channelSlug: row.channelSlug,
    channelDisplayName: row.channelDisplayName,
    creatorUsername: row.creatorUsername,
  };
}

function toAdminPayoutRequest(row: any) {
  return {
    id: row.id,
    currency: row.currency,
    amount: toDecimalString(row.amount),
    destinationMasked: row.destinationMasked,
    requestSource: row.requestSource === "scheduled" ? "scheduled" : "manual",
    feeAmount: row.feeAmount === null ? null : toDecimalString(row.feeAmount),
    feeCurrency: row.feeCurrency,
    usdReferenceAmount: row.usdReferenceAmount === null ? null : toDecimalString(row.usdReferenceAmount),
    status: row.status,
    riskHoldReason: row.riskHoldReason,
    requestedAt: row.requestedAt,
    reviewedAt: row.reviewedAt,
    completedAt: row.completedAt,
    providerTransactionUrl: row.providerTransactionUrl,
    channelId: row.channelId,
    channelSlug: row.channelSlug,
    channelDisplayName: row.channelDisplayName,
    creatorUsername: row.creatorUsername,
  };
}

async function getFinanceFlags() {
  const keys = ["crypto_commerce", "creator_payout_requests", "scheduled_payout_requests", "provider_withdrawals"];
  const rows = await db
    .select({ key: featureFlagsTable.key, enabled: featureFlagsTable.enabled })
    .from(featureFlagsTable)
    .where(inArray(featureFlagsTable.key, keys));
  const flags = new Map(rows.map((row) => [row.key, row.enabled]));
  return {
    cryptoCommerceEnabled: Boolean(flags.get("crypto_commerce")),
    payoutRequestsEnabled: Boolean(flags.get("creator_payout_requests")),
    scheduledPayoutRequestsEnabled: Boolean(flags.get("scheduled_payout_requests")),
    providerWithdrawalsEnabled: Boolean(flags.get("provider_withdrawals")),
  };
}

const router: IRouter = Router();

router.get("/admin/finance/overview", requireOwner, async (_req, res): Promise<void> => {
  const [liabilityRows, profileReview, payoutReview, flags, snapshots] = await Promise.all([
    db
      .select({
        currency: creatorBalancesTable.currency,
        pendingAmount: sql<string>`coalesce(sum(${creatorBalancesTable.pendingAmount}), 0)::text`,
        availableAmount: sql<string>`coalesce(sum(${creatorBalancesTable.availableAmount}), 0)::text`,
        heldAmount: sql<string>`coalesce(sum(${creatorBalancesTable.heldAmount}), 0)::text`,
      })
      .from(creatorBalancesTable)
      .groupBy(creatorBalancesTable.currency),
    db.select({ count: sql<number>`count(*)`.mapWith(Number) }).from(creatorPayoutProfilesTable).where(eq(creatorPayoutProfilesTable.reviewStatus, "pending")),
    db.select({ count: sql<number>`count(*)`.mapWith(Number) }).from(payoutRequestsTable).where(inArray(payoutRequestsTable.status, ["requested", "held"])),
    getFinanceFlags(),
    getPlisioAssetSnapshots().catch(() => []),
  ]);
  const snapshotByCurrency = new Map(snapshots.map((snapshot) => [snapshot.currency, snapshot]));

  res.json(GetAdminFinanceOverviewResponse.parse({
    assetLiabilities: liabilityRows
      .filter((row) => isSupportedKryvCryptoCode(row.currency))
      .map((row) => {
        const snapshot = snapshotByCurrency.get(row.currency);
        return {
          currency: row.currency,
          pendingAmount: row.pendingAmount,
          availableAmount: row.availableAmount,
          heldAmount: row.heldAmount,
          providerTreasuryBalance: snapshot?.treasuryBalance ?? null,
          priceUsd: snapshot?.priceUsd ?? null,
          rateUpdatedAt: snapshot?.fetchedAt ?? null,
        };
      }),
    pendingProfileReviews: profileReview[0]?.count ?? 0,
    requestedPayouts: payoutReview[0]?.count ?? 0,
    ...flags,
    providerConfigured: isPlisioConfigured(),
  }));
});

router.get("/admin/finance/payout-profiles", requireOwner, async (_req, res): Promise<void> => {
  const rows = await db
    .select({
      id: creatorPayoutProfilesTable.id,
      currency: creatorPayoutProfilesTable.currency,
      addressMasked: creatorPayoutProfilesTable.addressMasked,
      confirmationStatus: creatorPayoutProfilesTable.confirmationStatus,
      reviewStatus: creatorPayoutProfilesTable.reviewStatus,
      confirmedAt: creatorPayoutProfilesTable.confirmedAt,
      updatedAt: creatorPayoutProfilesTable.updatedAt,
      channelId: channelsTable.id,
      channelSlug: channelsTable.slug,
      channelDisplayName: channelsTable.displayName,
      creatorUsername: usersTable.username,
    })
    .from(creatorPayoutProfilesTable)
    .innerJoin(channelsTable, eq(creatorPayoutProfilesTable.channelId, channelsTable.id))
    .innerJoin(usersTable, eq(channelsTable.ownerUserId, usersTable.id))
    .orderBy(asc(creatorPayoutProfilesTable.reviewStatus), desc(creatorPayoutProfilesTable.updatedAt));
  res.json(ListAdminPayoutProfilesResponse.parse(rows.filter((row) => isSupportedKryvCryptoCode(row.currency)).map(toAdminPayoutProfile)));
});

router.post("/admin/finance/payout-profiles/:id/review", requireOwner, async (req, res): Promise<void> => {
  const params = ReviewAdminPayoutProfileParams.safeParse(req.params);
  const body = ReviewAdminPayoutProfileBody.safeParse(req.body);
  if (!params.success || !body.success) {
    res.status(400).json({ error: params.success ? body.error.message : params.error.message });
    return;
  }
  const [before] = await db
    .select({
      id: creatorPayoutProfilesTable.id,
      currency: creatorPayoutProfilesTable.currency,
      addressMasked: creatorPayoutProfilesTable.addressMasked,
      confirmationStatus: creatorPayoutProfilesTable.confirmationStatus,
      reviewStatus: creatorPayoutProfilesTable.reviewStatus,
      confirmedAt: creatorPayoutProfilesTable.confirmedAt,
      updatedAt: creatorPayoutProfilesTable.updatedAt,
      channelId: channelsTable.id,
      channelSlug: channelsTable.slug,
      channelDisplayName: channelsTable.displayName,
      creatorUsername: usersTable.username,
    })
    .from(creatorPayoutProfilesTable)
    .innerJoin(channelsTable, eq(creatorPayoutProfilesTable.channelId, channelsTable.id))
    .innerJoin(usersTable, eq(channelsTable.ownerUserId, usersTable.id))
    .where(eq(creatorPayoutProfilesTable.id, params.data.id));
  if (!before) {
    res.status(404).json({ error: "Payout profile not found" });
    return;
  }

  const now = new Date();
  await db
    .update(creatorPayoutProfilesTable)
    .set({
      reviewStatus: body.data.decision,
      confirmationStatus: body.data.decision === "approved" ? "confirmed" : "rejected",
      confirmedAt: body.data.decision === "approved" ? now : null,
      reviewedByUserId: req.user!.userId,
      reviewedAt: now,
      updatedAt: now,
    })
    .where(eq(creatorPayoutProfilesTable.id, before.id));

  const [after] = await db
    .select({
      id: creatorPayoutProfilesTable.id,
      currency: creatorPayoutProfilesTable.currency,
      addressMasked: creatorPayoutProfilesTable.addressMasked,
      confirmationStatus: creatorPayoutProfilesTable.confirmationStatus,
      reviewStatus: creatorPayoutProfilesTable.reviewStatus,
      confirmedAt: creatorPayoutProfilesTable.confirmedAt,
      updatedAt: creatorPayoutProfilesTable.updatedAt,
      channelId: channelsTable.id,
      channelSlug: channelsTable.slug,
      channelDisplayName: channelsTable.displayName,
      creatorUsername: usersTable.username,
    })
    .from(creatorPayoutProfilesTable)
    .innerJoin(channelsTable, eq(creatorPayoutProfilesTable.channelId, channelsTable.id))
    .innerJoin(usersTable, eq(channelsTable.ownerUserId, usersTable.id))
    .where(eq(creatorPayoutProfilesTable.id, before.id));

  await writeAuditLog(req, {
    action: `owner_payout_profile.${body.data.decision}`,
    targetType: "creator_payout_profile",
    targetId: String(before.id),
    reason: body.data.reason,
    beforeState: toAdminPayoutProfile(before),
    afterState: toAdminPayoutProfile(after!),
  });
  res.json(ReviewAdminPayoutProfileResponse.parse(toAdminPayoutProfile(after!)));
});

router.get("/admin/finance/payout-requests", requireOwner, async (_req, res): Promise<void> => {
  const rows = await db
    .select({
      id: payoutRequestsTable.id,
      currency: payoutRequestsTable.currency,
      amount: payoutRequestsTable.amount,
      destinationMasked: payoutRequestsTable.destinationMasked,
      requestSource: payoutRequestsTable.requestSource,
      feeAmount: payoutRequestsTable.feeAmount,
      feeCurrency: payoutRequestsTable.feeCurrency,
      usdReferenceAmount: payoutRequestsTable.usdReferenceAmount,
      status: payoutRequestsTable.status,
      riskHoldReason: payoutRequestsTable.riskHoldReason,
      requestedAt: payoutRequestsTable.requestedAt,
      reviewedAt: payoutRequestsTable.reviewedAt,
      completedAt: payoutRequestsTable.completedAt,
      providerTransactionUrl: payoutRequestsTable.providerTransactionUrl,
      channelId: channelsTable.id,
      channelSlug: channelsTable.slug,
      channelDisplayName: channelsTable.displayName,
      creatorUsername: usersTable.username,
    })
    .from(payoutRequestsTable)
    .innerJoin(channelsTable, eq(payoutRequestsTable.channelId, channelsTable.id))
    .innerJoin(usersTable, eq(channelsTable.ownerUserId, usersTable.id))
    .orderBy(desc(payoutRequestsTable.requestedAt));
  res.json(ListAdminPayoutRequestsResponse.parse(rows.filter((row) => isSupportedKryvCryptoCode(row.currency)).map(toAdminPayoutRequest)));
});

router.post("/admin/finance/payout-requests/:id/review", requireOwner, async (req, res): Promise<void> => {
  const params = ReviewAdminPayoutRequestParams.safeParse(req.params);
  const body = ReviewAdminPayoutRequestBody.safeParse(req.body);
  if (!params.success || !body.success) {
    res.status(400).json({ error: params.success ? body.error.message : params.error.message });
    return;
  }
  const [before] = await db
    .select({
      id: payoutRequestsTable.id,
      channelId: payoutRequestsTable.channelId,
      requestedByUserId: payoutRequestsTable.requestedByUserId,
      currency: payoutRequestsTable.currency,
      amount: payoutRequestsTable.amount,
      destinationMasked: payoutRequestsTable.destinationMasked,
      requestSource: payoutRequestsTable.requestSource,
      feeAmount: payoutRequestsTable.feeAmount,
      feeCurrency: payoutRequestsTable.feeCurrency,
      usdReferenceAmount: payoutRequestsTable.usdReferenceAmount,
      status: payoutRequestsTable.status,
      riskHoldReason: payoutRequestsTable.riskHoldReason,
      requestedAt: payoutRequestsTable.requestedAt,
      reviewedAt: payoutRequestsTable.reviewedAt,
      completedAt: payoutRequestsTable.completedAt,
      providerTransactionUrl: payoutRequestsTable.providerTransactionUrl,
      channelSlug: channelsTable.slug,
      channelDisplayName: channelsTable.displayName,
      creatorUsername: usersTable.username,
    })
    .from(payoutRequestsTable)
    .innerJoin(channelsTable, eq(payoutRequestsTable.channelId, channelsTable.id))
    .innerJoin(usersTable, eq(channelsTable.ownerUserId, usersTable.id))
    .where(eq(payoutRequestsTable.id, params.data.id));
  if (!before) {
    res.status(404).json({ error: "Payout request not found" });
    return;
  }
  if (before.requestedByUserId === req.user!.userId) {
    res.status(403).json({ error: "An owner cannot approve their own payout request." });
    return;
  }
  if (!["requested", "held"].includes(before.status)) {
    res.status(400).json({ error: "Only requested or held payouts can be reviewed." });
    return;
  }

  const nextStatus = body.data.decision === "approved" ? "approved" : body.data.decision === "held" ? "held" : "rejected";
  const now = new Date();
  await db.transaction(async (txn) => {
    if (body.data.decision === "rejected") {
      await txn.execute(sql`SELECT id FROM creator_balances WHERE channel_id = ${before.channelId} AND currency = ${before.currency} FOR UPDATE`);
      const [balance] = await txn
        .select()
        .from(creatorBalancesTable)
        .where(and(eq(creatorBalancesTable.channelId, before.channelId), eq(creatorBalancesTable.currency, before.currency)))
        .limit(1);
      if (!balance) throw new Error("Creator balance projection is missing for this payout.");
      await txn
        .update(creatorBalancesTable)
        .set({
          availableAmount: sql`${creatorBalancesTable.availableAmount} + ${before.amount}`,
          heldAmount: sql`${creatorBalancesTable.heldAmount} - ${before.amount}`,
          updatedAt: now,
        })
        .where(eq(creatorBalancesTable.id, balance.id));
      await txn.insert(creatorBalanceMovementsTable).values({
        channelId: before.channelId,
        currency: before.currency,
        movementType: "payout_released",
        availableDelta: toDecimalString(before.amount),
        heldDelta: `-${toDecimalString(before.amount)}`,
        pendingDelta: "0",
        sourceType: "payout_request",
        sourceId: String(before.id),
        idempotencyKey: `payout-release:${before.id}`,
        metadata: { decision: "rejected", reason: body.data.reason ?? null },
      });
    }
    await txn
      .update(payoutRequestsTable)
      .set({ status: nextStatus, riskHoldReason: body.data.decision === "held" ? body.data.reason ?? "Owner review hold" : body.data.decision === "rejected" ? body.data.reason ?? "Owner rejected payout" : null, reviewedAt: now })
      .where(eq(payoutRequestsTable.id, before.id));
    await txn.insert(payoutApprovalsTable).values({
      payoutRequestId: before.id,
      reviewerUserId: req.user!.userId,
      decision: body.data.decision,
      reason: body.data.reason ?? null,
    });
  });

  const [after] = await db
    .select({
      id: payoutRequestsTable.id,
      currency: payoutRequestsTable.currency,
      amount: payoutRequestsTable.amount,
      destinationMasked: payoutRequestsTable.destinationMasked,
      requestSource: payoutRequestsTable.requestSource,
      feeAmount: payoutRequestsTable.feeAmount,
      feeCurrency: payoutRequestsTable.feeCurrency,
      usdReferenceAmount: payoutRequestsTable.usdReferenceAmount,
      status: payoutRequestsTable.status,
      riskHoldReason: payoutRequestsTable.riskHoldReason,
      requestedAt: payoutRequestsTable.requestedAt,
      reviewedAt: payoutRequestsTable.reviewedAt,
      completedAt: payoutRequestsTable.completedAt,
      providerTransactionUrl: payoutRequestsTable.providerTransactionUrl,
      channelId: channelsTable.id,
      channelSlug: channelsTable.slug,
      channelDisplayName: channelsTable.displayName,
      creatorUsername: usersTable.username,
    })
    .from(payoutRequestsTable)
    .innerJoin(channelsTable, eq(payoutRequestsTable.channelId, channelsTable.id))
    .innerJoin(usersTable, eq(channelsTable.ownerUserId, usersTable.id))
    .where(eq(payoutRequestsTable.id, before.id));

  await writeAuditLog(req, {
    action: `owner_payout_request.${body.data.decision}`,
    targetType: "payout_request",
    targetId: String(before.id),
    reason: body.data.reason,
    beforeState: toAdminPayoutRequest(before),
    afterState: toAdminPayoutRequest(after!),
  });
  res.json(ReviewAdminPayoutRequestResponse.parse(toAdminPayoutRequest(after!)));
});

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
  "/admin/users/:id/activity",
  requireOwner,
  async (req, res): Promise<void> => {
    const params = GetAdminUserActivityParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }

    const userId = Number(params.data.id);
    if (!Number.isSafeInteger(userId) || userId < 1) {
      res.status(400).json({ error: "Invalid user ID" });
      return;
    }

    const [user] = await db
      .select({
        id: usersTable.id,
        username: usersTable.username,
        avatarUrl: usersTable.avatarUrl,
        role: usersTable.role,
        banned: usersTable.banned,
        createdAt: usersTable.createdAt,
        activityObservabilityEnabled: usersTable.activityObservabilityEnabled,
      })
      .from(usersTable)
      .where(eq(usersTable.id, userId));

    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    const [presence, devices, activity, channels] = await Promise.all([
      db
        .select({ routeKey: userActivityPresenceTable.routeKey, deviceClass: userActivityPresenceTable.deviceClass, updatedAt: userActivityPresenceTable.updatedAt })
        .from(userActivityPresenceTable)
        .where(eq(userActivityPresenceTable.userId, userId)),
      db
        .select({ deviceName: deviceHistoryTable.deviceName, deviceOs: deviceHistoryTable.deviceOs, deviceBrowser: deviceHistoryTable.deviceBrowser, lastSeen: deviceHistoryTable.lastSeen, loginCount: deviceHistoryTable.loginCount })
        .from(deviceHistoryTable)
        .where(eq(deviceHistoryTable.userId, userId))
        .orderBy(desc(deviceHistoryTable.lastSeen))
        .limit(8),
      db
        .select({ action: activityLogsTable.action, createdAt: activityLogsTable.createdAt })
        .from(activityLogsTable)
        .where(eq(activityLogsTable.userId, userId))
        .orderBy(desc(activityLogsTable.createdAt))
        .limit(30),
      db.select().from(channelsTable).where(eq(channelsTable.ownerUserId, userId)),
    ]);

    await writeAuditLog(req, {
      action: "admin.user_activity.view",
      targetType: "user",
      targetId: userId,
      afterState: { activityObservabilityEnabled: user.activityObservabilityEnabled },
    });

    res.json(GetAdminUserActivityResponse.parse({
      user: {
        id: user.id,
        username: user.username,
        avatarUrl: user.avatarUrl,
        role: user.role,
        banned: user.banned,
        createdAt: user.createdAt,
      },
      activityObservabilityEnabled: user.activityObservabilityEnabled,
      currentPresence: user.activityObservabilityEnabled && presence[0] ? presence[0] : null,
      devices,
      activity,
      channels: await Promise.all(channels.map(toChannelSummary)),
    }));
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
