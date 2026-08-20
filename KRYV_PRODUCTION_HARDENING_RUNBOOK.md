# Kryv Production Hardening Runbook

**Status:** Active implementation runbook
**Owner:** Platform owner and designated operations staff
**Scope:** Kryv application services, Render deployment configuration, and the connected Neon production database.

> **Purpose.** This document is the operational companion to the repository and Neon assessment. It defines the required order for deploying the identity hardening work, verifies that financial and custody controls remain safely disabled, and records the minimum evidence required for production changes.

## 1. Current security posture

The application now uses an **opaque, server-revocable browser session** rather than a script-readable, long-lived access token. The raw session value exists only in an `HttpOnly`, secure production cookie. The database stores a one-way digest, expiration time, revocation state, and session version. Roles are resolved from explicit platform grants at request time; a username cannot create owner authority.

| Control               | Required state                                                 | Verification evidence                                                                         |
| --------------------- | -------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| Owner authority       | Explicit active `platform_roles` grant only                    | Owner-only route returns success only for the approved account                                |
| Browser session       | Secure cookie, no local-storage access token                   | Browser storage has no `kryv-auth` token; authenticated `/api/me` succeeds                    |
| Session invalidation  | Per-session revoke and account-wide version invalidation       | Logout invalidates the presented session; ban/role recovery invalidates all sessions          |
| Cross-site protection | Cookie-authenticated state changes accept trusted origins only | Unsafe request from an untrusted origin receives `403`                                        |
| CORS                  | Exact production origins configured                            | `ALLOWED_ORIGINS` and `KRYV_APP_URL` contain the deployed UI origins only                     |
| Debug exposure        | Disabled by default in production                              | `/api/debug/paths` returns `404` unless deliberately enabled for an incident                  |
| Visitor telemetry     | Disabled by default; hashed and navigation-only when enabled   | `KRYV_ACTIVITY_TRACKING_ENABLED=false` unless a documented privacy review approves activation |

## 2. Deployment sequence

Deploy in the listed order. Do not turn on payment, custody, scheduled payout, or ad-delivery controls as part of an application deployment.

1. **Confirm the Neon schema change.** The production database must contain the identity session controls introduced by migration `0020_identity_and_session_hardening.sql`.
2. **Configure the Render environment group.** Set exact public UI origins, secure provider secrets, a seven-day session duration (or a separately approved shorter period), and the application URL. Keep diagnostics and visitor tracking disabled unless a controlled incident or privacy-reviewed release requires them.
3. **Deploy after checks pass.** The Blueprint is configured for `checksPass` deployment behavior. Render supports running build and pre-deploy stages before a service is started, and retains the last successful version if the new deployment fails.[1] [2]
4. **Run the controlled owner bootstrap only if required.** The command requires an existing verified account email and an explicit acknowledgement. It never creates an owner account or modifies a password. Its use revokes existing sessions for that account and records an audit event.
5. **Complete session smoke tests.** Create an ordinary user, sign in, reload the page, perform one protected action, sign out, and verify that the old browser session can no longer access `/api/me`.
6. **Check production health and logs.** Verify `/health`, the API service, the realtime service, the worker, and shared Redis-backed facilities. Confirm no repeated `Session authentication failed` messages.

## 3. Required environment configuration

All secrets must be stored in the Render environment group or an equivalent secret manager. Do not commit values to the repository.

| Setting                          | Production requirement                       | Notes                                                                                      |
| -------------------------------- | -------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `DATABASE_URL`                   | Neon runtime role connection string          | Use a dedicated application login when the deployment secret is rotated.                   |
| `ALLOWED_ORIGINS`                | Exact comma-separated UI origins             | No wildcards, temporary preview origins, or administrative domains.                        |
| `KRYV_APP_URL`                   | Canonical public UI origin                   | Must also appear in the trusted origin set.                                                |
| `JWT_SECRET`                     | Strong unique secret                         | Retained for controlled short-lived realtime compatibility; never issue it to the browser. |
| `KRYV_REALTIME_TOKEN_SECRET`     | Separate strong unique secret                | Required before operating a separate realtime gateway.                                     |
| `KRYV_SESSION_DAYS`              | `7` unless formally approved otherwise       | The application bounds this value to a safe range.                                         |
| `KRYV_DEBUG_ENDPOINTS_ENABLED`   | `false`                                      | Enable temporarily only during a documented incident.                                      |
| `KRYV_ACTIVITY_TRACKING_ENABLED` | `false`                                      | Requires privacy approval before enabling.                                                 |
| `KRYV_ACTIVITY_TRACKING_SALT`    | Secret value if tracking is enabled          | Required so no raw network or browser identifier is stored.                                |
| Provider and encryption secrets  | Set only through the deployment secret store | Rotate on suspected disclosure, personnel changes, or provider incidents.                  |

## 4. Identity recovery and owner administration

Use `OWNER_BOOTSTRAP_EMAIL` and `OWNER_BOOTSTRAP_CONFIRM=PROMOTE_EXISTING_OWNER` only from a controlled administrative shell against the intended production database. The target must already have a verified normal account. The script grants an explicit owner role, synchronizes legacy display state for existing UI compatibility, revokes old sessions, and appends an audit record.

> Never use a username, a password embedded in source code, or a public sign-up path to establish owner access.

For a suspected account compromise, increment the affected account session version and revoke active sessions through the approved administration path. For a broader credential incident, rotate the relevant deployment secret, invalidate affected sessions, review audit records, and confirm access from a newly authenticated browser only.

## 5. Neon operations and recovery

The connected Neon project currently has short history retention. Before any expanded launch, establish a backup and restoration policy that includes a restore drill against an isolated branch, a defined recovery-point objective, and evidence that the application passes its read/write smoke tests after restoration.

| Operation                  | Minimum standard                                                                     | Evidence to retain                                                     |
| -------------------------- | ------------------------------------------------------------------------------------ | ---------------------------------------------------------------------- |
| Schema change              | Validate in an isolated branch, verify, then obtain approval before production merge | Migration ID, temporary branch result, production verification         |
| Role and session migration | Additive changes first; deploy app code only after schema verification               | `platform_roles`, `user_sessions`, and `users.session_version` present |
| Schema parity              | Repository schema and deployed database compared after each migration                | Diff report with owner and due date for any exception                  |
| Recovery drill             | Restore or branch from a recovery point and run application smoke tests              | Timestamp, operator, objective, result, and remediation items          |
| Database access            | Dedicated application runtime role with only needed privileges                       | Role inventory and quarterly access review                             |
| Observability              | Enable query and connection telemetry appropriate to the plan                        | Daily error view and documented alert thresholds                       |

## 6. Financial, custody, and advertising release gates

The following capabilities remain **hard-disabled** until their release gates are demonstrated with written evidence. Removing a UI restriction or setting a feature flag is not evidence of readiness.

| Capability                         | Required gates before activation                                                                                                                                |
| ---------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Customer wallet custody            | Provider custody model approved, deposit reconciliation proven, withdrawal policy implemented, incident contacts verified, recovery drill completed             |
| Creator payouts                    | Segregated payout execution identity, dual approval, replay-safe provider integration, reconciliation, audit trail, failure handling, and tested limit controls |
| Provider withdrawals               | Credentials in a secret store, destination ownership controls, allowlists, staged sandbox/live test plan, and explicit activation approval                      |
| Ad delivery and advertiser billing | Accounting schema represented in source migrations, idempotent delivery events, invoice reconciliation, dispute workflow, and reporting review                  |
| Automated financial jobs           | Durable queue, retry/dead-letter behavior, owner-visible job history, alerting, and disable switch verified under failure conditions                            |

## 7. Release checklist

A production deployment is acceptable only when every applicable item is marked complete.

- [ ] Locked dependency installation succeeds with the pinned package manager.
- [ ] Shared packages build before API and frontend type checks.
- [ ] API and frontend type checks pass.
- [ ] CI runs the required checks for the exact commit.
- [ ] The deployed database schema matches the migration set or every exception is documented and owned.
- [ ] Exact CORS origins, application URL, and production secrets are configured.
- [ ] Login, reload, protected request, logout, revocation, and owner authorization smoke tests pass.
- [ ] `/health` and service logs are clean after rollout.
- [ ] Recovery, observability, and financial/custody gates have current evidence; disabled capabilities remain disabled when their gates are incomplete.

## References

[1]: https://render.com/docs/blueprint-spec "Render Blueprint YAML Reference"
[2]: https://render.com/docs/deploys "Render deployment workflow and pre-deploy commands"
