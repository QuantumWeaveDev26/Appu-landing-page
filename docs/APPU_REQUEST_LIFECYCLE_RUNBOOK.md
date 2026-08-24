# APPU Request Lifecycle and Signed Callback Runbook

Last updated: 2026-08-24

## Scope

This runbook covers the additive request lifecycle in migration `011_appu_request_lifecycle.sql`, backend-to-n8n request signing, n8n-to-backend callback signing, timeout reconciliation, and safe cutover. It does not authorize production deployment or production workflow edits.

## Runtime contract

1. The backend authorizes identity, household/child ownership, ACTIVE subscription, entitlements, and quota.
2. In one PostgreSQL transaction it reserves usage (or a guest turn) and inserts one `PENDING` request row.
3. It serializes the n8n envelope once, signs `unixTimestamp + "." + exactRawBody`, and sends the exact serialized bytes.
4. Synchronous success atomically commits usage and marks `SUCCEEDED`.
5. Confirmed downstream rejection marks `DEFINITE_FAILURE` and releases once.
6. Timeout, connection loss, and upstream 5xx are ambiguous: mark `UNKNOWN` and retain the reservation.
7. n8n sends a signed terminal callback; the backend verifies the exact raw callback body before parsing and reconciles once.

Same-key retries return the existing lifecycle state and never invoke n8n again. Callers must reuse the returned `Idempotency-Key`; timeout responses also include `X-Appu-Request-Id`.

## Callback payload

```json
{
  "requestId": "00000000-0000-4000-8000-000000000000",
  "outcome": "SUCCEEDED",
  "completedAt": "2026-08-24T12:00:00.000Z",
  "executionId": "optional-bounded-provider-id"
}
```

Failure callbacks use `outcome: "DEFINITE_FAILURE"` and may add a bounded `failureCode`. Do not add learner context, bearer tokens, household/payment data, secrets, response text, or `audio_base64`.

## Required secrets and config

- `N8N_APPU_REQUEST_HMAC_SECRET`: backend to n8n only.
- `N8N_APPU_CALLBACK_HMAC_SECRET`: n8n to backend only; must be different.
- `N8N_APPU_HMAC_MAX_AGE_SECONDS`: default 300.
- `N8N_APPU_TIMEOUT_MS`: use 45000 during initial cutover, then reduce using observed tail latency.

Provision the n8n copies through an authorized protected credential/environment mechanism. Never paste them into browser code, workflow JSON, logs, documentation, or chat.

## Duplicate workflow requirements before cutover

1. Enable Webhook v2.1 raw-body retention on the duplicate website webhook.
2. Add a verifier before `Normalize Website Input`.
3. Read the exact binary request buffer; verify signature format, freshness, and HMAC using constant-time comparison.
4. Reject missing, malformed, stale, or altered requests before MentorContext validation.
5. Add terminal success/failure callback nodes after the final outcome is known, signing the exact callback bytes with the callback secret.
6. Keep WhatsApp, Calendar, reporting, and other side-effect nodes pinned/simulated during tests.
7. Prove valid signed request, unsigned rejection, altered-body rejection, stale rejection, late success, late failure, and duplicate callback behavior.

The duplicate currently remains inactive. The verifier/callback nodes are intentionally not installed until an authorized secret channel exists; embedding a temporary secret in workflow parameters is not an acceptable workaround.

## Migration and rollback

Apply migrations once with the existing checksum-verified runner. The migration is additive and does not rewrite historical usage. Before dependent migrations, rollback is:

```sql
DROP TABLE appu_requests;
ALTER TABLE usage_records DROP CONSTRAINT uq_usage_records_household_id_id;
```

Do not rollback while unresolved `UNKNOWN` rows exist without an explicit accounting decision.

## Monitoring

Track counts and age by lifecycle state, callback signature failures, contradictory callbacks, provider execution ID, n8n/model/voice latency, and reservations held by `UNKNOWN`. Do not log request signatures, secrets, full MentorContext, private conversations, or audio bodies.

There is no automatic TTL release policy. Operational review of old `UNKNOWN` rows must use provider/n8n evidence before manual reconciliation.

## Duplicate latency evidence

- Baseline medium reasoning: average total 15.94s, median 17.84s, max 18.62s.
- Low reasoning: average total 5.08s, median 4.58s, max 7.98s.
- Low reasoning plus 1,200 output cap: average total 5.16s, median 5.06s, max 6.62s.
- Memory window 8: average total 4.72s, median 4.92s, max 5.44s on fresh sessions.
- No-tool tutoring experiment: average total 5.04s; prompt fell by 466 tokens but latency did not materially improve, so all tools were restored.

Candidate duplicate configuration: GPT-5 mini unchanged, reasoning `low`, provider output cap 1,200, memory window 8, all existing tools restored. Prompt compaction remains a separate reviewed change; the alternate-model benchmark was unnecessary.
