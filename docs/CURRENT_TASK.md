# Current Task

Last updated: 2026-08-21

## Current Phase:

Phase 2 SaaS Foundation

## Current Milestone:

Milestone 3 — Subscription Persistence + Razorpay TEST Integration (COMPLETE)

## Completed:

- **Milestone 0**:
  - Audited the static Phase 1 repository.
  - Recorded live n8n workflow drift and ElevenLabs status.
  - Produced `docs/PROJECT_CONTEXT.md` and `docs/PHASE2_ARCHITECTURE.md`.
- **Milestone 1 (Backend & Domain Foundation)**:
  - Created an isolated Node.js + TypeScript + Fastify backend in `backend/`.
  - Added safe environment/config validation via Zod (`backend/src/config/`) and `backend/.env.example`.
  - Implemented `GET /health` route returning `{ "status": "ok" }` (`backend/src/routes/health.ts`).
  - Created structured application error hierarchy (`backend/src/errors/`) and Fastify error handler.
  - Implemented the 9-state internal subscription model: `DRAFT`, `PENDING_PAYMENT`, `AUTHENTICATED`, `ACTIVE`, `PAST_DUE`, `HALTED`, `PAUSED`, `CANCELLED`, `EXPIRED`.
  - Implemented centralized entitlement definitions for boolean, integer, string values covering the 8 initial keys with pure layered resolution and zero plan-name string conditionals.
  - Added unit test suite covering health, config, subscription state transitions, and entitlement validation.
- **Milestone 2A (PostgreSQL Household Tenancy Foundation)**:
  - Added native PostgreSQL database layer (`pg` connection pool + `Queryable` interface).
  - Created versioned SQL migration system in `backend/db/migrations/` with `schema_migrations` tracking.
  - Created initial tenancy migration `001_initial_tenancy.sql` (`households`, `household_members`, `child_profiles`).
  - Added typed data-access layer `TenancyRepository` with strictly scoped household operations.
- **Milestone 2A.1 (Production Database Foundation Hardening)**:
  - Added operational CLI migration runner `npm run db:migrate`.
  - Enforced single migration source of truth in `backend/db/migrations/`.
  - Added SHA-256 cryptographic checksum verification and tamper rejection.
  - Hardened PostgreSQL pool lifecycle with Fastify `onClose` teardown.
  - Added database readiness probe `GET /ready`.
  - Added transactional `TenancyService.createHouseholdWithOwner`.
  - Added `npm run test:postgres` and verified 100% on live Supabase PostgreSQL.
- **Milestone 2B (Parent Authentication & Household Authorization & Child APIs)**:
  - Added `SupabaseAuthVerifier` with official `@supabase/supabase-js` client.
  - Implemented Fastify auth middleware and `HouseholdAuthorizationService`.
  - Added protected `/api/auth/me`, `/api/household/onboard`, and `/api/children` APIs.
  - LIVE verified with Supabase test user.
- **Milestone 3 (Plans + Subscription Persistence + Razorpay TEST Mode)**:
  - **Database Migration (`002_subscription_plans.sql`)**:
    - Created `plans`, `plan_entitlements`, `subscriptions`, and `payment_events` tables with proper foreign keys, unique constraints, and indices.
    - Seeded initial database-driven plans (`starter` ₹499/mo, `growth` ₹999/mo, `family` ₹1499/mo) and their typed entitlements.
  - **Razorpay Provider Abstraction**:
    - Implemented `DefaultRazorpayClient` handling subscription creation (`/v1/subscriptions`), standard checkout signature verification (`HMAC-SHA256(payment_id + "|" + subscription_id, key_secret)`), and webhook signature verification (`HMAC-SHA256(raw_body, webhook_secret)`).
    - Created `MockRazorpayClient` for fast offline unit/integration test suites.
  - **Fastify Raw Body Preservation**:
    - Preserved raw body string for cryptographic webhook signature verification without breaking standard JSON body parsing.
  - **Protected Subscription Endpoints**:
    - `GET /api/plans`: Public safe endpoint returning active plans, pricing, and features.
    - `POST /api/subscriptions`: Protected endpoint creating a Razorpay subscription for the verified parent's household in state `PENDING_PAYMENT`.
    - `POST /api/subscriptions/verify-checkout`: Verifies standard checkout signature and transitions subscription to `AUTHENTICATED` (never directly to `ACTIVE`).
    - `GET /api/subscriptions/current`: Returns current subscription status and active entitlements (entitlements active only when status is `ACTIVE`).
  - **Razorpay Plan Price Correction & Provider Mapping (`003_correct_test_plan_prices.sql`)**:
    - Corrected database plan prices to align with live Razorpay TEST plan amounts without altering checksums of historical migrations:
      - Starter: ₹299/mo (29900 paise)
      - Growth: ₹599/mo (59900 paise)
      - Family: ₹999/mo (99900 paise)
    - Added safe plan synchronization CLI `npm run plans:sync` (`backend/src/db/sync-plans-cli.ts`) mapping `RAZORPAY_PLAN_STARTER_ID`, `RAZORPAY_PLAN_GROWTH_ID`, and `RAZORPAY_PLAN_FAMILY_ID` into `plans.provider_plan_id`.
    - Enforced validation rejecting subscription creation if a plan lacks a configured `provider_plan_id` or is inactive.
  - **Cross-Tenant Subscription Protection**:
    - Verified that Parent A cannot verify checkout or view subscription context for Parent B.
- **Milestone 4 (Entitlement Enforcement + Child Personalisation + Secure N8N Gateway)**:
  - **Entitlement Enforcement**:
    - Created `EntitlementEnforcementService.getHouseholdEntitlements` deriving active entitlements strictly from server-resolved active subscription plans.
    - Implemented and enforced `max_children` limit inside `POST /api/children` (Starter plan blocks child >= 1; Growth blocks >= 2; unsubscribed households are blocked from creating children).
  - **Child Personalisation Persistence (`004_child_personalisation.sql`)**:
    - Created dedicated `child_personalisation` table bound by composite foreign key `(household_id, child_id) -> child_profiles(household_id, id)`.
    - Implemented protected `GET /api/children/:childId/personalisation` and `PUT /api/children/:childId/personalisation` with strict server-side validation against controlled enums (`font_preference`, `learning_style`, `response_style`, `theme_preference`) and strict character/symbol sanitization (preventing HTML, script tags, or prompt injection).
  - **AI Context Builder**:
    - Implemented `AIContextBuilder.buildChildAIContext` combining child profile, validated personalisation, and active server entitlements into a structured, safe context object where preferences are treated as data, not executable instructions.
  - **Secure N8N Gateway (`POST /api/appu/message`)**:
    - Implemented parent-authenticated secure gateway route forwarding child messages to the live n8n AI mentor workflow.
    - Gated by active subscription, validates message length, sets timeout protection, sanitizes upstream provider errors, and hides internal webhook URLs.
    - Added smoke test CLI `npm run gateway:smoke` (`backend/src/gateway/smoke-test-n8n.ts`).
  - **Frontend Secure-Gateway Adapter & Session Bridge**:
    - Implemented `appu-config.js` providing safe, secret-free public configuration (`apiBaseUrl`, `supabaseUrl`, `supabasePublishableKey`).
    - Implemented `appu-session.js` holding verified access tokens and active child profile IDs strictly in-memory.
    - Implemented `appu-backend-client.js` communicating with `POST /api/appu/message` and normalizing audio/text into the existing `voice-contract.js` interface.
    - Integrated transport switching in `chat-agent.js` with clearly documented `LEGACY_PHASE1_DIRECT_N8N` fallback.
  - **Development Phase 2 Parent Onboarding & Subscription Visibility Shell**:
    - Implemented `parent-onboarding-shell.js` orchestrating Supabase client authentication, idempotent household onboarding, database plan loading, Standard Checkout integration, child profile creation/selection, structured personalisation persistence, and resolved subscription view-model computation (`getSubscriptionViewModel`).
    - Implemented `parent-setup-ui.js` providing:
      - Active plan summary card (`Starter Plan • ACTIVE • ₹299/mo`).
      - Learner quota meter and limit alerts (`1 of 1 used`).
      - Quota-aware learner form disabling and upgrade prompts when `children.length >= max_children`.
      - Plan comparison modal view highlighting current active plan vs upgrade options.
      - Compact plan status headers and non-ACTIVE state mapping without leaking internal state machine terms.
      - Session handoff into in-memory `AppuSession` without mutating child UI.
    - Added `#parent-setup-modal` and `#parent-session-badge` in `index.html`.
- **Phase 2 Usage Accounting Foundation**:
  - **Database Migration (`005_usage_accounting.sql`)**:
    - Created `usage_records` ledger table with composite tenancy foreign key `fk_usage_records_child (household_id, child_id) REFERENCES child_profiles(household_id, id) ON DELETE SET NULL`.
    - Added unique idempotency constraint `uq_usage_records_idempotency (household_id, metric, idempotency_key)` and indices for household, metric, period, status, and subscription queries.
  - **Domain Usage Service & Repository (`backend/src/domain/usage/`)**:
    - Implemented `UsageRepository.resolveUsagePeriod` dynamically resolving cycle from subscription `current_period_start`/`current_period_end` or deterministic 30-day UTC rolling cycle.
    - Implemented atomic AI session quota check and reservation (`UsageService.reserveAiSession` / `UsageRepository.reserveUsageAtomic`).
    - Enforced reservation commit on upstream provider success (`commitAiSession`) and rollback release on upstream failure or timeout (`releaseAiSession`).
    - Implemented `QuotaExceededError` mapping to HTTP 429 when cumulative usage in the billing period exceeds the active plan limit (e.g. 100 on Starter).
  - **Protected Usage API & Gateway Integration**:
    - Registered `GET /api/usage/current` returning authoritative period, AI session usage (`used`, `limit`, `remaining`), and honest voice allowance status (`meteringStatus: "pending"`).
    - Wired atomic reservation in `POST /api/appu/message` prior to calling n8n, preventing unmetered requests and rejecting exhausted households without invoking upstream resources.
  - **Parent Zone & Onboarding UI Integration**:
    - Integrated `fetchUsageSummary()` into `parent-onboarding-shell.js` and `getSubscriptionViewModel()`.
    - Rendered real AI Session monthly usage meter (`used of limit used, remaining remaining`) alongside learner slots meter in `parent-setup-ui.js`.
    - Rendered explicit, honest voice allowance notice: `30 voice minutes/month included • Metering pending`.
  - **Comprehensive Test Coverage**:
    - Created `backend/tests/usage-accounting.test.ts` (single request consumption, rollback on provider failure, 429 rejection on quota exhaustion without calling n8n, tenant isolation, and period resolution).
    - Updated `backend/tests/postgres-integration.test.ts` with atomic reservation, commit, and quantity query on real PostgreSQL.

  - **Hardening Migration (`006_usage_accounting_hardening.sql`)**:
    - Added `uq_subscriptions_household_id UNIQUE (household_id, id)` on `subscriptions`.
    - Added tenant-safe composite foreign key `fk_usage_records_subscription (household_id, subscription_id) REFERENCES subscriptions(household_id, id) ON DELETE RESTRICT`, mathematically preventing cross-household subscription usage attachment at the PostgreSQL engine level.
    - Serialized concurrent reservation requests per household/subscription using PostgreSQL advisory transaction locks (`pg_advisory_xact_lock(hashtext('appu_usage_lock:' || householdId || ':' || subscriptionId))`).

  - **Child FK Restoration & Idempotency Fingerprint Migration (`007_child_fk_and_idempotency_fingerprint.sql`)**:
    - Restored composite tenant foreign key `fk_usage_records_child (household_id, child_id) REFERENCES child_profiles(household_id, id) ON DELETE SET NULL (child_id)` utilizing PostgreSQL 15+ partial `SET NULL`, enforcing that child usage strictly binds to the same household at the database constraint level while setting only `child_id = NULL` on child profile deletion.
    - Added `request_fingerprint VARCHAR(64)` column to `usage_records`.
    - Hardened idempotency key lifecycle with deterministic SHA-256 fingerprinting `SHA-256(householdId + childId + message + language)`: same key with different fingerprint is rejected with HTTP 409 Conflict without invoking n8n or consuming quota.

## Milestone & Verification Summary:

- **Backend Phase 2 Path**: LIVE VERIFIED
- **Frontend Secure Transport**: IMPLEMENTED + TESTED
- **Parent Subscription Visibility**: IMPLEMENTED
- **Current Plan Summary**: IMPLEMENTED
- **Learner Entitlement Visibility**: IMPLEMENTED
- **AI Session Usage Accounting**: IMPLEMENTED + SERVER ENFORCED
- **Tenant-Safe Subscription Composite FK**: HARDENED & TESTED ON REAL POSTGRESQL
- **Tenant-Safe Child Composite FK**: HARDENED & TESTED ON REAL POSTGRESQL (rejection of cross-household child attachment + partial SET NULL on deletion)
- **Concurrency Serialization**: PROVEN ON REAL POSTGRESQL (10 simultaneous attempts $\rightarrow$ exactly 1 succeeds, 9 fail)
- **Idempotency Fingerprint Lifecycle**: PROVEN ON REAL POSTGRESQL (genuine retry consumes exactly 1 unit; distinct message with reused key returns 409)
- **Frontend Unique Request Keys**: IMPLEMENTED in `appu-backend-client.js` via `crypto.randomUUID()` per logical message
- **Voice Minutes Metering**: PENDING TRUSTWORTHY AUDIO DURATION CONTRACT (HONESTLY PRESENTED AS PENDING)
- **Legacy Phase 1 Direct n8n Fallback**: TEMPORARILY RETAINED
- **Production Upgrade Billing Flow**: PENDING

## Important Decisions & Security Invariants:

- **Server-Driven Entitlements & Quotas**: The browser never passes prices, amounts, or quota limits. All feature limits and session consumptions are derived and recorded strictly server-side.
- **Tenant-Safe Composite Foreign Keys**: Both `subscriptions` and `child_profiles` enforce `(household_id, id)` composite constraints preventing cross-household data linkage.
- **Atomic Two-Phase Quota Reservation & Advisory Locking**: Usage is serialized using `pg_advisory_xact_lock` and reserved prior to calling upstream AI workflows, committed upon provider success, and released upon upstream failure so households are not charged for dropped requests.
- **Deterministic Idempotency Fingerprint**: Idempotency keys are cryptographically bound to request parameters `(household, child, message, language)`; key collisions with conflicting payloads reject with HTTP 409 without calling upstream AI workflows.
- **Zero Usage Fabrication**: Voice usage is never fabricated or guessed based on text length or untrusted client playback. It is explicitly presented as `Usage metering pending` until an authoritative server audio duration contract is established.
- **Strict Activation Boundary**: Browser checkout signature verification transitions state to `AUTHENTICATED`, but NEVER directly to `ACTIVE`. Full entitlement access is granted only upon receiving trusted webhook confirmation (`subscription.activated` / `subscription.charged`).
- **Data vs Instruction Boundary**: Child personalisation values are treated strictly as data payloads within the AI context, never concatenated directly into executable prompt instructions.
- **Webhook Idempotency**: All webhook events are recorded with `provider_event_id` in `payment_events`. Duplicate deliveries are safe no-ops (`already_processed`) with zero side effects.
- **Zero Payment Instrument / Token Storage**: Card numbers, CVVs, full instruments, and secret keys are never accepted or stored.
- **HMAC Constant-Time Verification**: All signature checks utilize `crypto.timingSafeEqual` to prevent timing attacks.

## Validation Status:

- **TypeScript Typecheck**: PASSED (`npm run typecheck` in `backend/` — 0 errors)
- **Backend Unit & Integration Tests**: PASSED (`npm test` in `backend/` — 99 tests: 98 passed, 1 skipped for pg-mem limitation, 0 failures)
- **Real PostgreSQL Integration Tests**: PASSED (`npm run test:postgres` with `TEST_DATABASE_URL` — 11/11 tests passed, 0 failures)
- **Backend Build**: PASSED (`npm run build` in `backend/` — cleanly generated `backend/dist/`)
- **Dependency Audit**: PASSED (`npm audit --omit=dev` — 0 vulnerabilities)
- **Frontend Node Tests**: PASSED (`node --test tests/*.test.js` — 21/21 tests passed)
- **Phase 1 Python Tests**: PASSED (`python tests/page-structure.test.py` — 8/8 tests passed)
- **Phase 1 JS Syntax Check**: PASSED (`node --check` across all frontend scripts — 0 errors)

