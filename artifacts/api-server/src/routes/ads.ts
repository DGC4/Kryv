import { Router, type IRouter } from "express";
import { and, desc, eq, gte, sql } from "drizzle-orm";
import {
  adBreaksTable,
  adCampaignsTable,
  adCreativesTable,
  adImpressionsTable,
  adRulesTable,
  channelsTable,
  consentPreferencesTable,
  db,
  featureFlagsTable,
  viewerProfilesTable,
} from "@workspace/db";
import {
  CreateChannelAdBreakBody,
  CreateChannelAdBreakParams,
  CreateChannelAdBreakResponse,
  GetAdDecisionQueryParams,
  GetAdDecisionResponse,
} from "@workspace/api-zod";
import { requireAuth } from "../lib/auth";

const router: IRouter = Router();

// Ad delivery is hard-disabled at runtime. Consent, review, measurement, and operator controls
// do not make this capability available through the current product.
const AD_DELIVERY_RUNTIME_ENABLED = false;

type AdSurface = "live" | "watch" | "cinema" | "clip";

function noDecision(reason: string) {
  return GetAdDecisionResponse.parse({ eligible: false, reason, adBreak: null, creative: null });
}

type FrequencyPolicy = {
  maxImpressionsPerViewer: number;
  windowMinutes: number;
};

function parseFrequencyPolicy(value: unknown): FrequencyPolicy | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const candidate = value as Record<string, unknown>;
  const maxImpressionsPerViewer = candidate.maxImpressionsPerViewer;
  const windowMinutes = candidate.windowMinutes;
  if (
    !Number.isInteger(maxImpressionsPerViewer) ||
    !Number.isInteger(windowMinutes) ||
    (maxImpressionsPerViewer as number) < 1 ||
    (maxImpressionsPerViewer as number) > 1000 ||
    (windowMinutes as number) < 1 ||
    (windowMinutes as number) > 43_200
  ) {
    return null;
  }
  return {
    maxImpressionsPerViewer: maxImpressionsPerViewer as number,
    windowMinutes: windowMinutes as number,
  };
}

function toAdBreak(row: typeof adBreaksTable.$inferSelect) {
  return {
    id: row.id,
    surface: row.surface as AdSurface,
    triggerType: row.triggerType as "scheduled" | "creator" | "system",
    status: row.status as "scheduled" | "serving" | "completed" | "deferred" | "cancelled",
    scheduledAt: row.scheduledAt,
    maxPodDurationSeconds: row.maxPodDurationSeconds,
  };
}

async function adDeliveryEnabled() {
  if (!AD_DELIVERY_RUNTIME_ENABLED) return false;
  const [flag] = await db.select({ enabled: featureFlagsTable.enabled }).from(featureFlagsTable).where(eq(featureFlagsTable.key, "ads_delivery")).limit(1);
  return Boolean(flag?.enabled);
}

router.get("/ads/decision", async (req, res): Promise<void> => {
  const parsed = GetAdDecisionQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  if (!(await adDeliveryEnabled())) {
    res.json(noDecision("ads_delivery_disabled"));
    return;
  }

  const { surface, channelId, videoId, profileId } = parsed.data;
  const userId = req.user?.userId;
  if (profileId !== undefined) {
    if (!userId) {
      res.json(noDecision("profile_authentication_required"));
      return;
    }
    if (!req.activeProfileId || req.activeProfileId !== profileId) {
      // The client profile ID is only request context. A future profile-aware
      // decision must be bound to the short-lived HttpOnly selection grant.
      res.json(noDecision("active_profile_grant_required"));
      return;
    }
    const [profile] = await db.select({ id: viewerProfilesTable.id }).from(viewerProfilesTable).where(and(eq(viewerProfilesTable.id, profileId), eq(viewerProfilesTable.userId, userId))).limit(1);
    if (!profile) {
      res.json(noDecision("profile_not_authorized"));
      return;
    }
  }

  // No consent means the service must not make a personalized or measurable ad decision.
  // Contextual ad delivery is unavailable because ad delivery is hard-disabled at runtime.
  if (userId) {
    const [consent] = await db
      .select({ granted: consentPreferencesTable.granted })
      .from(consentPreferencesTable)
      .where(and(eq(consentPreferencesTable.userId, userId), eq(consentPreferencesTable.purpose, "ads_personalization")))
      .limit(1);
    if (!consent?.granted) {
      res.json(noDecision("ads_consent_required"));
      return;
    }
  }

  const now = new Date();
  const [adBreak] = await db
    .select()
    .from(adBreaksTable)
    .where(and(eq(adBreaksTable.surface, surface), eq(adBreaksTable.status, "scheduled"), gte(adBreaksTable.scheduledAt, new Date(now.getTime() - 60_000))))
    .orderBy(adBreaksTable.scheduledAt)
    .limit(1);
  if (!adBreak) {
    res.json(noDecision("no_eligible_ad_break"));
    return;
  }

  const [rule] = await db.select().from(adRulesTable).where(eq(adRulesTable.id, adBreak.adRuleId ?? 0)).limit(1);
  if (!rule || rule.status !== "active") {
    res.json(noDecision("ad_rule_not_active"));
    return;
  }

  // A rule must explicitly reference an owner-approved campaign. This prevents an
  // arbitrary creative, an unfunded paid campaign, or an expired launch flight from
  // being served merely because a creative happens to be active.
  if (!rule.campaignId) {
    res.json(noDecision("ad_rule_has_no_campaign"));
    return;
  }
  const [campaign] = await db
    .select({
      id: adCampaignsTable.id,
      status: adCampaignsTable.status,
      fundingMode: adCampaignsTable.fundingMode,
      fundingStatus: adCampaignsTable.fundingStatus,
      startsAt: adCampaignsTable.startsAt,
      endsAt: adCampaignsTable.endsAt,
      frequencyPolicy: adCampaignsTable.frequencyPolicy,
    })
    .from(adCampaignsTable)
    .where(eq(adCampaignsTable.id, rule.campaignId))
    .limit(1);
  if (!campaign || campaign.status !== "active") {
    res.json(noDecision("ad_campaign_not_active"));
    return;
  }
  if (campaign.startsAt && campaign.startsAt > now || campaign.endsAt && campaign.endsAt <= now) {
    res.json(noDecision("ad_campaign_outside_delivery_window"));
    return;
  }
  if (campaign.fundingMode === "paid" && campaign.fundingStatus !== "funded") {
    res.json(noDecision("ad_campaign_funding_not_confirmed"));
    return;
  }
  if (campaign.fundingMode === "promotional" && campaign.fundingStatus !== "promotional_approved") {
    res.json(noDecision("ad_campaign_promotion_not_approved"));
    return;
  }

  // Future delivery is fail-closed: campaigns need an explicit bounded policy.
  // Only qualified/completed impressions count toward a viewer's cap.
  const frequencyPolicy = parseFrequencyPolicy(campaign.frequencyPolicy);
  if (!frequencyPolicy) {
    res.json(noDecision("frequency_policy_required"));
    return;
  }
  if (!userId) {
    res.json(noDecision("viewer_identity_required_for_frequency_cap"));
    return;
  }
  const frequencyCutoff = new Date(
    now.getTime() - frequencyPolicy.windowMinutes * 60_000,
  );
  const viewerScope =
    profileId !== undefined
      ? eq(adImpressionsTable.profileId, profileId)
      : eq(adImpressionsTable.userId, userId);
  const [frequency] = await db
    .select({ count: sql<number>`COALESCE(COUNT(*), 0)::int` })
    .from(adImpressionsTable)
    .innerJoin(adBreaksTable, eq(adImpressionsTable.adBreakId, adBreaksTable.id))
    .innerJoin(adRulesTable, eq(adBreaksTable.adRuleId, adRulesTable.id))
    .where(
      and(
        eq(adRulesTable.campaignId, campaign.id),
        viewerScope,
        gte(adImpressionsTable.createdAt, frequencyCutoff),
        sql`${adImpressionsTable.deliveryStatus} IN ('qualified', 'completed')`,
      ),
    );
  if (
    Number(frequency?.count ?? 0) >=
    frequencyPolicy.maxImpressionsPerViewer
  ) {
    res.json(noDecision("frequency_cap_reached"));
    return;
  }

  const [creative] = await db
    .select({ id: adCreativesTable.id, label: adCreativesTable.label, creativeType: adCreativesTable.creativeType, assetUrl: adCreativesTable.assetUrl, durationSeconds: adCreativesTable.durationSeconds, landingUrl: adCreativesTable.landingUrl })
    .from(adCreativesTable)
    .where(and(eq(adCreativesTable.status, "active"), eq(adCreativesTable.campaignId, rule.campaignId)))
    .limit(1);
  if (!creative || channelId === undefined && videoId === undefined && surface !== "cinema") {
    res.json(noDecision("no_policy_matched_creative"));
    return;
  }

  res.json(GetAdDecisionResponse.parse({ eligible: true, reason: "eligible_context", adBreak: toAdBreak(adBreak), creative }));
});

router.post("/channels/:id/ad-breaks", requireAuth, async (req, res): Promise<void> => {
  const params = CreateChannelAdBreakParams.safeParse(req.params);
  const parsed = CreateChannelAdBreakBody.safeParse(req.body);
  if (!params.success || !parsed.success) {
    res.status(400).json({ error: !params.success ? params.error.message : parsed.error?.message ?? "Invalid request body" });
    return;
  }
  if (!(await adDeliveryEnabled())) {
    res.status(403).json({ error: "Advertising delivery is disabled by platform policy." });
    return;
  }

  const [channel] = await db.select().from(channelsTable).where(eq(channelsTable.id, params.data.id)).limit(1);
  if (!channel) {
    res.status(404).json({ error: "Channel not found" });
    return;
  }
  if (channel.ownerUserId !== req.user!.userId) {
    res.status(403).json({ error: "Only the channel owner can control ad breaks." });
    return;
  }

  const [rule] = await db
    .select()
    .from(adRulesTable)
    .where(and(eq(adRulesTable.surface, "live"), eq(adRulesTable.status, "active")))
    .orderBy(desc(adRulesTable.updatedAt))
    .limit(1);
  if (!rule) {
    res.status(403).json({ error: "No active live advertising rule is available for this channel." });
    return;
  }

  if (parsed.data.action === "defer") {
    if (!rule.creatorCanDefer) {
      res.status(403).json({ error: "This ad policy does not allow creator deferrals." });
      return;
    }
    const [existing] = await db
      .select()
      .from(adBreaksTable)
      .where(and(eq(adBreaksTable.channelId, channel.id), eq(adBreaksTable.surface, "live"), eq(adBreaksTable.status, "scheduled")))
      .orderBy(adBreaksTable.scheduledAt)
      .limit(1);
    if (!existing) {
      res.status(400).json({ error: "There is no scheduled ad opportunity to defer." });
      return;
    }
    const deferredUntil = new Date(Date.now() + Math.max(60, rule.minMinutesBetweenBreaks ?? 5) * 60_000);
    const [deferred] = await db.update(adBreaksTable).set({ status: "deferred", deferredUntil }).where(eq(adBreaksTable.id, existing.id)).returning();
    res.status(201).json(CreateChannelAdBreakResponse.parse(toAdBreak(deferred)));
    return;
  }

  if (parsed.data.action === "trigger" && !rule.creatorCanTrigger) {
    res.status(403).json({ error: "This ad policy does not allow creator-triggered breaks." });
    return;
  }
  if (parsed.data.action === "schedule" && !parsed.data.scheduledAt) {
    res.status(400).json({ error: "A scheduledAt timestamp is required when scheduling an ad opportunity." });
    return;
  }

  const [adBreak] = await db
    .insert(adBreaksTable)
    .values({
      adRuleId: rule.id,
      channelId: channel.id,
      surface: "live",
      triggerType: parsed.data.action === "trigger" ? "creator" : "scheduled",
      status: "scheduled",
      scheduledAt: parsed.data.action === "trigger" ? new Date() : parsed.data.scheduledAt!,
      maxPodDurationSeconds: rule.maxPodDurationSeconds,
      createdByUserId: req.user!.userId,
    })
    .returning();

  res.status(201).json(CreateChannelAdBreakResponse.parse(toAdBreak(adBreak)));
});

export default router;
