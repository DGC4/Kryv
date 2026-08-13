import { Router, type IRouter } from "express";
import { and, desc, eq, sql } from "drizzle-orm";
import {
  channelsTable,
  creatorBalanceMovementsTable,
  creatorBalancesTable,
  creatorPayoutProfilesTable,
  db,
  featureFlagsTable,
  payoutRequestsTable,
  streamSessionsTable,
} from "@workspace/db";
import {
  CreateCreatorPayoutRequestBody,
  CreateCreatorPayoutRequestResponse,
  GetCreatorAchievementsResponse,
  GetCreatorFinanceResponse,
  SaveCreatorPayoutProfileBody,
  SaveCreatorPayoutProfileResponse,
} from "@workspace/api-zod";
import { getPlisioAssetSnapshots, isSupportedKryvCryptoCode } from "../lib/plisio";
import { requireAuth } from "../lib/auth";
import { writeAuditLog } from "../lib/operations";

const router: IRouter = Router();
const SUPPORTED_CURRENCIES = ["BTC", "LTC", "ETH", "DOGE"] as const;
const PAYOUT_REQUEST_FLAG = "creator_payout_requests";

type SupportedCurrency = (typeof SUPPORTED_CURRENCIES)[number];

class CreatorFinanceError extends Error {
  constructor(message: string, readonly status = 400) {
    super(message);
    this.name = "CreatorFinanceError";
  }
}

function toDecimalString(value: unknown) {
  return typeof value === "string" ? value : String(value ?? "0");
}

function referenceUsdValue(amount: unknown, priceUsd: string | undefined) {
  if (!priceUsd) return null;
  const value = Number(amount) * Number(priceUsd);
  return Number.isFinite(value) ? value.toFixed(2) : null;
}

function normalizeDestination(address: string) {
  const normalized = address.trim();
  if (normalized.length < 12 || normalized.length > 240 || /\s/.test(normalized)) {
    throw new CreatorFinanceError("Enter a valid payout address without spaces.");
  }
  return normalized;
}

function maskedDestination(address: string) {
  if (address.length <= 12) return "••••••••";
  return `${address.slice(0, 6)}••••••${address.slice(-6)}`;
}

function getPayoutEncryptionKey() {
  const configured = process.env.CREATOR_PAYOUT_ENCRYPTION_KEY?.trim();
  if (!configured) {
    throw new CreatorFinanceError("Creator payout profiles are not configured. Set CREATOR_PAYOUT_ENCRYPTION_KEY before saving a destination.", 503);
  }
  const key = Buffer.from(configured, "base64");
  if (key.length !== 32) {
    throw new CreatorFinanceError("CREATOR_PAYOUT_ENCRYPTION_KEY must be a base64-encoded 32-byte key.", 503);
  }
  return key;
}

function encryptDestination(address: string) {
  const key = getPayoutEncryptionKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(address, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return {
    addressCiphertext: ciphertext.toString("base64"),
    addressIv: iv.toString("base64"),
    addressAuthTag: authTag.toString("base64"),
    addressDigest: crypto.createHash("sha256").update(address).digest("hex"),
    addressMasked: maskedDestination(address),
  };
}

async function getCreatorChannel(userId: number) {
  const [channel] = await db
    .select({ id: channelsTable.id, ownerUserId: channelsTable.ownerUserId })
    .from(channelsTable)
    .where(eq(channelsTable.ownerUserId, userId))
    .limit(1);
  if (!channel) throw new CreatorFinanceError("Create a channel before opening Creator Wallet.", 403);
  return channel;
}

async function isFeatureEnabled(key: string) {
  const [flag] = await db
    .select({ enabled: featureFlagsTable.enabled })
    .from(featureFlagsTable)
    .where(eq(featureFlagsTable.key, key))
    .limit(1);
  return Boolean(flag?.enabled);
}

function toProfile(row: {
  id: number;
  currency: string;
  addressMasked: string;
  confirmationStatus: string;
  reviewStatus: string;
  confirmedAt: Date | null;
  updatedAt: Date;
}) {
  return {
    id: row.id,
    currency: row.currency as SupportedCurrency,
    addressMasked: row.addressMasked,
    confirmationStatus: row.confirmationStatus as "pending" | "confirmed" | "rejected",
    reviewStatus: row.reviewStatus as "pending" | "approved" | "rejected",
    confirmedAt: row.confirmedAt,
    updatedAt: row.updatedAt,
  };
}

function toPayoutRequest(row: {
  id: number;
  currency: string;
  amount: unknown;
  destinationMasked: string | null;
  requestSource: string;
  feeAmount: unknown;
  feeCurrency: string | null;
  usdReferenceAmount: unknown;
  status: string;
  riskHoldReason: string | null;
  requestedAt: Date;
  reviewedAt: Date | null;
  completedAt: Date | null;
  providerTransactionUrl: string | null;
}) {
  return {
    id: row.id,
    currency: row.currency as SupportedCurrency,
    amount: toDecimalString(row.amount),
    destinationMasked: row.destinationMasked,
    requestSource: row.requestSource === "scheduled" ? "scheduled" as const : "manual" as const,
    feeAmount: row.feeAmount === null ? null : toDecimalString(row.feeAmount),
    feeCurrency: row.feeCurrency,
    usdReferenceAmount: row.usdReferenceAmount === null ? null : toDecimalString(row.usdReferenceAmount),
    status: row.status,
    riskHoldReason: row.riskHoldReason,
    requestedAt: row.requestedAt,
    reviewedAt: row.reviewedAt,
    completedAt: row.completedAt,
    providerTransactionUrl: row.providerTransactionUrl,
  };
}

async function getAchievements(channelId: number, profiles: Array<{ reviewStatus: string }>) {
  const [streamStats] = await db
    .select({
      qualifyingBroadcasts: sql<number>`count(*) filter (where ${streamSessionsTable.durationSeconds} >= 900)`.mapWith(Number),
    })
    .from(streamSessionsTable)
    .where(eq(streamSessionsTable.channelId, channelId));
  const [held] = await db
    .select({ count: sql<number>`count(*)`.mapWith(Number) })
    .from(payoutRequestsTable)
    .where(and(eq(payoutRequestsTable.channelId, channelId), eq(payoutRequestsTable.status, "held")));

  const payoutProfileApproved = profiles.some((profile) => profile.reviewStatus === "approved");
  const qualifyingBroadcasts = streamStats?.qualifyingBroadcasts ?? 0;
  const noActiveHold = (held?.count ?? 0) === 0;

  return [
    {
      key: "channel_setup",
      title: "Channel setup",
      description: "Create your channel to unlock Creator Wallet setup.",
      currentValue: 1,
      targetValue: 1,
      completed: true,
      evidence: "Your channel is active.",
    },
    {
      key: "qualifying_broadcast",
      title: "First qualifying broadcast",
      description: "Complete one live session of at least 15 minutes.",
      currentValue: qualifyingBroadcasts,
      targetValue: 1,
      completed: qualifyingBroadcasts >= 1,
      evidence: qualifyingBroadcasts >= 1 ? "A qualifying broadcast is recorded." : "No qualifying completed broadcast is recorded yet.",
    },
    {
      key: "confirmed_destination",
      title: "Confirmed payout destination",
      description: "Save a supported crypto destination and complete owner review.",
      currentValue: payoutProfileApproved ? 1 : 0,
      targetValue: 1,
      completed: payoutProfileApproved,
      evidence: payoutProfileApproved ? "At least one payout destination is approved." : "A payout destination still needs owner review.",
    },
    {
      key: "clear_operational_review",
      title: "Clear operational review",
      description: "Keep your payout account free of unresolved payout holds.",
      currentValue: noActiveHold ? 1 : 0,
      targetValue: 1,
      completed: noActiveHold,
      evidence: noActiveHold ? "No active payout hold is recorded." : "Resolve the active payout hold before requesting a release.",
    },
  ];
}

router.use(requireAuth);

router.get("/creator/finance", async (req, res): Promise<void> => {
  try {
    const channel = await getCreatorChannel(req.user!.userId);
    const [balanceRows, profileRows, payoutRows] = await Promise.all([
      db.select().from(creatorBalancesTable).where(eq(creatorBalancesTable.channelId, channel.id)),
      db.select().from(creatorPayoutProfilesTable).where(eq(creatorPayoutProfilesTable.channelId, channel.id)),
      db.select().from(payoutRequestsTable).where(eq(payoutRequestsTable.channelId, channel.id)).orderBy(desc(payoutRequestsTable.requestedAt)).limit(12),
    ]);

    const profiles = profileRows.map(toProfile);
    const snapshots = await getPlisioAssetSnapshots().catch(() => []);
    const snapshotByCurrency = new Map(snapshots.map((snapshot) => [snapshot.currency, snapshot]));
    const achievements = await getAchievements(channel.id, profiles);
    const payload = {
      channelId: channel.id,
      balances: balanceRows
        .filter((balance) => isSupportedKryvCryptoCode(balance.currency))
        .map((balance) => {
          const snapshot = snapshotByCurrency.get(balance.currency);
          return {
            currency: balance.currency,
            pendingAmount: toDecimalString(balance.pendingAmount),
            availableAmount: toDecimalString(balance.availableAmount),
            heldAmount: toDecimalString(balance.heldAmount),
            usdReferenceValue: referenceUsdValue(balance.availableAmount, snapshot?.priceUsd),
            rateUpdatedAt: snapshot?.fetchedAt ?? null,
          };
        }),
      payoutProfiles: profiles,
      payoutPreference: {
        cadence: "manual" as const,
        minimumAmount: "0",
        weekday: null,
        monthDay: null,
        timezone: "UTC",
        enabled: false,
        nextRunAt: null,
        updatedAt: new Date(),
      },
      payoutRequests: payoutRows.filter((row) => isSupportedKryvCryptoCode(row.currency)).map(toPayoutRequest),
      achievements,
      payoutRequestsEnabled: await isFeatureEnabled(PAYOUT_REQUEST_FLAG),
      providerRateAvailable: snapshots.length > 0,
    };
    res.json(GetCreatorFinanceResponse.parse(payload));
  } catch (error) {
    const status = error instanceof CreatorFinanceError ? error.status : 500;
    res.status(status).json({ error: error instanceof Error ? error.message : "Creator finance could not be loaded" });
  }
});

router.get("/creator/achievements", async (req, res): Promise<void> => {
  try {
    const channel = await getCreatorChannel(req.user!.userId);
    const profiles = await db
      .select({ reviewStatus: creatorPayoutProfilesTable.reviewStatus })
      .from(creatorPayoutProfilesTable)
      .where(eq(creatorPayoutProfilesTable.channelId, channel.id));
    res.json(GetCreatorAchievementsResponse.parse(await getAchievements(channel.id, profiles)));
  } catch (error) {
    const status = error instanceof CreatorFinanceError ? error.status : 500;
    res.status(status).json({ error: error instanceof Error ? error.message : "Creator achievements could not be loaded" });
  }
});

router.post("/creator/finance/payout-profiles", async (req, res): Promise<void> => {
  const parsed = SaveCreatorPayoutProfileBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  try {
    const channel = await getCreatorChannel(req.user!.userId);
    const destination = normalizeDestination(parsed.data.address);
    const encrypted = encryptDestination(destination);
    const [profile] = await db
      .insert(creatorPayoutProfilesTable)
      .values({
        channelId: channel.id,
        currency: parsed.data.currency,
        ...encrypted,
        confirmationStatus: "pending",
        reviewStatus: "pending",
        confirmedAt: null,
        reviewedByUserId: null,
        reviewedAt: null,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [creatorPayoutProfilesTable.channelId, creatorPayoutProfilesTable.currency],
        set: {
          ...encrypted,
          confirmationStatus: "pending",
          reviewStatus: "pending",
          confirmedAt: null,
          reviewedByUserId: null,
          reviewedAt: null,
          updatedAt: new Date(),
        },
      })
      .returning();

    await writeAuditLog(req, {
      action: "creator_payout_profile.saved",
      targetType: "creator_payout_profile",
      targetId: String(profile.id),
      afterState: { channelId: channel.id, currency: profile.currency, addressMasked: profile.addressMasked, confirmationStatus: profile.confirmationStatus, reviewStatus: profile.reviewStatus },
    });
    res.json(SaveCreatorPayoutProfileResponse.parse(toProfile(profile)));
  } catch (error) {
    const status = error instanceof CreatorFinanceError ? error.status : 500;
    res.status(status).json({ error: error instanceof Error ? error.message : "Payout destination could not be saved" });
  }
});

router.post("/creator/finance/payout-requests", async (req, res): Promise<void> => {
  const parsed = CreateCreatorPayoutRequestBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  if (!await isFeatureEnabled(PAYOUT_REQUEST_FLAG)) {
    res.status(403).json({ error: "Creator payout requests are not enabled yet. Configure the payout control plane before accepting requests." });
    return;
  }

  try {
    const channel = await getCreatorChannel(req.user!.userId);
    const [profile] = await db
      .select()
      .from(creatorPayoutProfilesTable)
      .where(and(eq(creatorPayoutProfilesTable.channelId, channel.id), eq(creatorPayoutProfilesTable.currency, parsed.data.currency), eq(creatorPayoutProfilesTable.reviewStatus, "approved"), eq(creatorPayoutProfilesTable.confirmationStatus, "confirmed")))
      .limit(1);
    if (!profile) throw new CreatorFinanceError("Save a destination and wait for owner approval before requesting a payout.", 403);

    const achievements = await getAchievements(channel.id, [{ reviewStatus: profile.reviewStatus }]);
    if (!achievements.every((achievement) => achievement.completed)) {
      throw new CreatorFinanceError("Complete the Creator Payout Ready achievements before requesting a payout.", 403);
    }

    const amount = parsed.data.amount;
    const idempotencyKey = `creator-payout:${channel.id}:${crypto.randomUUID()}`;
    const payout = await db.transaction(async (txn) => {
      await txn.execute(sql`SELECT id FROM creator_balances WHERE channel_id = ${channel.id} AND currency = ${parsed.data.currency} FOR UPDATE`);
      const [balance] = await txn
        .select()
        .from(creatorBalancesTable)
        .where(and(eq(creatorBalancesTable.channelId, channel.id), eq(creatorBalancesTable.currency, parsed.data.currency)))
        .limit(1);
      if (!balance || Number(balance.availableAmount) < Number(amount)) {
        throw new CreatorFinanceError("The requested amount exceeds your available creator balance.");
      }

      const [created] = await txn
        .insert(payoutRequestsTable)
        .values({
          channelId: channel.id,
          requestedByUserId: req.user!.userId,
          currency: parsed.data.currency,
          amount,
          destinationReference: null,
          payoutProfileId: profile.id,
          destinationMasked: profile.addressMasked,
          requestSource: "manual",
          status: "requested",
          provider: "plisio",
          idempotencyKey,
        })
        .returning();

      await txn
        .update(creatorBalancesTable)
        .set({
          availableAmount: sql`${creatorBalancesTable.availableAmount} - ${amount}`,
          heldAmount: sql`${creatorBalancesTable.heldAmount} + ${amount}`,
          updatedAt: new Date(),
        })
        .where(eq(creatorBalancesTable.id, balance.id));
      await txn.insert(creatorBalanceMovementsTable).values({
        channelId: channel.id,
        currency: parsed.data.currency,
        movementType: "payout_reserved",
        availableDelta: `-${amount}`,
        heldDelta: amount,
        pendingDelta: "0",
        sourceType: "payout_request",
        sourceId: String(created.id),
        idempotencyKey: `movement:${idempotencyKey}`,
        metadata: { requestSource: "manual", destinationMasked: profile.addressMasked },
      });
      return created;
    });

    await writeAuditLog(req, {
      action: "creator_payout_request.created",
      targetType: "payout_request",
      targetId: String(payout.id),
      afterState: { channelId: channel.id, currency: payout.currency, amount: payout.amount, destinationMasked: payout.destinationMasked, status: payout.status },
    });
    res.status(201).json(CreateCreatorPayoutRequestResponse.parse(toPayoutRequest(payout)));
  } catch (error) {
    const status = error instanceof CreatorFinanceError ? error.status : 500;
    res.status(status).json({ error: error instanceof Error ? error.message : "Payout request could not be created" });
  }
});

export default router;
