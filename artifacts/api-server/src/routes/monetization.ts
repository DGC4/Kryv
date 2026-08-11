import { Router, type IRouter } from "express";
import { and, eq } from "drizzle-orm";
import {
  CreateChannelMonetizationOnboardingLinkParams,
  GetChannelMonetizationStatusParams,
} from "@workspace/api-zod";
import { channelsTable, creatorPaymentAccountsTable, db } from "@workspace/db";
import { requireAuth } from "../lib/auth";
import {
  createStripeConnectedAccount,
  createStripeOnboardingLink,
  StripeNotConfiguredError,
} from "../lib/stripe";

const router: IRouter = Router();

function getAppUrl() {
  const appUrl = process.env.KRYV_APP_URL;
  if (!appUrl) throw new Error("KRYV_APP_URL must be configured before Stripe Connect onboarding is enabled.");
  const parsed = new URL(appUrl);
  if (process.env.NODE_ENV === "production" && parsed.protocol !== "https:") {
    throw new Error("KRYV_APP_URL must use HTTPS in production.");
  }
  return parsed.origin;
}

async function getOwnedChannel(channelId: number, userId: number) {
  const [channel] = await db.select().from(channelsTable).where(eq(channelsTable.id, channelId));
  if (!channel) return { channel: null, error: "Channel not found" };
  if (channel.ownerUserId !== userId) return { channel, error: "Only the channel owner can manage monetization." };
  return { channel, error: null };
}

router.get("/channels/:id/monetization/status", requireAuth, async (req, res): Promise<void> => {
  const params = GetChannelMonetizationStatusParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const owned = await getOwnedChannel(params.data.id, req.user!.userId);
  if (!owned.channel) {
    res.status(404).json({ error: owned.error });
    return;
  }
  if (owned.error) {
    res.status(403).json({ error: owned.error });
    return;
  }

  const [account] = await db
    .select()
    .from(creatorPaymentAccountsTable)
    .where(eq(creatorPaymentAccountsTable.channelId, owned.channel.id));

  res.json({
    provider: account?.provider ?? "stripe",
    onboardingStatus: account?.onboardingStatus ?? "not_started",
    chargesEnabled: account?.chargesEnabled ?? false,
    payoutsEnabled: account?.payoutsEnabled ?? false,
    detailsSubmitted: account?.detailsSubmitted ?? false,
    requirementsDue: Array.isArray(account?.requirementsDue) ? account.requirementsDue.filter((value): value is string => typeof value === "string") : [],
  });
});

router.post("/channels/:id/monetization/onboarding-link", requireAuth, async (req, res): Promise<void> => {
  const params = CreateChannelMonetizationOnboardingLinkParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const owned = await getOwnedChannel(params.data.id, req.user!.userId);
  if (!owned.channel) {
    res.status(404).json({ error: owned.error });
    return;
  }
  if (owned.error) {
    res.status(403).json({ error: owned.error });
    return;
  }

  try {
    const appUrl = getAppUrl();
    const [existing] = await db
      .select()
      .from(creatorPaymentAccountsTable)
      .where(and(eq(creatorPaymentAccountsTable.channelId, owned.channel.id), eq(creatorPaymentAccountsTable.provider, "stripe")));

    let account = existing;
    if (!account) {
      const stripeAccount = await createStripeConnectedAccount({
        businessProfileUrl: `${appUrl}/live/${owned.channel.slug}`,
      });
      const requirementsDue = stripeAccount.requirements?.currently_due ?? [];
      [account] = await db
        .insert(creatorPaymentAccountsTable)
        .values({
          channelId: owned.channel.id,
          provider: "stripe",
          providerAccountId: stripeAccount.id,
          onboardingStatus: "pending",
          chargesEnabled: stripeAccount.charges_enabled,
          payoutsEnabled: stripeAccount.payouts_enabled,
          detailsSubmitted: stripeAccount.details_submitted,
          country: stripeAccount.country ?? null,
          requirementsDue,
        })
        .returning();
    }

    const link = await createStripeOnboardingLink({
      accountId: account.providerAccountId,
      refreshUrl: `${appUrl}/dashboard/live?stripe=refresh`,
      returnUrl: `${appUrl}/dashboard/live?stripe=return`,
    });

    res.json({ url: link.url, onboardingStatus: account.onboardingStatus });
  } catch (error) {
    if (error instanceof StripeNotConfiguredError || (error instanceof Error && error.message.startsWith("KRYV_APP_URL"))) {
      res.status(503).json({ error: error.message });
      return;
    }
    console.error("Stripe Connect onboarding-link creation failed", error);
    res.status(502).json({ error: "Stripe could not create an onboarding link. Please try again." });
  }
});

export default router;
