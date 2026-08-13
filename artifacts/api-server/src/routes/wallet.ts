import crypto from "node:crypto";
import { Router, type IRouter } from "express";
import { and, desc, eq } from "drizzle-orm";
import {
  customerWalletBalancesTable,
  customerWalletDepositAddressesTable,
  customerWalletMovementsTable,
  db,
  featureFlagsTable,
} from "@workspace/db";
import {
  CreateCustomerWalletDepositAddressBody,
  CreateCustomerWalletDepositAddressResponse,
  GetCustomerWalletResponse,
} from "@workspace/api-zod";
import {
  createPlisioDepositAddress,
  getPlisioAssetSnapshots,
  isPlisioConfigured,
  isSupportedKryvCryptoCode,
  PlisioNotConfiguredError,
} from "../lib/plisio";
import { requireAuth } from "../lib/auth";
import { writeAuditLog } from "../lib/operations";

const router: IRouter = Router();
const CUSTOMER_WALLET_FLAG = "customer_wallet_custody";
// Customer deposit custody is hard-disabled at runtime and unavailable through this service.
const CUSTOMER_WALLET_RUNTIME_ENABLED = false;

class CustomerWalletError extends Error {
  constructor(message: string, readonly status = 400) {
    super(message);
    this.name = "CustomerWalletError";
  }
}

function decimal(value: unknown) {
  return typeof value === "string" ? value : String(value ?? "0");
}

function referenceUsdValue(amount: unknown, priceUsd: string | undefined) {
  if (!priceUsd) return null;
  const value = Number(amount) * Number(priceUsd);
  return Number.isFinite(value) ? value.toFixed(2) : null;
}

function providerDepositUid(userId: number) {
  return `kryv-user-${userId}`;
}

async function isWalletCustodyEnabled() {
  if (!CUSTOMER_WALLET_RUNTIME_ENABLED) return false;
  const [flag] = await db
    .select({ enabled: featureFlagsTable.enabled })
    .from(featureFlagsTable)
    .where(eq(featureFlagsTable.key, CUSTOMER_WALLET_FLAG))
    .limit(1);
  return Boolean(flag?.enabled);
}

function toDepositAddress(row: {
  currency: string;
  depositAddress: string;
  status: string;
  createdAt: Date;
}) {
  return {
    currency: row.currency,
    address: row.depositAddress,
    status: row.status === "disabled" ? "disabled" as const : "active" as const,
    createdAt: row.createdAt,
  };
}

router.use(requireAuth);

router.get("/wallet", async (req, res): Promise<void> => {
  try {
    const [balances, addresses, movements, snapshots, depositsEnabled] = await Promise.all([
      db.select().from(customerWalletBalancesTable).where(eq(customerWalletBalancesTable.userId, req.user!.userId)),
      db.select().from(customerWalletDepositAddressesTable).where(eq(customerWalletDepositAddressesTable.userId, req.user!.userId)),
      db.select().from(customerWalletMovementsTable).where(eq(customerWalletMovementsTable.userId, req.user!.userId)).orderBy(desc(customerWalletMovementsTable.createdAt)).limit(30),
      getPlisioAssetSnapshots().catch(() => []),
      isWalletCustodyEnabled(),
    ]);
    const snapshotByCurrency = new Map(snapshots.map((snapshot) => [snapshot.currency, snapshot]));
    const payload = {
      balances: balances
        .filter((balance) => isSupportedKryvCryptoCode(balance.currency))
        .map((balance) => {
          const snapshot = snapshotByCurrency.get(balance.currency);
          return {
            currency: balance.currency,
            pendingAmount: decimal(balance.pendingAmount),
            availableAmount: decimal(balance.availableAmount),
            heldAmount: decimal(balance.heldAmount),
            usdReferenceValue: referenceUsdValue(balance.availableAmount, snapshot?.priceUsd),
            rateUpdatedAt: snapshot?.fetchedAt ?? null,
          };
        }),
      depositAddresses: addresses
        .filter((address) => isSupportedKryvCryptoCode(address.currency))
        .map(toDepositAddress),
      movements: movements
        .filter((movement) => isSupportedKryvCryptoCode(movement.currency))
        .map((movement) => ({
          id: movement.id,
          currency: movement.currency,
          movementType: movement.movementType,
          availableDelta: decimal(movement.availableDelta),
          heldDelta: decimal(movement.heldDelta),
          pendingDelta: decimal(movement.pendingDelta),
          createdAt: movement.createdAt,
        })),
      depositsEnabled,
      providerRateAvailable: snapshots.length > 0,
    };
    res.json(GetCustomerWalletResponse.parse(payload));
  } catch (error) {
    const status = error instanceof CustomerWalletError ? error.status : 500;
    res.status(status).json({ error: error instanceof Error ? error.message : "Customer wallet could not be loaded" });
  }
});

router.post("/wallet/deposit-addresses", async (req, res): Promise<void> => {
  const parsed = CreateCustomerWalletDepositAddressBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  if (!await isWalletCustodyEnabled()) {
    res.status(403).json({ error: "Customer wallet deposits are not enabled yet. Complete provider callback and reconciliation activation before exposing deposit addresses." });
    return;
  }
  if (!isPlisioConfigured()) {
    res.status(503).json({ error: "Crypto deposits are not configured in the production environment." });
    return;
  }

  try {
    const currency = parsed.data.currency;
    const [existing] = await db
      .select()
      .from(customerWalletDepositAddressesTable)
      .where(and(
        eq(customerWalletDepositAddressesTable.userId, req.user!.userId),
        eq(customerWalletDepositAddressesTable.currency, currency),
        eq(customerWalletDepositAddressesTable.provider, "plisio"),
      ))
      .limit(1);
    if (existing) {
      res.status(201).json(CreateCustomerWalletDepositAddressResponse.parse(toDepositAddress(existing)));
      return;
    }

    const providerAddress = await createPlisioDepositAddress({
      uid: providerDepositUid(req.user!.userId),
      currency,
    });
    const [created] = await db
      .insert(customerWalletDepositAddressesTable)
      .values({
        userId: req.user!.userId,
        currency: providerAddress.currency,
        provider: "plisio",
        providerDepositUid: providerAddress.uid,
        depositAddress: providerAddress.address,
        status: "active",
      })
      .onConflictDoNothing()
      .returning();
    const record = created ?? (await db
      .select()
      .from(customerWalletDepositAddressesTable)
      .where(and(
        eq(customerWalletDepositAddressesTable.userId, req.user!.userId),
        eq(customerWalletDepositAddressesTable.currency, currency),
        eq(customerWalletDepositAddressesTable.provider, "plisio"),
      ))
      .limit(1))[0];
    if (!record) throw new CustomerWalletError("Kryv could not persist the customer deposit address.", 500);

    await writeAuditLog(req, {
      action: "customer_wallet_deposit_address.created",
      targetType: "customer_wallet_deposit_address",
      targetId: String(record.id),
      afterState: { userId: req.user!.userId, currency: record.currency, status: record.status, addressFingerprint: crypto.createHash("sha256").update(record.depositAddress).digest("hex") },
    });
    res.status(201).json(CreateCustomerWalletDepositAddressResponse.parse(toDepositAddress(record)));
  } catch (error) {
    const status = error instanceof CustomerWalletError ? error.status : error instanceof PlisioNotConfiguredError ? 503 : 502;
    res.status(status).json({ error: error instanceof Error ? error.message : "Kryv could not create the customer deposit address" });
  }
});

export default router;
