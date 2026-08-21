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
  - **Development Phase 2 Parent Onboarding Shell**:
    - Implemented `parent-onboarding-shell.js` orchestrating Supabase client authentication, idempotent household onboarding, database plan loading, Standard Checkout integration, child profile creation/selection, and structured personalisation persistence.
    - Implemented `parent-setup-ui.js` providing responsive modal UI with multi-step progress, safe error boundaries, and seamless session handoff into `AppuSession`.
    - Added `#parent-setup-modal` and `#parent-session-badge` in `index.html`.

## Milestone & Verification Summary:

- **Backend Phase 2 Path**: LIVE VERIFIED
- **Frontend Secure Transport**: IMPLEMENTED + TESTED
- **Parent Onboarding Integration**: IMPLEMENTED
- **Legacy Phase 1 Direct n8n Fallback**: TEMPORARILY RETAINED
- **Production Polish / Deployment**: PENDING

## Important Decisions & Security Invariants:

- **Server-Driven Entitlements**: The browser never passes prices, amounts, or entitlement keys. All subscription parameters and feature limits are derived server-side from active database records.
- **Strict Activation Boundary**: Browser checkout signature verification transitions state to `AUTHENTICATED`, but NEVER directly to `ACTIVE`. Full entitlement access is granted only upon receiving trusted webhook confirmation (`subscription.activated` / `subscription.charged`).
- **Composite Tenancy Foreign Keys**: Child personalisation records use `(household_id, child_id)` composite foreign key guarantees preventing cross-household data linkage.
- **Data vs Instruction Boundary**: Child personalisation values are treated strictly as data payloads within the AI context, never concatenated directly into executable prompt instructions.
- **Webhook Idempotency**: All webhook events are recorded with `provider_event_id` in `payment_events`. Duplicate deliveries are safe no-ops (`already_processed`) with zero side effects.
- **Zero Payment Instrument / Token Storage**: Card numbers, CVVs, full instruments, and secret keys are never accepted or stored.
- **HMAC Constant-Time Verification**: All signature checks utilize `crypto.timingSafeEqual` to prevent timing attacks.

## Validation Status:

- **TypeScript Typecheck**: PASSED (`npm run typecheck` in `backend/` — 0 errors)
- **Backend Unit & Integration Tests**: PASSED (`npm test` in `backend/` — 78/78 tests passed, 0 failures)
- **Real PostgreSQL Integration Tests**: PASSED (`npm run test:postgres` with `TEST_DATABASE_URL` — 5/5 tests passed)
- **Backend Build**: PASSED (`npm run build` in `backend/` — cleanly generated `backend/dist/`)
- **Dependency Audit**: PASSED (`npm audit --omit=dev` — 0 vulnerabilities)
- **Frontend Node Tests**: PASSED (`node --test tests/*.test.js` — 17/17 tests passed)
- **Phase 1 Python Tests**: PASSED (`python tests/page-structure.test.py` — 8/8 tests passed)
- **Phase 1 JS Syntax Check**: PASSED (`node --check` across all frontend scripts — 0 errors)
