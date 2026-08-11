import Stripe from "stripe";

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
const stripeWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

let client: Stripe | null = null;

export class StripeNotConfiguredError extends Error {
  constructor() {
    super("Stripe is not configured. Set STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET in the deployment environment.");
  }
}

function getStripe(): Stripe {
  if (!stripeSecretKey) throw new StripeNotConfiguredError();
  if (!client) client = new Stripe(stripeSecretKey);
  return client;
}

export function isStripeConfigured() {
  return Boolean(stripeSecretKey && stripeWebhookSecret);
}

/**
 * Creates a Stripe Connect Express account. Personal, business, and payout data
 * are collected only by Stripe's hosted onboarding and are never accepted by Kryv.
 */
export async function createStripeConnectedAccount(input: { country?: string; businessProfileUrl: string }) {
  const stripe = getStripe();
  return stripe.accounts.create({
    type: "express",
    ...(input.country ? { country: input.country } : {}),
    capabilities: {
      card_payments: { requested: true },
      transfers: { requested: true },
    },
    business_profile: { url: input.businessProfileUrl },
  });
}

/**
 * Account links are short-lived, single-use URLs. They must only be returned to
 * the authenticated creator who owns the account.
 */
export async function createStripeOnboardingLink(input: {
  accountId: string;
  refreshUrl: string;
  returnUrl: string;
}) {
  const stripe = getStripe();
  return stripe.accountLinks.create({
    account: input.accountId,
    refresh_url: input.refreshUrl,
    return_url: input.returnUrl,
    type: "account_onboarding",
  });
}

export function constructStripeWebhookEvent(rawBody: Buffer, signature: string | undefined) {
  if (!stripeWebhookSecret || !signature) throw new StripeNotConfiguredError();
  return getStripe().webhooks.constructEvent(rawBody, signature, stripeWebhookSecret);
}
