# Security admission patch — 2026-11-17

This patch addresses the two scoped Codex Security findings without adding accounts to normal browser training. It also includes the existing Caddy client-address rate-limit fix.

## Anonymous usage metrics

`POST /api/usage/session` issues a server-selected UUID and a 30-minute HMAC grant. `POST /api/usage` requires that grant in Authorization. Its purpose, audience, absolute lifetime, session ID, test partition and daily private network digest must match. Raw caller-selected UUID events, changed IDs/test flags, altered tokens, cross-network reuse and expired tokens are rejected before D1 access. CF-Connecting-IP is trusted edge metadata, not X-Forwarded-For. IPv6 identities are grouped at /64; stored network keys are daily HMAC pseudonyms, never raw IP addresses.

The public issuer admits anonymous traffic; a grant is not proof of a human visit. Automated visitors within the budget can still affect anonymous statistics. The patch closes unsigned arbitrary session writes and bounds the accepted persistent work. Existing edge bot/WAF controls remain useful; do not interpret analytics as authenticated users.

Isolate-local attempt limits reject repeated traffic before D1, with a 4,096-entry memory cap. Durable SQL trigger quotas additionally govern new admissions across isolates/restarts, atomically with the metrics writes:

- 12 new sessions per network per minute and 120 per hour.
- 3,000 new sessions per day globally.
- 60 distinct events per session per minute, 240 per network per minute.
- 20,000 combined session/event admissions per day globally.
- At most 500 view sequence values per signed session.

These are telemetry admission budgets, not gameplay limits. When a budget is exhausted, metrics fail closed with HTTP 429 and training continues normally. Daily buckets use the same Korean calendar boundary as the metrics. Duplicate event identities cannot change an already accepted path or increment aggregates twice. Guard nonces bind the metrics statements to the newly admitted event within a single D1 transaction; database errors roll back both admission and metrics. Expired guard/budget rows are removed in bounded indexed batches. Request bodies stay capped at 512 bytes. GPC/DNT continue to opt out.

Configure `VALOPRAC_USAGE_SECRET` as a Sites runtime secret with at least 32 random bytes. The Worker fails closed without it or the D1 schema. The new `0001_usage_admission` migration adds only guard/budget tables and triggers; existing metrics/migrations remain intact. Rotate the secret to invalidate outstanding grants. The client obtains a new admitted session on its next navigation/start; every fresh session records a view before its first start, including long-lived same-route training. Old unsigned scripts are not accepted; the script URL is cache-busted and old already-open tabs may omit telemetry until reload.

No runtime key is placed in source, browser assets or the downloadable source ZIP. Deployment bundles include the immutable SQL migrations and shared crypto module.

## Optional GPU admission

See `migration/DEPLOYMENT.md`. Native Sites identity plus an explicit tester allowlist controls grant issuance. The broker checks signed, short-lived one-use grants before spawning anything, restricts active/starting leases per subject, and bounds bearer-only authority to 15 minutes. Fresh approval renewals preserve long Free Practice without granting perpetual bearer-only control. Streaming remains disabled and no paid infrastructure is activated by this patch.

## Validation

Focused tests use actual local HTTP and SQLite boundaries, a controlled reverse proxy, and disposable Node worker processes. They cover original unsigned-event/Origin triggers, tampering, purpose/audience/identity binding, expiry, replay/concurrency, network and cross-isolate durable limits, quota rollback, ordinary visit/start deduplication, browser grant rotation and privacy opt-out. Native Sites dispatch identity stripping, hosted D1 migration/application, and published asset behavior must also be checked in the hosted deployment. Actual Unreal/GPU/ICE behavior remains outside local fixture coverage.
