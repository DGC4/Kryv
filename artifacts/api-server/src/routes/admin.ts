import { Router, type IRouter } from "express";
import { and, asc, count, desc, eq, gte, ilike, inArray, or, sql } from "drizzle-orm";
import { z } from "zod";
import {
  db,
  categoriesTable,
  usersTable,
  channelsTable,
  activityLogsTable,
  deviceHistoryTable,
  userActivityPresenceTable,
  videosTable,
  featureFlagsTable,
  adminTreasuryContextTable,
  platformFocusSettingsTable,
  creatorBalanceMovementsTable,
  creatorBalancesTable,
  creatorPayoutProfilesTable,
  payoutRequestsTable,
  payoutApprovalsTable,
  adCampaignsTable,
  adCampaignFundingsTable,
  adRevenueMovementsTable,
  cinemaTitlesTable,
  moderationCasesTable,
  paymentEventsTable,
  paymentIntentsTable,
  chatMessagesTable,
  streamSessionsTable,
  subscriptionsTable,
  platformRevenueMovementsTable,
  watchHistoryTable,
} from "@workspace/db";
import {
  GetAdminAnalyticsQueryParams,
  GetAdminAnalyticsResponse,
  GetAdminCommandOverviewResponse,
  GetAdminFinanceLedgerResponse,
  GetAdminStatsResponse,
  ListAdminUsersQueryParams,
  ListAdminUsersResponse,
  UpdateAdminUserParams,
  UpdateAdminUserBody,
  UpdateAdminUserResponse,
  GetAdminUserActivityParams,
  GetAdminUserActivityResponse,
  ListAdminChannelsQueryParams,
  ListAdminChannelsResponse,
  DeleteAdminChannelParams,
  ListAdminVideosQueryParams,
  ListAdminVideosResponse,
  DeleteAdminVideoParams,
  ListAdminFeatureFlagsResponse,
  UpdateAdminFeatureFlagParams,
  UpdateAdminFeatureFlagBody,
  UpdateAdminFeatureFlagResponse,
  GetAdminFinanceOverviewResponse,
  GetAdminTreasuryContextResponse,
  UpdateAdminTreasuryContextBody,
  UpdateAdminTreasuryContextResponse,
  GetAdminFocusModeResponse,
  UpdateAdminFocusModeBody,
  UpdateAdminFocusModeResponse,
  GetPlatformFocusModeResponse,
  ListAdminCreatorBalancesResponse,
  GetAdminCreatorBalanceDetailParams,
  GetAdminCreatorBalanceDetailResponse,
  ListAdminPayoutProfilesQueryParams,
  ListAdminPayoutProfilesResponse,
  ReviewAdminPayoutProfileParams,
  ReviewAdminPayoutProfileBody,
  ReviewAdminPayoutProfileResponse,
  ListAdminPayoutRequestsQueryParams,
  ListAdminPayoutRequestsResponse,
  ReviewAdminPayoutRequestParams,
  ReviewAdminPayoutRequestBody,
  ReviewAdminPayoutRequestResponse,
  ListAdminModerationCasesQueryParams,
  ListAdminModerationCasesResponse,
  ReviewAdminModerationCaseParams,
  ReviewAdminModerationCaseBody,
  ReviewAdminModerationCaseResponse,
} from "@workspace/api-zod";
import { requireOwner } from "../lib/auth";
import { toChannelSummaries } from "../lib/channelSerializer";
import { toVideoSummaryFromRelations } from "../lib/videoSerializer";
import { literalIlikePattern } from "../lib/search";
import { writeAuditLog } from "../lib/operations";
import { createPlisioInvoice, getPlisioAssetSnapshots, isPlisioConfigured, isSupportedKryvCryptoCode, supportedKryvCryptoCodes, type KryvCryptoCode } from "../lib/plisio";

const HARD_DISABLED_OPERATIONAL_FLAGS = new Set([
  "customer_wallet_custody",
  "ads_delivery",
  "scheduled_payout_requests",
  "provider_withdrawals",
]);

const OPERATIONAL_FLAG_COPY: Record<string, string> = {
  crypto_commerce: "Crypto-only invoices for channel support and subscriptions. Disable immediately if provider callbacks or settlement monitoring are unhealthy.",
  ads_delivery: "Viewer ad decision and eligible ad-break delivery. This capability is hard-disabled and cannot be activated through the owner console.",
  creator_payout_requests: "Creator payout request queue. Keep disabled until encrypted payout profiles, creator ledger monitoring, and owner review procedures are operational.",
  scheduled_payout_requests: "Scheduled daily, weekly, and monthly payout request generation. This capability is hard-disabled and cannot be activated through the owner console.",
  provider_withdrawals: "Provider withdrawal execution. This capability is hard-disabled and cannot be activated through the owner console.",
  customer_wallet_custody: "Customer deposit addresses and stored crypto balances. This capability is hard-disabled and cannot be activated through the owner console.",
};

function toAdminFeatureFlag(row: { key: string; enabled: boolean; description: string | null; updatedAt: Date }) {
  return {
    key: row.key,
    enabled: HARD_DISABLED_OPERATIONAL_FLAGS.has(row.key) ? false : row.enabled,
    description: row.description || OPERATIONAL_FLAG_COPY[row.key] || "Platform operational feature flag.",
    updatedAt: row.updatedAt.toISOString(),
  };
}

function toDecimalString(value: unknown) {
  return typeof value === "string" ? value : String(value ?? "0");
}

function toAdminModerationCase(row: typeof moderationCasesTable.$inferSelect) {
  return {
    id: row.id,
    channelId: row.channelId,
    reporterUserId: row.reporterUserId,
    subjectUserId: row.subjectUserId,
    reporterUsername: null,
    subjectUsername: null,
    caseType: row.caseType,
    status: row.status as "open" | "resolved" | "dismissed",
    summary: row.summary,
    evidence: Array.isArray(row.evidence) ? row.evidence : [],
    resolution: row.resolution,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

const CryptoCode = z.enum(["BTC", "LTC", "ETH", "DOGE"]);
const AdCampaignIdParams = z.object({ id: z.coerce.number().int().positive() });
const CreateAdminAdCampaignBody = z.object({
  name: z.string().trim().min(2).max(140),
  advertiserName: z.string().trim().min(2).max(140).optional(),
  fundingMode: z.enum(["promotional", "paid"]),
  budgetUsd: z.string().regex(/^\d+(\.\d{1,2})?$/).optional(),
  creatorShareBps: z.number().int().min(0).max(10_000).default(0),
  startsAt: z.coerce.date().optional(),
  endsAt: z.coerce.date(),
}).superRefine((value, ctx) => {
  if (value.endsAt <= (value.startsAt ?? new Date())) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["endsAt"], message: "Campaign end time must be later than its start time." });
  }
  if (value.fundingMode === "paid" && (!value.budgetUsd || Number(value.budgetUsd) <= 0)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["budgetUsd"], message: "A positive USD reference budget is required to create a crypto-funded campaign invoice." });
  }
});
const CreateAdminAdFundingInvoiceBody = z.object({ cryptoCurrency: CryptoCode.optional() });

function toAdminAdCampaign(row: {
  id: number;
  name: string;
  advertiserName: string | null;
  campaignType: string;
  status: string;
  fundingMode: string;
  fundingStatus: string;
  budgetAmount: unknown;
  budgetCurrency: string | null;
  budgetSpentAmount: unknown;
  creatorShareBps: number;
  startsAt: Date | null;
  endsAt: Date | null;
  approvedAt: Date | null;
  createdAt: Date;
}) {
  return {
    id: row.id,
    name: row.name,
    advertiserName: row.advertiserName,
    campaignType: row.campaignType,
    status: row.status,
    fundingMode: row.fundingMode,
    fundingStatus: row.fundingStatus,
    budgetAmount: row.budgetAmount === null ? null : toDecimalString(row.budgetAmount),
    budgetCurrency: row.budgetCurrency,
    budgetSpentAmount: toDecimalString(row.budgetSpentAmount),
    creatorShareBps: row.creatorShareBps,
    startsAt: row.startsAt,
    endsAt: row.endsAt,
    approvedAt: row.approvedAt,
    createdAt: row.createdAt,
  };
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

async function isOperationalFeatureEnabled(key: string) {
  if (HARD_DISABLED_OPERATIONAL_FLAGS.has(key)) return false;
  const [flag] = await db.select({ enabled: featureFlagsTable.enabled }).from(featureFlagsTable).where(eq(featureFlagsTable.key, key)).limit(1);
  return Boolean(flag?.enabled);
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
    scheduledPayoutRequestsEnabled: false,
    providerWithdrawalsEnabled: false,
  };
}

const router: IRouter = Router();

router.get("/admin/moderation/cases", requireOwner, async (req, res): Promise<void> => {
  const query = ListAdminModerationCasesQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }
  const moderationFilter = query.data.status
    ? eq(moderationCasesTable.status, query.data.status)
    : undefined;
  const [totalRows, rows] = await Promise.all([
    db
      .select({ total: count() })
      .from(moderationCasesTable)
      .where(moderationFilter),
    db
      .select()
      .from(moderationCasesTable)
      .where(moderationFilter)
      .orderBy(desc(moderationCasesTable.createdAt), desc(moderationCasesTable.id))
      .limit(query.data.limit)
      .offset(query.data.offset),
  ]);
  res.json(ListAdminModerationCasesResponse.parse({
    items: rows.map(toAdminModerationCase),
    total: totalRows[0]?.total ?? 0,
    limit: query.data.limit,
    offset: query.data.offset,
  }));
});

router.post("/admin/moderation/cases/:id/review", requireOwner, async (req, res): Promise<void> => {
  const params = ReviewAdminModerationCaseParams.safeParse(req.params);
  const body = ReviewAdminModerationCaseBody.safeParse(req.body);
  if (!params.success || !body.success) {
    res.status(400).json({ error: params.success ? body.error?.message ?? "Invalid request body" : params.error.message });
    return;
  }
  const [current] = await db.select().from(moderationCasesTable).where(eq(moderationCasesTable.id, params.data.id)).limit(1);
  if (!current) {
    res.status(404).json({ error: "Moderation case not found." });
    return;
  }
  if (current.status !== "open") {
    res.status(409).json({ error: "This moderation case has already been reviewed and cannot be overwritten." });
    return;
  }
  const reviewedAt = new Date();
  const resolution = body.data.resolution?.trim() || (body.data.decision === "resolved" ? "Resolved by owner review." : "Dismissed by owner review.");
  const [updated] = await db
    .update(moderationCasesTable)
    .set({ status: body.data.decision, resolution, assignedToUserId: req.user!.userId, resolvedAt: reviewedAt, updatedAt: reviewedAt })
    .where(eq(moderationCasesTable.id, current.id))
    .returning();
  await writeAuditLog(req, {
    action: "moderation_case_reviewed",
    targetType: "moderation_case",
    targetId: updated.id,
    reason: resolution,
    beforeState: { status: current.status },
    afterState: { status: updated.status, decision: body.data.decision },
  });
  res.json(ReviewAdminModerationCaseResponse.parse(toAdminModerationCase(updated)));
});

router.get("/admin/overview", requireOwner, async (_req, res): Promise<void> => {
  const [channelStats, videoStats, cinemaStats, paymentStatuses, revenueRows, payoutStatuses, openCases, pendingProfiles, flags] = await Promise.all([
    db.select({
      creatorChannels: sql<number>`count(*)`.mapWith(Number),
      liveChannels: sql<number>`count(*) filter (where ${channelsTable.isLive})`.mapWith(Number),
    }).from(channelsTable),
    db.select({
      watchItems: sql<number>`count(*)`.mapWith(Number),
      readyWatchItems: sql<number>`count(*) filter (where ${videosTable.uploadStatus} = 'ready')`.mapWith(Number),
      totalViews: sql<number>`coalesce(sum(${videosTable.viewCount}), 0)`.mapWith(Number),
    }).from(videosTable),
    db.select({ count: sql<number>`count(*)`.mapWith(Number) }).from(cinemaTitlesTable),
    db.select({ status: paymentIntentsTable.status, count: sql<number>`count(*)`.mapWith(Number) })
      .from(paymentIntentsTable)
      .groupBy(paymentIntentsTable.status),
    db.select({
      currency: platformRevenueMovementsTable.currency,
      grossAmount: sql<string>`coalesce(sum(${platformRevenueMovementsTable.grossAmount}), 0)::text`,
      platformFeeAmount: sql<string>`coalesce(sum(${platformRevenueMovementsTable.platformFeeAmount}), 0)::text`,
      creatorNetAmount: sql<string>`coalesce(sum(${platformRevenueMovementsTable.creatorNetAmount}), 0)::text`,
    }).from(platformRevenueMovementsTable).groupBy(platformRevenueMovementsTable.currency),
    db.select({ status: payoutRequestsTable.status, count: sql<number>`count(*)`.mapWith(Number) })
      .from(payoutRequestsTable)
      .groupBy(payoutRequestsTable.status),
    db.select({ count: sql<number>`count(*)`.mapWith(Number) }).from(moderationCasesTable).where(eq(moderationCasesTable.status, "open")),
    db.select({ count: sql<number>`count(*)`.mapWith(Number) }).from(creatorPayoutProfilesTable).where(eq(creatorPayoutProfilesTable.reviewStatus, "pending")),
    db.select({ key: featureFlagsTable.key, enabled: featureFlagsTable.enabled }).from(featureFlagsTable),
  ]);
  const flagMap = new Map(flags.map((row) => [row.key, row.enabled]));
  const pendingPayoutReviews = payoutStatuses
    .filter((row) => row.status === "requested" || row.status === "held")
    .reduce((total, row) => total + row.count, 0);

  res.json(GetAdminCommandOverviewResponse.parse({
    platform: {
      creatorChannels: channelStats[0]?.creatorChannels ?? 0,
      liveChannels: channelStats[0]?.liveChannels ?? 0,
      watchItems: videoStats[0]?.watchItems ?? 0,
      readyWatchItems: videoStats[0]?.readyWatchItems ?? 0,
      cinemaTitles: cinemaStats[0]?.count ?? 0,
      totalViews: videoStats[0]?.totalViews ?? 0,
    },
    commerce: {
      providerConfigured: isPlisioConfigured(),
      cryptoCommerceEnabled: Boolean(flagMap.get("crypto_commerce")),
      payoutRequestsEnabled: Boolean(flagMap.get("creator_payout_requests")),
      scheduledPayoutRequestsEnabled: false,
      providerWithdrawalsEnabled: false,
      customerWalletCustodyEnabled: false,
      adsDeliveryEnabled: false,
      pendingProfileReviews: pendingProfiles[0]?.count ?? 0,
      pendingPayoutReviews,
    },
    payments: paymentStatuses.map((row) => ({ status: row.status, count: row.count })),
    revenueByAsset: revenueRows.map((row) => ({
      currency: row.currency,
      grossAmount: toDecimalString(row.grossAmount),
      platformFeeAmount: toDecimalString(row.platformFeeAmount),
      creatorNetAmount: toDecimalString(row.creatorNetAmount),
    })),
    payoutStatusCounts: payoutStatuses.map((row) => ({ status: row.status, count: row.count })),
    safety: { openCases: openCases[0]?.count ?? 0 },
  }));
});

router.get("/admin/analytics", requireOwner, async (req, res): Promise<void> => {
  // Express exposes URL query values as strings. The generated contract keeps
  // rangeDays numeric so callers inside the app retain a precise 1/7/30-day
  // type; normalize only a single scalar query string at this HTTP boundary.
  // Arrays, malformed text, and unsupported values still fail contract validation.
  const rawRangeDays = req.query.rangeDays;
  const normalizedRangeDays = typeof rawRangeDays === "string" ? Number(rawRangeDays) : rawRangeDays;
  const params = GetAdminAnalyticsQueryParams.safeParse({ ...req.query, rangeDays: normalizedRangeDays });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const rangeDays = params.data.rangeDays ?? 7;
  const periodStart = new Date();
  periodStart.setDate(periodStart.getDate() - rangeDays);

  const [streamSummary, chatSummary, activeSubscriptions, dailyStreams, dailyChats, topCreators, revenueByAsset, topWatchVideos] = await Promise.all([
    db.select({
      streamSessions: sql<number>`count(*)`.mapWith(Number),
      streamSeconds: sql<number>`coalesce(sum(coalesce(${streamSessionsTable.durationSeconds}, extract(epoch from (coalesce(${streamSessionsTable.endedAt}, now()) - ${streamSessionsTable.startedAt}))::int)), 0)`.mapWith(Number),
      activeCreators: sql<number>`count(distinct ${streamSessionsTable.channelId})`.mapWith(Number),
    }).from(streamSessionsTable).where(gte(streamSessionsTable.startedAt, periodStart)),
    db.select({ chatMessages: sql<number>`count(*)`.mapWith(Number) }).from(chatMessagesTable).where(gte(chatMessagesTable.createdAt, periodStart)),
    db.select({ count: sql<number>`count(*)`.mapWith(Number) }).from(subscriptionsTable).where(eq(subscriptionsTable.status, "active")),
    db.select({
      bucket: sql<string>`to_char(date_trunc('day', ${streamSessionsTable.startedAt}), 'YYYY-MM-DD')`,
      streamSessions: sql<number>`count(*)`.mapWith(Number),
    }).from(streamSessionsTable).where(gte(streamSessionsTable.startedAt, periodStart)).groupBy(sql`date_trunc('day', ${streamSessionsTable.startedAt})`).orderBy(sql`date_trunc('day', ${streamSessionsTable.startedAt})`),
    db.select({
      bucket: sql<string>`to_char(date_trunc('day', ${chatMessagesTable.createdAt}), 'YYYY-MM-DD')`,
      chatMessages: sql<number>`count(*)`.mapWith(Number),
    }).from(chatMessagesTable).where(gte(chatMessagesTable.createdAt, periodStart)).groupBy(sql`date_trunc('day', ${chatMessagesTable.createdAt})`).orderBy(sql`date_trunc('day', ${chatMessagesTable.createdAt})`),
    db.select({
      channelId: streamSessionsTable.channelId,
      channelDisplayName: channelsTable.displayName,
      streamSessions: sql<number>`count(*)`.mapWith(Number),
      streamSeconds: sql<number>`coalesce(sum(coalesce(${streamSessionsTable.durationSeconds}, extract(epoch from (coalesce(${streamSessionsTable.endedAt}, now()) - ${streamSessionsTable.startedAt}))::int)), 0)`.mapWith(Number),
      chatMessages: sql<number>`coalesce(sum(${streamSessionsTable.totalChatMessages}), 0)`.mapWith(Number),
    }).from(streamSessionsTable).innerJoin(channelsTable, eq(streamSessionsTable.channelId, channelsTable.id)).where(gte(streamSessionsTable.startedAt, periodStart)).groupBy(streamSessionsTable.channelId, channelsTable.displayName).orderBy(desc(sql`count(*)`)).limit(8),
    db.select({
      currency: platformRevenueMovementsTable.currency,
      grossAmount: sql<string>`coalesce(sum(${platformRevenueMovementsTable.grossAmount}), 0)::text`,
      platformFeeAmount: sql<string>`coalesce(sum(${platformRevenueMovementsTable.platformFeeAmount}), 0)::text`,
      creatorNetAmount: sql<string>`coalesce(sum(${platformRevenueMovementsTable.creatorNetAmount}), 0)::text`,
    }).from(platformRevenueMovementsTable).where(gte(platformRevenueMovementsTable.createdAt, periodStart)).groupBy(platformRevenueMovementsTable.currency),
    db.select({
      videoId: watchHistoryTable.videoId,
      videoTitle: videosTable.title,
      channelDisplayName: channelsTable.displayName,
      recordedViewerCount: sql<number>`count(*)`.mapWith(Number),
    }).from(watchHistoryTable)
      .innerJoin(videosTable, eq(watchHistoryTable.videoId, videosTable.id))
      .innerJoin(channelsTable, eq(videosTable.channelId, channelsTable.id))
      .where(gte(watchHistoryTable.watchedAt, periodStart))
      .groupBy(watchHistoryTable.videoId, videosTable.title, channelsTable.displayName)
      .orderBy(desc(sql`count(*)`), desc(watchHistoryTable.videoId))
      .limit(8),
  ]);
  const chatByBucket = new Map(dailyChats.map((row) => [row.bucket, row.chatMessages]));
  const streamByBucket = new Map(dailyStreams.map((row) => [row.bucket, row.streamSessions]));
  const buckets = [...new Set([...streamByBucket.keys(), ...chatByBucket.keys()])].sort();

  res.json(GetAdminAnalyticsResponse.parse({
    rangeDays,
    summary: {
      streamSessions: streamSummary[0]?.streamSessions ?? 0,
      streamSeconds: streamSummary[0]?.streamSeconds ?? 0,
      chatMessages: chatSummary[0]?.chatMessages ?? 0,
      activeCreators: streamSummary[0]?.activeCreators ?? 0,
      activeSubscriptions: activeSubscriptions[0]?.count ?? 0,
    },
    activity: buckets.map((bucket) => ({ bucket, streamSessions: streamByBucket.get(bucket) ?? 0, chatMessages: chatByBucket.get(bucket) ?? 0 })),
    topCreators: topCreators.map((creator) => ({ ...creator })),
    topWatchVideos: topWatchVideos.map((video) => ({ ...video })),
    revenueByAsset: revenueByAsset.map((asset) => ({
      currency: asset.currency,
      grossAmount: toDecimalString(asset.grossAmount),
      platformFeeAmount: toDecimalString(asset.platformFeeAmount),
      creatorNetAmount: toDecimalString(asset.creatorNetAmount),
    })),
  }));
});

function toAdminTreasuryContext(row: typeof adminTreasuryContextTable.$inferSelect | undefined) {
  return {
    label: row?.label ?? null,
    notes: row?.notes ?? null,
    updatedAt: row?.updatedAt ?? null,
  };
}

function toAdminFocusMode(row: typeof platformFocusSettingsTable.$inferSelect | undefined) {
  const sourceType = row?.sourceType === "cinema" ? "cinema" as const : "live" as const;
  const sourceId = sourceType === "cinema" ? row?.cinemaTitleId ?? null : row?.liveChannelId ?? null;
  return {
    isEnabled: row?.isEnabled ?? false,
    sourceType,
    sourceId,
    chatEnabled: row?.chatEnabled ?? true,
    announcementText: row?.announcementText ?? null,
    updatedAt: (row?.updatedAt ?? new Date()).toISOString(),
  };
}

function toPlatformFocusMode(row: typeof platformFocusSettingsTable.$inferSelect | undefined) {
  const adminState = toAdminFocusMode(row);
  if (!adminState.isEnabled) {
    return { ...adminState, sourceType: null, sourceId: null, announcementText: null };
  }
  return adminState;
}

router.get("/platform/focus", async (_req, res): Promise<void> => {
  const [settings] = await db.select().from(platformFocusSettingsTable).where(eq(platformFocusSettingsTable.id, 1));
  res.json(GetPlatformFocusModeResponse.parse(toPlatformFocusMode(settings)));
});

router.get("/admin/focus-mode", requireOwner, async (_req, res): Promise<void> => {
  const [settings] = await db.select().from(platformFocusSettingsTable).where(eq(platformFocusSettingsTable.id, 1));
  res.json(GetAdminFocusModeResponse.parse(toAdminFocusMode(settings)));
});

router.put("/admin/focus-mode", requireOwner, async (req, res): Promise<void> => {
  const body = UpdateAdminFocusModeBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }

  const sourceId = body.data.sourceId ?? null;
  if (body.data.isEnabled && !sourceId) {
    res.status(400).json({ error: "Choose a live channel or published Cinema title before enabling Focus Mode." });
    return;
  }

  if (sourceId) {
    if (body.data.sourceType === "live") {
      const [channel] = await db.select({ id: channelsTable.id }).from(channelsTable).where(eq(channelsTable.id, sourceId)).limit(1);
      if (!channel) {
        res.status(400).json({ error: "The selected live channel no longer exists." });
        return;
      }
    } else {
      const [title] = await db.select({ id: cinemaTitlesTable.id, publishState: cinemaTitlesTable.publishState }).from(cinemaTitlesTable).where(eq(cinemaTitlesTable.id, sourceId)).limit(1);
      if (!title || title.publishState !== "published") {
        res.status(400).json({ error: "Focus Mode can use only an existing published Cinema title." });
        return;
      }
    }
  }

  const announcementText = body.data.announcementText?.trim() || null;
  const [before] = await db.select().from(platformFocusSettingsTable).where(eq(platformFocusSettingsTable.id, 1));
  const now = new Date();
  const [updated] = await db.insert(platformFocusSettingsTable)
    .values({
      id: 1,
      isEnabled: body.data.isEnabled,
      sourceType: body.data.sourceType,
      liveChannelId: body.data.sourceType === "live" ? sourceId : null,
      cinemaTitleId: body.data.sourceType === "cinema" ? sourceId : null,
      chatEnabled: body.data.chatEnabled,
      announcementText,
      updatedByUserId: req.user!.userId,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: platformFocusSettingsTable.id,
      set: {
        isEnabled: body.data.isEnabled,
        sourceType: body.data.sourceType,
        liveChannelId: body.data.sourceType === "live" ? sourceId : null,
        cinemaTitleId: body.data.sourceType === "cinema" ? sourceId : null,
        chatEnabled: body.data.chatEnabled,
        announcementText,
        updatedByUserId: req.user!.userId,
        updatedAt: now,
      },
    })
    .returning();

  await writeAuditLog(req, {
    action: "admin.focus_mode.update",
    targetType: "platform_focus_settings",
    targetId: "1",
    beforeState: toAdminFocusMode(before),
    afterState: toAdminFocusMode(updated),
  });
  res.json(UpdateAdminFocusModeResponse.parse(toAdminFocusMode(updated)));
});

router.get("/admin/finance/context", requireOwner, async (_req, res): Promise<void> => {
  const [context] = await db.select().from(adminTreasuryContextTable).where(eq(adminTreasuryContextTable.id, 1));
  res.json(GetAdminTreasuryContextResponse.parse(toAdminTreasuryContext(context)));
});

router.put("/admin/finance/context", requireOwner, async (req, res): Promise<void> => {
  const body = UpdateAdminTreasuryContextBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }

  const label = body.data.label?.trim() || null;
  const notes = body.data.notes?.trim() || null;
  const [before] = await db.select().from(adminTreasuryContextTable).where(eq(adminTreasuryContextTable.id, 1));
  const now = new Date();
  const [updated] = await db.insert(adminTreasuryContextTable)
    .values({ id: 1, label, notes, updatedByUserId: req.user!.userId, updatedAt: now })
    .onConflictDoUpdate({
      target: adminTreasuryContextTable.id,
      set: { label, notes, updatedByUserId: req.user!.userId, updatedAt: now },
    })
    .returning();

  await writeAuditLog(req, {
    action: "admin.treasury_context.update",
    targetType: "admin_treasury_context",
    targetId: "1",
    beforeState: toAdminTreasuryContext(before),
    afterState: toAdminTreasuryContext(updated),
  });
  res.json(UpdateAdminTreasuryContextResponse.parse(toAdminTreasuryContext(updated)));
});

router.get("/admin/finance/ledger", requireOwner, async (_req, res): Promise<void> => {
  const [platformRevenue, creatorBalanceMovements, paymentEvents] = await Promise.all([
    db.select({
      id: platformRevenueMovementsTable.id,
      channelId: platformRevenueMovementsTable.channelId,
      channelDisplayName: channelsTable.displayName,
      currency: platformRevenueMovementsTable.currency,
      paymentKind: platformRevenueMovementsTable.paymentKind,
      grossAmount: platformRevenueMovementsTable.grossAmount,
      platformFeeAmount: platformRevenueMovementsTable.platformFeeAmount,
      creatorNetAmount: platformRevenueMovementsTable.creatorNetAmount,
      sourceType: platformRevenueMovementsTable.sourceType,
      createdAt: platformRevenueMovementsTable.createdAt,
    }).from(platformRevenueMovementsTable).innerJoin(channelsTable, eq(platformRevenueMovementsTable.channelId, channelsTable.id)).orderBy(desc(platformRevenueMovementsTable.createdAt)).limit(30),
    db.select({
      id: creatorBalanceMovementsTable.id,
      channelId: creatorBalanceMovementsTable.channelId,
      channelDisplayName: channelsTable.displayName,
      currency: creatorBalanceMovementsTable.currency,
      movementType: creatorBalanceMovementsTable.movementType,
      availableDelta: creatorBalanceMovementsTable.availableDelta,
      heldDelta: creatorBalanceMovementsTable.heldDelta,
      pendingDelta: creatorBalanceMovementsTable.pendingDelta,
      sourceType: creatorBalanceMovementsTable.sourceType,
      createdAt: creatorBalanceMovementsTable.createdAt,
    }).from(creatorBalanceMovementsTable).innerJoin(channelsTable, eq(creatorBalanceMovementsTable.channelId, channelsTable.id)).orderBy(desc(creatorBalanceMovementsTable.createdAt)).limit(30),
    db.select({
      id: paymentEventsTable.id,
      provider: paymentEventsTable.provider,
      eventType: paymentEventsTable.eventType,
      processingStatus: paymentEventsTable.processingStatus,
      errorCode: paymentEventsTable.errorCode,
      processedAt: paymentEventsTable.processedAt,
      createdAt: paymentEventsTable.createdAt,
    }).from(paymentEventsTable).orderBy(desc(paymentEventsTable.createdAt)).limit(30),
  ]);

  res.json(GetAdminFinanceLedgerResponse.parse({
    platformRevenue: platformRevenue.map((movement) => ({
      ...movement,
      grossAmount: toDecimalString(movement.grossAmount),
      platformFeeAmount: toDecimalString(movement.platformFeeAmount),
      creatorNetAmount: toDecimalString(movement.creatorNetAmount),
      createdAt: movement.createdAt.toISOString(),
    })),
    creatorBalanceMovements: creatorBalanceMovements.map((movement) => ({
      ...movement,
      availableDelta: toDecimalString(movement.availableDelta),
      heldDelta: toDecimalString(movement.heldDelta),
      pendingDelta: toDecimalString(movement.pendingDelta),
      createdAt: movement.createdAt.toISOString(),
    })),
    paymentEvents: paymentEvents.map((event) => ({
      ...event,
      processedAt: event.processedAt?.toISOString() ?? null,
      createdAt: event.createdAt.toISOString(),
    })),
  }));
});

router.get("/admin/finance/creator-balances", requireOwner, async (_req, res): Promise<void> => {
  const balances = await db
    .select({
      channelId: creatorBalancesTable.channelId,
      channelSlug: channelsTable.slug,
      channelDisplayName: channelsTable.displayName,
      creatorUsername: usersTable.username,
      currency: creatorBalancesTable.currency,
      pendingAmount: creatorBalancesTable.pendingAmount,
      availableAmount: creatorBalancesTable.availableAmount,
      heldAmount: creatorBalancesTable.heldAmount,
      updatedAt: creatorBalancesTable.updatedAt,
    })
    .from(creatorBalancesTable)
    .innerJoin(channelsTable, eq(creatorBalancesTable.channelId, channelsTable.id))
    .innerJoin(usersTable, eq(channelsTable.ownerUserId, usersTable.id))
    .orderBy(desc(creatorBalancesTable.updatedAt));

  res.json(ListAdminCreatorBalancesResponse.parse(balances.map((balance) => ({
    ...balance,
    pendingAmount: toDecimalString(balance.pendingAmount),
    availableAmount: toDecimalString(balance.availableAmount),
    heldAmount: toDecimalString(balance.heldAmount),
    updatedAt: balance.updatedAt.toISOString(),
  }))));
});

router.get("/admin/finance/creator-balances/:channelId", requireOwner, async (req, res): Promise<void> => {
  const params = GetAdminCreatorBalanceDetailParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [channel] = await db
    .select({
      channelId: channelsTable.id,
      channelSlug: channelsTable.slug,
      channelDisplayName: channelsTable.displayName,
      creatorUsername: usersTable.username,
    })
    .from(channelsTable)
    .innerJoin(usersTable, eq(channelsTable.ownerUserId, usersTable.id))
    .where(eq(channelsTable.id, params.data.channelId));
  if (!channel) {
    res.status(404).json({ error: "Channel not found" });
    return;
  }

  const [balances, movements] = await Promise.all([
    db
      .select({
        channelId: creatorBalancesTable.channelId,
        channelSlug: channelsTable.slug,
        channelDisplayName: channelsTable.displayName,
        creatorUsername: usersTable.username,
        currency: creatorBalancesTable.currency,
        pendingAmount: creatorBalancesTable.pendingAmount,
        availableAmount: creatorBalancesTable.availableAmount,
        heldAmount: creatorBalancesTable.heldAmount,
        updatedAt: creatorBalancesTable.updatedAt,
      })
      .from(creatorBalancesTable)
      .innerJoin(channelsTable, eq(creatorBalancesTable.channelId, channelsTable.id))
      .innerJoin(usersTable, eq(channelsTable.ownerUserId, usersTable.id))
      .where(eq(creatorBalancesTable.channelId, channel.channelId))
      .orderBy(desc(creatorBalancesTable.updatedAt)),
    db
      .select({
        id: creatorBalanceMovementsTable.id,
        currency: creatorBalanceMovementsTable.currency,
        movementType: creatorBalanceMovementsTable.movementType,
        availableDelta: creatorBalanceMovementsTable.availableDelta,
        heldDelta: creatorBalanceMovementsTable.heldDelta,
        pendingDelta: creatorBalanceMovementsTable.pendingDelta,
        sourceType: creatorBalanceMovementsTable.sourceType,
        createdAt: creatorBalanceMovementsTable.createdAt,
      })
      .from(creatorBalanceMovementsTable)
      .where(eq(creatorBalanceMovementsTable.channelId, channel.channelId))
      .orderBy(desc(creatorBalanceMovementsTable.createdAt))
      .limit(50),
  ]);

  res.json(GetAdminCreatorBalanceDetailResponse.parse({
    ...channel,
    balances: balances.map((balance) => ({
      ...balance,
      pendingAmount: toDecimalString(balance.pendingAmount),
      availableAmount: toDecimalString(balance.availableAmount),
      heldAmount: toDecimalString(balance.heldAmount),
      updatedAt: balance.updatedAt.toISOString(),
    })),
    movements: movements.map((movement) => ({
      ...movement,
      availableDelta: toDecimalString(movement.availableDelta),
      heldDelta: toDecimalString(movement.heldDelta),
      pendingDelta: toDecimalString(movement.pendingDelta),
      createdAt: movement.createdAt.toISOString(),
    })),
  }));
});

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
    getPlisioAssetSnapshots().catch((): Awaited<ReturnType<typeof getPlisioAssetSnapshots>> => []),
  ]);
  const snapshotByCurrency = new Map<KryvCryptoCode, Awaited<ReturnType<typeof getPlisioAssetSnapshots>>[number]>(snapshots.map((snapshot) => [snapshot.currency, snapshot] as const));

  res.json(GetAdminFinanceOverviewResponse.parse({
    assetLiabilities: liabilityRows.flatMap((row) => {
      if (!isSupportedKryvCryptoCode(row.currency)) return [];
      const snapshot = snapshotByCurrency.get(row.currency);
      return [{
        currency: row.currency,
        pendingAmount: row.pendingAmount,
        availableAmount: row.availableAmount,
        heldAmount: row.heldAmount,
        providerTreasuryBalance: snapshot?.treasuryBalance ?? null,
        priceUsd: snapshot?.priceUsd ?? null,
        rateUpdatedAt: snapshot?.fetchedAt ?? null,
      }];
    }),
    pendingProfileReviews: profileReview[0]?.count ?? 0,
    requestedPayouts: payoutReview[0]?.count ?? 0,
    ...flags,
    providerConfigured: isPlisioConfigured(),
  }));
});

router.get("/admin/finance/payout-profiles", requireOwner, async (req, res): Promise<void> => {
  const query = ListAdminPayoutProfilesQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }
  const currencyFilter = inArray(creatorPayoutProfilesTable.currency, supportedKryvCryptoCodes());
  const selectProfile = {
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
  };
  const [totalRows, rows] = await Promise.all([
    db.select({ total: count() }).from(creatorPayoutProfilesTable).where(currencyFilter),
    db.select(selectProfile)
      .from(creatorPayoutProfilesTable)
      .innerJoin(channelsTable, eq(creatorPayoutProfilesTable.channelId, channelsTable.id))
      .innerJoin(usersTable, eq(channelsTable.ownerUserId, usersTable.id))
      .where(currencyFilter)
      .orderBy(asc(creatorPayoutProfilesTable.reviewStatus), desc(creatorPayoutProfilesTable.updatedAt), desc(creatorPayoutProfilesTable.id))
      .limit(query.data.limit)
      .offset(query.data.offset),
  ]);
  res.json(ListAdminPayoutProfilesResponse.parse({
    items: rows.map(toAdminPayoutProfile),
    total: totalRows[0]?.total ?? 0,
    limit: query.data.limit,
    offset: query.data.offset,
  }));
});

router.post("/admin/finance/payout-profiles/:id/review", requireOwner, async (req, res): Promise<void> => {
  const params = ReviewAdminPayoutProfileParams.safeParse(req.params);
  const body = ReviewAdminPayoutProfileBody.safeParse(req.body);
  if (!params.success || !body.success) {
    res.status(400).json({ error: params.success ? body.error?.message ?? "Invalid request body" : params.error.message });
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

router.get("/admin/finance/payout-requests", requireOwner, async (req, res): Promise<void> => {
  const query = ListAdminPayoutRequestsQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }
  const currencyFilter = inArray(payoutRequestsTable.currency, supportedKryvCryptoCodes());
  const selectRequest = {
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
  };
  const [totalRows, rows] = await Promise.all([
    db.select({ total: count() }).from(payoutRequestsTable).where(currencyFilter),
    db.select(selectRequest)
      .from(payoutRequestsTable)
      .innerJoin(channelsTable, eq(payoutRequestsTable.channelId, channelsTable.id))
      .innerJoin(usersTable, eq(channelsTable.ownerUserId, usersTable.id))
      .where(currencyFilter)
      .orderBy(desc(payoutRequestsTable.requestedAt), desc(payoutRequestsTable.id))
      .limit(query.data.limit)
      .offset(query.data.offset),
  ]);
  res.json(ListAdminPayoutRequestsResponse.parse({
    items: rows.map(toAdminPayoutRequest),
    total: totalRows[0]?.total ?? 0,
    limit: query.data.limit,
    offset: query.data.offset,
  }));
});

router.post("/admin/finance/payout-requests/:id/review", requireOwner, async (req, res): Promise<void> => {
  const params = ReviewAdminPayoutRequestParams.safeParse(req.params);
  const body = ReviewAdminPayoutRequestBody.safeParse(req.body);
  if (!params.success || !body.success) {
    res.status(400).json({ error: params.success ? body.error?.message ?? "Invalid request body" : params.error.message });
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

  if (body.data.decision === "approved") {
    res.status(409).json({ error: "Provider withdrawal execution is hard-disabled. Keep this request held until the separately authorized production launch gate is complete." });
    return;
  }
  const nextStatus = body.data.decision === "held" ? "held" : "rejected";
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
    reason: body.data.reason ?? null,
    beforeState: toAdminPayoutRequest(before),
    afterState: toAdminPayoutRequest(after!),
  });
  res.json(ReviewAdminPayoutRequestResponse.parse(toAdminPayoutRequest(after!)));
});

router.get("/admin/ads/overview", requireOwner, async (_req, res): Promise<void> => {
  const [campaignRows, fundingRows, revenueRows] = await Promise.all([
    db.select().from(adCampaignsTable).orderBy(desc(adCampaignsTable.createdAt)).limit(24),
    db.select({
      pending: sql<number>`count(*) filter (where ${adCampaignFundingsTable.status} in ('creating', 'pending'))`.mapWith(Number),
      confirmed: sql<number>`count(*) filter (where ${adCampaignFundingsTable.status} = 'confirmed')`.mapWith(Number),
    }).from(adCampaignFundingsTable),
    db.select({
      currency: adRevenueMovementsTable.currency,
      grossAmount: sql<string>`coalesce(sum(${adRevenueMovementsTable.grossAmount}), 0)::text`,
      platformAmount: sql<string>`coalesce(sum(${adRevenueMovementsTable.platformAmount}), 0)::text`,
      creatorAmount: sql<string>`coalesce(sum(${adRevenueMovementsTable.creatorAmount}), 0)::text`,
    }).from(adRevenueMovementsTable).groupBy(adRevenueMovementsTable.currency),
  ]);
  res.json({
    campaigns: campaignRows.map(toAdminAdCampaign),
    pendingFundings: fundingRows[0]?.pending ?? 0,
    confirmedFundings: fundingRows[0]?.confirmed ?? 0,
    revenue: revenueRows.map((row) => ({ ...row, grossAmount: toDecimalString(row.grossAmount), platformAmount: toDecimalString(row.platformAmount), creatorAmount: toDecimalString(row.creatorAmount) })),
    deliveryEnabled: await isOperationalFeatureEnabled("ads_delivery"),
    policy: {
      paidDelivery: "Paid campaigns require a signed crypto funding confirmation, owner approval, an active rule, and an active creative.",
      promotion: "Free launch flights require owner approval, an explicit end time, an active rule, and an active creative.",
      creatorAllocation: "No creator ad revenue is credited unless a campaign has an explicit approved allocation and qualified delivery accounting.",
    },
  });
});

router.post("/admin/ads/campaigns", requireOwner, async (req, res): Promise<void> => {
  if (!await isOperationalFeatureEnabled("ads_delivery")) {
    res.status(409).json({ error: "Advertising campaign creation is unavailable while ad delivery is hard-disabled." });
    return;
  }
  const body = CreateAdminAdCampaignBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }
  const campaign = body.data;
  const [created] = await db.insert(adCampaignsTable).values({
    name: campaign.name,
    advertiserName: campaign.advertiserName ?? null,
    campaignType: campaign.fundingMode === "paid" ? "sponsored" : "house",
    status: "draft",
    fundingMode: campaign.fundingMode,
    fundingStatus: campaign.fundingMode === "paid" ? "unfunded" : "promotional_pending",
    budgetAmount: campaign.budgetUsd ?? null,
    budgetCurrency: campaign.budgetUsd ? "USD" : null,
    creatorShareBps: campaign.creatorShareBps,
    startsAt: campaign.startsAt ?? new Date(),
    endsAt: campaign.endsAt,
    createdByUserId: req.user!.userId,
  }).returning();
  await writeAuditLog(req, {
    action: "advertising_campaign.created",
    targetType: "ad_campaign",
    targetId: String(created.id),
    afterState: toAdminAdCampaign(created),
  });
  res.status(201).json(toAdminAdCampaign(created));
});

router.post("/admin/ads/campaigns/:id/funding-invoice", requireOwner, async (req, res): Promise<void> => {
  if (!await isOperationalFeatureEnabled("ads_delivery")) {
    res.status(409).json({ error: "Advertising funding invoices are unavailable while ad delivery is hard-disabled." });
    return;
  }
  const params = AdCampaignIdParams.safeParse(req.params);
  const body = CreateAdminAdFundingInvoiceBody.safeParse(req.body);
  if (!params.success || !body.success) {
    res.status(400).json({ error: params.success ? body.error?.message ?? "Invalid request body" : params.error.message });
    return;
  }
  if (!isPlisioConfigured()) {
    res.status(503).json({ error: "Crypto provider configuration is incomplete; a campaign funding invoice cannot be created." });
    return;
  }
  const [campaign] = await db.select().from(adCampaignsTable).where(eq(adCampaignsTable.id, params.data.id)).limit(1);
  if (!campaign) {
    res.status(404).json({ error: "Advertising campaign not found." });
    return;
  }
  if (campaign.fundingMode !== "paid" || !campaign.budgetAmount || ["funded", "invoice_pending"].includes(campaign.fundingStatus)) {
    res.status(409).json({ error: "A funding invoice is available only for an unfunded paid campaign with no active funding invoice." });
    return;
  }
  const orderNumber = `kryv_ad_campaign_${campaign.id}_${crypto.randomUUID()}`;
  try {
    const invoice = await createPlisioInvoice({
      orderNumber,
      orderName: `Kryv advertising · ${campaign.name}`,
      sourceAmountUsd: toDecimalString(campaign.budgetAmount),
      currency: body.data.cryptoCurrency as KryvCryptoCode | undefined,
      description: `Kryv advertiser campaign funding for ${campaign.name}`,
      successPath: "/admin?advertising=funding-confirmed",
      failurePath: "/admin?advertising=funding-cancelled",
    });
    const [funding] = await db.transaction(async (txn) => {
      const [created] = await txn.insert(adCampaignFundingsTable).values({
        campaignId: campaign.id,
        advertiserUserId: campaign.advertiserUserId,
        fundingType: "paid",
        provider: "plisio",
        providerPaymentId: invoice.transactionId,
        orderNumber,
        sourceAmount: toDecimalString(campaign.budgetAmount),
        sourceCurrency: "USD",
        selectedCurrency: invoice.selectedCurrency,
        invoiceAmount: invoice.invoiceAmount,
        invoiceCommission: invoice.invoiceCommission,
        invoiceTotal: invoice.invoiceTotal,
        status: "pending",
        expiresAt: invoice.expiresAt,
        idempotencyKey: `ad-funding:${orderNumber}`,
        metadata: { providerFeePaidBy: "client", campaignId: campaign.id },
      }).returning();
      await txn.update(adCampaignsTable).set({ fundingStatus: "invoice_pending", updatedAt: new Date() }).where(eq(adCampaignsTable.id, campaign.id));
      return [created];
    });
    await writeAuditLog(req, {
      action: "advertising_campaign.funding_invoice_created",
      targetType: "ad_campaign",
      targetId: String(campaign.id),
      afterState: { campaignId: campaign.id, fundingId: funding.id, orderNumber, selectedCurrency: invoice.selectedCurrency },
    });
    res.status(201).json({
      campaignId: campaign.id,
      fundingId: funding.id,
      paymentIntentId: funding.id,
      invoiceUrl: invoice.invoiceUrl,
      provider: "crypto",
      status: "pending",
      selectedCurrency: invoice.selectedCurrency,
      expiresAt: invoice.expiresAt,
      paymentAddress: invoice.paymentAddress,
      qrCodeDataUrl: invoice.qrCodeDataUrl,
      invoiceAmount: invoice.invoiceAmount,
      invoiceCommission: invoice.invoiceCommission,
      invoiceTotal: invoice.invoiceTotal,
      providerFeePaidBy: "client",
    });
  } catch (error) {
    res.status(502).json({ error: error instanceof Error ? error.message : "The crypto funding invoice could not be created." });
  }
});

router.post("/admin/ads/campaigns/:id/approve", requireOwner, async (req, res): Promise<void> => {
  if (!await isOperationalFeatureEnabled("ads_delivery")) {
    res.status(409).json({ error: "Advertising campaign approval is unavailable while ad delivery is hard-disabled." });
    return;
  }
  const params = AdCampaignIdParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [campaign] = await db.select().from(adCampaignsTable).where(eq(adCampaignsTable.id, params.data.id)).limit(1);
  if (!campaign) {
    res.status(404).json({ error: "Advertising campaign not found." });
    return;
  }
  if (!campaign.endsAt || campaign.endsAt <= new Date()) {
    res.status(409).json({ error: "An expired campaign cannot be approved for delivery." });
    return;
  }
  const approvedFundingStatus = campaign.fundingMode === "paid" ? "funded" : "promotional_approved";
  if (campaign.fundingMode === "paid" && campaign.fundingStatus !== "funded") {
    res.status(409).json({ error: "A paid campaign requires signed crypto funding confirmation before it can be approved." });
    return;
  }
  const [approved] = await db.update(adCampaignsTable).set({
    status: "active",
    fundingStatus: approvedFundingStatus,
    approvedByUserId: req.user!.userId,
    approvedAt: new Date(),
    updatedAt: new Date(),
  }).where(eq(adCampaignsTable.id, campaign.id)).returning();
  await writeAuditLog(req, {
    action: "advertising_campaign.approved",
    targetType: "ad_campaign",
    targetId: String(campaign.id),
    beforeState: toAdminAdCampaign(campaign),
    afterState: toAdminAdCampaign(approved),
  });
  res.json(toAdminAdCampaign(approved));
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
    res.status(400).json({ error: params.success ? body.error?.message ?? "Invalid request body" : params.error.message });
    return;
  }

  const key = params.data.key;
  if (!(key in OPERATIONAL_FLAG_COPY)) {
    res.status(404).json({ error: "Operational feature flag not found" });
    return;
  }

  if (body.data.enabled && HARD_DISABLED_OPERATIONAL_FLAGS.has(key)) {
    res.status(400).json({ error: `${key.replaceAll("_", " ")} is hard-disabled until its documented production launch gate is complete.` });
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

router.get("/admin/users", requireOwner, async (req, res): Promise<void> => {
  const parsed = ListAdminUsersQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { limit, offset } = parsed.data;
  const query = parsed.data.q?.trim();
  const where = query
    ? ilike(usersTable.username, literalIlikePattern(query))
    : undefined;
  const [rows, totals] = await Promise.all([
    (where ? db.select().from(usersTable).where(where) : db.select().from(usersTable))
      .orderBy(desc(usersTable.createdAt))
      .limit(limit)
      .offset(offset),
    where
      ? db.select({ total: sql<number>`count(*)`.mapWith(Number) }).from(usersTable).where(where)
      : db.select({ total: sql<number>`count(*)`.mapWith(Number) }).from(usersTable),
  ]);

  res.json(ListAdminUsersResponse.parse({
    items: rows,
    total: totals[0]?.total ?? 0,
    limit,
    offset,
  }));
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
      channels: await toChannelSummaries(channels),
    }));
  },
);

router.get(
  "/admin/channels",
  requireOwner,
  async (req, res): Promise<void> => {
    const parsed = ListAdminChannelsQueryParams.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }

    const { limit, offset } = parsed.data;
    const query = parsed.data.q?.trim();
    const where = query
      ? or(
          ilike(channelsTable.displayName, literalIlikePattern(query)),
          ilike(channelsTable.slug, literalIlikePattern(query)),
        )
      : undefined;
    const [rows, totals] = await Promise.all([
      (where ? db.select().from(channelsTable).where(where) : db.select().from(channelsTable))
        .orderBy(desc(channelsTable.createdAt))
        .limit(limit)
        .offset(offset),
      where
        ? db.select({ total: sql<number>`count(*)`.mapWith(Number) }).from(channelsTable).where(where)
        : db.select({ total: sql<number>`count(*)`.mapWith(Number) }).from(channelsTable),
    ]);
    const results = await toChannelSummaries(rows);
    res.json(ListAdminChannelsResponse.parse({
      items: results,
      total: totals[0]?.total ?? 0,
      limit,
      offset,
    }));
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

router.get("/admin/videos", requireOwner, async (req, res): Promise<void> => {
  const query = ListAdminVideosQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }
  const q = query.data.q?.trim();
  const filter = q
    ? ilike(videosTable.title, literalIlikePattern(q))
    : undefined;
  const [rows, countRows] = await Promise.all([
    db
      .select({
        video: videosTable,
        channel: {
          slug: channelsTable.slug,
          displayName: channelsTable.displayName,
          avatarUrl: channelsTable.avatarUrl,
        },
        categoryName: categoriesTable.name,
      })
      .from(videosTable)
      .innerJoin(channelsTable, eq(channelsTable.id, videosTable.channelId))
      .leftJoin(categoriesTable, eq(categoriesTable.id, videosTable.categoryId))
      .where(filter)
      .orderBy(desc(videosTable.createdAt), desc(videosTable.id))
      .limit(query.data.limit)
      .offset(query.data.offset),
    db.select({ count: sql<number>`count(*)`.mapWith(Number) }).from(videosTable).where(filter),
  ]);
  const items = rows.map(({ video, channel, categoryName }) => ({
    ...toVideoSummaryFromRelations(video, channel, categoryName),
    rightsAttestedAt: video.rightsAttestedAt?.toISOString() ?? null,
  }));
  res.json(ListAdminVideosResponse.parse({
    items,
    total: countRows[0]?.count ?? 0,
    limit: query.data.limit,
    offset: query.data.offset,
  }));
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
