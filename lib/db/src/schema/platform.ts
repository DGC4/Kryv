import {
  boolean,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { usersTable } from "./users";
import { channelsTable } from "./channels";
import { videosTable } from "./videos";

// ─── Viewer profiles and profile-scoped viewing state ─────────────────────────
export const viewerProfilesTable = pgTable("viewer_profiles", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  avatarUrl: text("avatar_url"),
  pinHash: text("pin_hash"),
  maturityLevel: text("maturity_level").notNull().default("standard"),
  isKidsProfile: boolean("is_kids_profile").notNull().default(false),
  isDefault: boolean("is_default").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  userProfileIdx: index("viewer_profiles_user_idx").on(table.userId, table.createdAt),
}));

export const profileWatchStatesTable = pgTable("profile_watch_states", {
  id: serial("id").primaryKey(),
  profileId: integer("profile_id").notNull().references(() => viewerProfilesTable.id, { onDelete: "cascade" }),
  videoId: integer("video_id").references(() => videosTable.id, { onDelete: "cascade" }),
  cinemaTitleId: integer("cinema_title_id"),
  progressSeconds: integer("progress_seconds").notNull().default(0),
  durationSeconds: integer("duration_seconds"),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  lastWatchedAt: timestamp("last_watched_at", { withTimezone: true }).notNull().defaultNow(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  profileRecentIdx: index("profile_watch_states_recent_idx").on(table.profileId, table.lastWatchedAt),
  profileVideoUnique: uniqueIndex("profile_watch_states_profile_video_unique").on(table.profileId, table.videoId),
}));

export const profileMyListTable = pgTable("profile_my_list", {
  id: serial("id").primaryKey(),
  profileId: integer("profile_id").notNull().references(() => viewerProfilesTable.id, { onDelete: "cascade" }),
  cinemaTitleId: integer("cinema_title_id").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  profileTitleUnique: uniqueIndex("profile_my_list_profile_title_unique").on(table.profileId, table.cinemaTitleId),
  profileCreatedIdx: index("profile_my_list_profile_created_idx").on(table.profileId, table.createdAt),
}));

// ─── Cinema catalog and FastPix media associations ─────────────────────────────
export const cinemaTitlesTable = pgTable("cinema_titles", {
  id: serial("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  title: text("title").notNull(),
  synopsis: text("synopsis"),
  releaseYear: integer("release_year"),
  runtimeSeconds: integer("runtime_seconds"),
  contentRating: text("content_rating"),
  maturityLevel: text("maturity_level").notNull().default("standard"),
  genres: jsonb("genres").notNull().default([]),
  castMembers: jsonb("cast_members").notNull().default([]),
  crew: jsonb("crew").notNull().default([]),
  posterUrl: text("poster_url"),
  backdropUrl: text("backdrop_url"),
  logoUrl: text("logo_url"),
  publishState: text("publish_state").notNull().default("draft"),
  editorialRank: integer("editorial_rank").notNull().default(0),
  adEligible: boolean("ad_eligible").notNull().default(false),
  createdByUserId: integer("created_by_user_id").references(() => usersTable.id, { onDelete: "set null" }),
  reviewedByUserId: integer("reviewed_by_user_id").references(() => usersTable.id, { onDelete: "set null" }),
  publishedAt: timestamp("published_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  publishedRankIdx: index("cinema_titles_published_rank_idx").on(table.publishState, table.editorialRank, table.publishedAt),
  createdIdx: index("cinema_titles_created_idx").on(table.createdAt),
}));

export const cinemaTitleAssetsTable = pgTable("cinema_title_assets", {
  id: serial("id").primaryKey(),
  cinemaTitleId: integer("cinema_title_id").notNull().references(() => cinemaTitlesTable.id, { onDelete: "cascade" }),
  assetKind: text("asset_kind").notNull(),
  fastpixMediaId: text("fastpix_media_id").unique(),
  fastpixPlaybackId: text("fastpix_playback_id"),
  fastpixUploadId: text("fastpix_upload_id"),
  processingStatus: text("processing_status").notNull().default("waiting"),
  processingError: text("processing_error"),
  sourceProvenance: text("source_provenance"),
  sourceChecksum: text("source_checksum"),
  language: text("language").notNull().default("en"),
  durationSeconds: integer("duration_seconds"),
  approvedAt: timestamp("approved_at", { withTimezone: true }),
  approvedByUserId: integer("approved_by_user_id").references(() => usersTable.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  titleAssetKindIdx: index("cinema_title_assets_title_kind_idx").on(table.cinemaTitleId, table.assetKind),
  processingIdx: index("cinema_title_assets_processing_idx").on(table.processingStatus, table.createdAt),
}));

export const cinemaRightsWindowsTable = pgTable("cinema_rights_windows", {
  id: serial("id").primaryKey(),
  cinemaTitleId: integer("cinema_title_id").notNull().references(() => cinemaTitlesTable.id, { onDelete: "cascade" }),
  territoryCodes: jsonb("territory_codes").notNull().default([]),
  entitlementType: text("entitlement_type").notNull().default("free"),
  rightsReference: text("rights_reference").notNull(),
  startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
  endsAt: timestamp("ends_at", { withTimezone: true }),
  createdByUserId: integer("created_by_user_id").references(() => usersTable.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  titleWindowIdx: index("cinema_rights_windows_title_start_idx").on(table.cinemaTitleId, table.startsAt),
}));

// ─── Creator access and reviewable moderation work ─────────────────────────────
export const channelRolesTable = pgTable("channel_roles", {
  id: serial("id").primaryKey(),
  channelId: integer("channel_id").notNull().references(() => channelsTable.id, { onDelete: "cascade" }),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  role: text("role").notNull().default("moderator"),
  permissions: jsonb("permissions").notNull().default({}),
  assignedByUserId: integer("assigned_by_user_id").references(() => usersTable.id, { onDelete: "set null" }),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  revokedByUserId: integer("revoked_by_user_id").references(() => usersTable.id, { onDelete: "set null" }),
  revocationReason: text("revocation_reason"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  channelUserRoleUnique: uniqueIndex("channel_roles_channel_user_unique").on(table.channelId, table.userId),
  channelActiveRoleIdx: index("channel_roles_channel_active_idx").on(table.channelId, table.revokedAt),
}));

export const moderationCasesTable = pgTable("moderation_cases", {
  id: serial("id").primaryKey(),
  channelId: integer("channel_id").references(() => channelsTable.id, { onDelete: "cascade" }),
  reporterUserId: integer("reporter_user_id").references(() => usersTable.id, { onDelete: "set null" }),
  subjectUserId: integer("subject_user_id").references(() => usersTable.id, { onDelete: "set null" }),
  caseType: text("case_type").notNull(),
  status: text("status").notNull().default("open"),
  summary: text("summary"),
  evidence: jsonb("evidence").notNull().default([]),
  assignedToUserId: integer("assigned_to_user_id").references(() => usersTable.id, { onDelete: "set null" }),
  resolution: text("resolution"),
  resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  statusCreatedIdx: index("moderation_cases_status_created_idx").on(table.status, table.createdAt),
  channelStatusIdx: index("moderation_cases_channel_status_idx").on(table.channelId, table.status),
}));

// ─── Consent, advertising inventory, and delivery measurement ─────────────────
export const consentPreferencesTable = pgTable("consent_preferences", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => usersTable.id, { onDelete: "cascade" }),
  purpose: text("purpose").notNull(),
  regionCode: text("region_code"),
  granted: boolean("granted").notNull().default(false),
  legalDocumentVersion: text("legal_document_version").notNull(),
  grantedAt: timestamp("granted_at", { withTimezone: true }),
  withdrawnAt: timestamp("withdrawn_at", { withTimezone: true }),
  source: text("source").notNull().default("web"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  userPurposeUnique: uniqueIndex("consent_preferences_user_purpose_unique").on(table.userId, table.purpose),
  purposeGrantedIdx: index("consent_preferences_purpose_granted_idx").on(table.purpose, table.granted),
}));

export const consentReceiptsTable = pgTable("consent_receipts", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => usersTable.id, { onDelete: "set null" }),
  purpose: text("purpose").notNull(),
  granted: boolean("granted").notNull(),
  regionCode: text("region_code"),
  legalDocumentVersion: text("legal_document_version").notNull(),
  source: text("source").notNull().default("web"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  userPurposeCreatedIdx: index("consent_receipts_user_purpose_created_idx").on(table.userId, table.purpose, table.createdAt),
}));

export const adCampaignsTable = pgTable("ad_campaigns", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  advertiserName: text("advertiser_name"),
  campaignType: text("campaign_type").notNull().default("house"),
  status: text("status").notNull().default("draft"),
  startsAt: timestamp("starts_at", { withTimezone: true }),
  endsAt: timestamp("ends_at", { withTimezone: true }),
  targeting: jsonb("targeting").notNull().default({}),
  frequencyPolicy: jsonb("frequency_policy").notNull().default({}),
  createdByUserId: integer("created_by_user_id").references(() => usersTable.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  statusWindowIdx: index("ad_campaigns_status_window_idx").on(table.status, table.startsAt, table.endsAt),
}));

export const adCreativesTable = pgTable("ad_creatives", {
  id: serial("id").primaryKey(),
  campaignId: integer("campaign_id").notNull().references(() => adCampaignsTable.id, { onDelete: "cascade" }),
  creativeType: text("creative_type").notNull(),
  label: text("label").notNull(),
  assetUrl: text("asset_url").notNull(),
  durationSeconds: integer("duration_seconds"),
  landingUrl: text("landing_url"),
  status: text("status").notNull().default("draft"),
  contentRating: text("content_rating"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  campaignStatusIdx: index("ad_creatives_campaign_status_idx").on(table.campaignId, table.status),
}));

export const adRulesTable = pgTable("ad_rules", {
  id: serial("id").primaryKey(),
  campaignId: integer("campaign_id").references(() => adCampaignsTable.id, { onDelete: "set null" }),
  name: text("name").notNull(),
  surface: text("surface").notNull(),
  status: text("status").notNull().default("draft"),
  preRollEnabled: boolean("pre_roll_enabled").notNull().default(false),
  midRollEnabled: boolean("mid_roll_enabled").notNull().default(false),
  postRollEnabled: boolean("post_roll_enabled").notNull().default(false),
  minMinutesBetweenBreaks: integer("min_minutes_between_breaks"),
  maxPodDurationSeconds: integer("max_pod_duration_seconds"),
  creatorCanDefer: boolean("creator_can_defer").notNull().default(false),
  creatorCanTrigger: boolean("creator_can_trigger").notNull().default(false),
  targeting: jsonb("targeting").notNull().default({}),
  createdByUserId: integer("created_by_user_id").references(() => usersTable.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  surfaceStatusIdx: index("ad_rules_surface_status_idx").on(table.surface, table.status),
  campaignStatusIdx: index("ad_rules_campaign_status_idx").on(table.campaignId, table.status),
}));

export const adBreaksTable = pgTable("ad_breaks", {
  id: serial("id").primaryKey(),
  adRuleId: integer("ad_rule_id").references(() => adRulesTable.id, { onDelete: "set null" }),
  channelId: integer("channel_id").references(() => channelsTable.id, { onDelete: "cascade" }),
  videoId: integer("video_id").references(() => videosTable.id, { onDelete: "cascade" }),
  cinemaTitleId: integer("cinema_title_id"),
  surface: text("surface").notNull(),
  triggerType: text("trigger_type").notNull(),
  status: text("status").notNull().default("scheduled"),
  scheduledAt: timestamp("scheduled_at", { withTimezone: true }),
  startedAt: timestamp("started_at", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  deferredUntil: timestamp("deferred_until", { withTimezone: true }),
  maxPodDurationSeconds: integer("max_pod_duration_seconds"),
  createdByUserId: integer("created_by_user_id").references(() => usersTable.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  surfaceStatusScheduleIdx: index("ad_breaks_surface_status_schedule_idx").on(table.surface, table.status, table.scheduledAt),
  channelCreatedIdx: index("ad_breaks_channel_created_idx").on(table.channelId, table.createdAt),
}));

export const adImpressionsTable = pgTable("ad_impressions", {
  id: serial("id").primaryKey(),
  adBreakId: integer("ad_break_id").notNull().references(() => adBreaksTable.id, { onDelete: "cascade" }),
  creativeId: integer("creative_id").references(() => adCreativesTable.id, { onDelete: "set null" }),
  userId: integer("user_id").references(() => usersTable.id, { onDelete: "set null" }),
  profileId: integer("profile_id").references(() => viewerProfilesTable.id, { onDelete: "set null" }),
  deliveryStatus: text("delivery_status").notNull().default("requested"),
  qualifiedAt: timestamp("qualified_at", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  failureReason: text("failure_reason"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  breakDeliveryIdx: index("ad_impressions_break_delivery_idx").on(table.adBreakId, table.deliveryStatus),
  userCreatedIdx: index("ad_impressions_user_created_idx").on(table.userId, table.createdAt),
}));

// ─── Provider-neutral payment ledger and owner operations ──────────────────────
export const paymentIntentsTable = pgTable("payment_intents", {
  id: serial("id").primaryKey(),
  orderNumber: text("order_number").notNull().unique(),
  purchaserUserId: integer("purchaser_user_id").references(() => usersTable.id, { onDelete: "set null" }),
  receiverChannelId: integer("receiver_channel_id").references(() => channelsTable.id, { onDelete: "set null" }),
  paymentKind: text("payment_kind").notNull(),
  provider: text("provider").notNull(),
  providerPaymentId: text("provider_payment_id").unique(),
  sourceAmount: numeric("source_amount", { precision: 18, scale: 8 }).notNull(),
  sourceCurrency: text("source_currency").notNull(),
  selectedCurrency: text("selected_currency"),
  status: text("status").notNull().default("created"),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  metadata: jsonb("metadata").notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  providerStatusIdx: index("payment_intents_provider_status_idx").on(table.provider, table.status, table.createdAt),
  receiverCreatedIdx: index("payment_intents_receiver_created_idx").on(table.receiverChannelId, table.createdAt),
}));

export const creatorBalancesTable = pgTable("creator_balances", {
  id: serial("id").primaryKey(),
  channelId: integer("channel_id").notNull().references(() => channelsTable.id, { onDelete: "cascade" }),
  currency: text("currency").notNull(),
  pendingAmount: numeric("pending_amount", { precision: 18, scale: 8 }).notNull().default("0"),
  availableAmount: numeric("available_amount", { precision: 18, scale: 8 }).notNull().default("0"),
  heldAmount: numeric("held_amount", { precision: 18, scale: 8 }).notNull().default("0"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  channelCurrencyUnique: uniqueIndex("creator_balances_channel_currency_unique").on(table.channelId, table.currency),
}));

export const creatorBalanceMovementsTable = pgTable("creator_balance_movements", {
  id: serial("id").primaryKey(),
  channelId: integer("channel_id").notNull().references(() => channelsTable.id, { onDelete: "cascade" }),
  currency: text("currency").notNull(),
  movementType: text("movement_type").notNull(),
  availableDelta: numeric("available_delta", { precision: 18, scale: 8 }).notNull().default("0"),
  heldDelta: numeric("held_delta", { precision: 18, scale: 8 }).notNull().default("0"),
  pendingDelta: numeric("pending_delta", { precision: 18, scale: 8 }).notNull().default("0"),
  sourceType: text("source_type").notNull(),
  sourceId: text("source_id").notNull(),
  idempotencyKey: text("idempotency_key").notNull().unique(),
  metadata: jsonb("metadata").notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  channelCreatedIdx: index("creator_balance_movements_channel_created_idx").on(table.channelId, table.createdAt),
  sourceIdx: index("creator_balance_movements_source_idx").on(table.sourceType, table.sourceId),
}));

export const creatorPayoutProfilesTable = pgTable("creator_payout_profiles", {
  id: serial("id").primaryKey(),
  channelId: integer("channel_id").notNull().references(() => channelsTable.id, { onDelete: "cascade" }),
  currency: text("currency").notNull(),
  addressCiphertext: text("address_ciphertext").notNull(),
  addressIv: text("address_iv").notNull(),
  addressAuthTag: text("address_auth_tag").notNull(),
  addressDigest: text("address_digest").notNull(),
  addressMasked: text("address_masked").notNull(),
  keyVersion: text("key_version").notNull().default("v1"),
  confirmationStatus: text("confirmation_status").notNull().default("pending"),
  confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
  reviewedByUserId: integer("reviewed_by_user_id").references(() => usersTable.id, { onDelete: "set null" }),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
  reviewStatus: text("review_status").notNull().default("pending"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  channelCurrencyUnique: uniqueIndex("creator_payout_profiles_channel_currency_unique").on(table.channelId, table.currency),
  reviewStatusIdx: index("creator_payout_profiles_review_status_idx").on(table.reviewStatus, table.updatedAt),
}));

export const creatorPayoutPreferencesTable = pgTable("creator_payout_preferences", {
  id: serial("id").primaryKey(),
  channelId: integer("channel_id").notNull().unique().references(() => channelsTable.id, { onDelete: "cascade" }),
  cadence: text("cadence").notNull().default("manual"),
  minimumAmount: numeric("minimum_amount", { precision: 18, scale: 8 }).notNull().default("0"),
  weekday: integer("weekday"),
  monthDay: integer("month_day"),
  timezone: text("timezone").notNull().default("UTC"),
  enabled: boolean("enabled").notNull().default(false),
  nextRunAt: timestamp("next_run_at", { withTimezone: true }),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const creatorFeePoliciesTable = pgTable("creator_fee_policies", {
  id: serial("id").primaryKey(),
  paymentKind: text("payment_kind").notNull(),
  platformFeeBps: integer("platform_fee_bps").notNull().default(0),
  payoutFeePayer: text("payout_fee_payer").notNull().default("creator"),
  status: text("status").notNull().default("draft"),
  version: integer("version").notNull().default(1),
  effectiveAt: timestamp("effective_at", { withTimezone: true }),
  updatedByUserId: integer("updated_by_user_id").references(() => usersTable.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  paymentKindVersionUnique: uniqueIndex("creator_fee_policies_kind_version_unique").on(table.paymentKind, table.version),
  paymentKindStatusIdx: index("creator_fee_policies_kind_status_idx").on(table.paymentKind, table.status, table.effectiveAt),
}));

export const payoutRequestsTable = pgTable("payout_requests", {
  id: serial("id").primaryKey(),
  channelId: integer("channel_id").notNull().references(() => channelsTable.id, { onDelete: "cascade" }),
  requestedByUserId: integer("requested_by_user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  currency: text("currency").notNull(),
  amount: numeric("amount", { precision: 18, scale: 8 }).notNull(),
  destinationReference: text("destination_reference"),
  payoutProfileId: integer("payout_profile_id").references(() => creatorPayoutProfilesTable.id, { onDelete: "set null" }),
  destinationMasked: text("destination_masked"),
  requestSource: text("request_source").notNull().default("manual"),
  feeAmount: numeric("fee_amount", { precision: 18, scale: 8 }),
  feeCurrency: text("fee_currency"),
  feeQuotedAt: timestamp("fee_quoted_at", { withTimezone: true }),
  usdReferenceAmount: numeric("usd_reference_amount", { precision: 18, scale: 8 }),
  usdReferenceRate: numeric("usd_reference_rate", { precision: 18, scale: 8 }),
  provider: text("provider"),
  providerPayoutId: text("provider_payout_id").unique(),
  providerTransactionUrl: text("provider_transaction_url"),
  idempotencyKey: text("idempotency_key").unique(),
  status: text("status").notNull().default("requested"),
  riskHoldReason: text("risk_hold_reason"),
  requestedAt: timestamp("requested_at", { withTimezone: true }).notNull().defaultNow(),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
}, (table) => ({
  channelStatusIdx: index("payout_requests_channel_status_idx").on(table.channelId, table.status, table.requestedAt),
}));

export const payoutApprovalsTable = pgTable("payout_approvals", {
  id: serial("id").primaryKey(),
  payoutRequestId: integer("payout_request_id").notNull().references(() => payoutRequestsTable.id, { onDelete: "cascade" }),
  reviewerUserId: integer("reviewer_user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  decision: text("decision").notNull(),
  reason: text("reason"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  payoutCreatedIdx: index("payout_approvals_payout_created_idx").on(table.payoutRequestId, table.createdAt),
}));

export const auditLogsTable = pgTable("audit_logs", {
  id: serial("id").primaryKey(),
  actorUserId: integer("actor_user_id").references(() => usersTable.id, { onDelete: "set null" }),
  action: text("action").notNull(),
  targetType: text("target_type").notNull(),
  targetId: text("target_id"),
  reason: text("reason"),
  beforeState: jsonb("before_state"),
  afterState: jsonb("after_state"),
  requestId: text("request_id"),
  sessionId: text("session_id"),
  ipHash: text("ip_hash"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  targetCreatedIdx: index("audit_logs_target_created_idx").on(table.targetType, table.targetId, table.createdAt),
  actorCreatedIdx: index("audit_logs_actor_created_idx").on(table.actorUserId, table.createdAt),
}));

export const featureFlagsTable = pgTable("feature_flags", {
  id: serial("id").primaryKey(),
  key: text("key").notNull().unique(),
  description: text("description"),
  enabled: boolean("enabled").notNull().default(false),
  rollout: jsonb("rollout").notNull().default({}),
  updatedByUserId: integer("updated_by_user_id").references(() => usersTable.id, { onDelete: "set null" }),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
