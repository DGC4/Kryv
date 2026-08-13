#!/usr/bin/env node

/**
 * Read-only Kryv deployment gate.
 *
 * This intentionally never creates an invoice, writes to a database, or calls a
 * withdrawal provider. It proves only what the public health contract can prove.
 * Stronger topology requirements are opt-in gates because the current production
 * deployment intentionally operates in free-tier fallback mode.
 */
const baseUrl = (process.env.KRYV_PRODUCTION_URL || 'https://kryv-backend.onrender.com').replace(/\/$/, '');
const expectedWithdrawals = process.env.EXPECT_PROVIDER_WITHDRAWALS ?? 'false';
const requireDurableTopology = process.env.REQUIRE_DURABLE_TOPOLOGY === 'true';

function fail(message) {
  console.error(`READINESS FAILED: ${message}`);
  process.exitCode = 1;
}

try {
  const response = await fetch(`${baseUrl}/health`, {
    headers: { accept: 'application/json', 'cache-control': 'no-cache' },
    signal: AbortSignal.timeout(60_000),
  });
  if (!response.ok) {
    fail(`health endpoint returned HTTP ${response.status}`);
  } else {
    const health = await response.json();
    if (health?.status !== 'ok') fail(`health status is ${String(health?.status)}`);

    const withdrawalsEnabled = Boolean(health?.capabilities?.providerWithdrawalsRuntimeEnabled);
    if (String(withdrawalsEnabled) !== expectedWithdrawals) {
      fail(`provider withdrawal runtime is ${withdrawalsEnabled}; expected ${expectedWithdrawals}`);
    }

    const mode = health?.mode ?? 'unknown';
    if (requireDurableTopology && mode === 'free-tier-fallback') {
      fail('durable topology required but deployment reports free-tier fallback mode');
    }

    console.log(JSON.stringify({
      status: health?.status,
      mode,
      providerWithdrawalsRuntimeEnabled: withdrawalsEnabled,
      durableTopologyRequired: requireDurableTopology,
      result: process.exitCode ? 'failed' : 'passed',
    }, null, 2));

    if (mode === 'free-tier-fallback') {
      console.warn('OPERATING GATE: free-tier fallback is active; this does not prove Redis, queue, worker, stable egress, or always-on webhook delivery.');
    }
  }
} catch (error) {
  fail(error instanceof Error ? error.message : 'Unknown health verification failure');
}
