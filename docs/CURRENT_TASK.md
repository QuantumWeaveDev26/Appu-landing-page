# Current Task

Last updated: 2026-08-20

## Current Phase:

Phase 2 SaaS Foundation

## Current Milestone:

Milestone 2A.1 — Production Database Foundation Hardening (COMPLETE)

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
  - Added initial adversarial test cases.
- **Milestone 2A.1 (Production Database Foundation Hardening)**:
  - **Production Migration Command**: Added `npm run db:migrate` executing `backend/src/db/migrate-cli.ts`. Validates `DATABASE_URL`, connects cleanly, applies pending migrations, records versions and checksums, closes pool, and exits non-zero on error without leaking secrets.
  - **Authoritative Migration Source**: Made `backend/db/migrations/` the sole source of truth for migrations, completely eliminating duplicate embedded SQL strings.
  - **Cryptographic Checksums (SHA-256)**: Enhanced `schema_migrations` to record normalized SHA-256 checksums per applied migration. Throws `MigrationChecksumMismatchError` if a historical applied migration is modified.
  - **Controlled Database Pool Lifecycle**: Added single application PostgreSQL pool with standard pooling defaults (max 10, idle timeout 30s, connection timeout 5s), idle client error handler, and Fastify `onClose` hook ensuring clean pool teardown on application shutdown.
  - **Database Readiness Endpoint**: Created `GET /ready` checking DB connectivity with lightweight `SELECT 1` without turning the liveness probe (`GET /health`) into a heavy dependency check.
  - **Atomic Household + Owner Creation**: Implemented `TenancyService.createHouseholdWithOwner(db, { userId, householdName })` running inside a single PostgreSQL transaction with guaranteed rollback if OWNER creation fails.
  - **Real PostgreSQL Integration Runner**: Added `backend/tests/postgres-integration.test.ts` and `npm run test:postgres` script which cleanly runs full integration suite when `TEST_DATABASE_URL` is set, or reports clear skip diagnostic when unset.
  - **Auth Subject Decision Documentation**: Documented provisional Supabase Auth user UUID reference for `household_members.user_id` and the internal identity mapping table alternative for non-UUID providers.
  - **Validation & Adversarial Testing**: 42 automated tests passing with 0 failures across health, readiness, config, subscriptions, entitlements, migrations, checksums, atomic transactions, and cross-tenant isolation.

## In Progress:

- Preparation for Milestone 2B (Parent Authentication & Household Session Binding).

## Next:

1. Obtain review and approval on Milestone 2A.1 completion.
2. Formulate Milestone 2B implementation plan:
   - Parent authentication provider integration (managed Supabase Auth / JWT / session tokens).
   - Fastify authentication pre-handler and household membership authorization middleware.
   - Child-mode access sessions (scoped, short-lived tokens bound to `household_id` and `child_id`).
   - Preparation for Row-Level Security (RLS) policies.
3. Keep Phase 1 browser-to-n8n direct flow active until backend personal context adapters and cutover verification are completed in subsequent milestones.

## Important Decisions & Database Design:

- **Single Migration Source**: `backend/db/migrations/` is the sole source of truth; no SQL duplicates exist in application code.
- **Migration Checksum Protection**: Applied migrations are protected by SHA-256 checksums, normalized across line endings to prevent cross-OS drift.
- **One Controlled Pool**: Database connections are lazily initialized via config and closed cleanly via Fastify lifecycle hooks.
- **Atomic Tenant Root Creation**: A household is never persisted without its initial OWNER; `TenancyService.createHouseholdWithOwner` guarantees atomic creation and rollback.
- **Provisional Auth Subject**: `household_members.user_id` is typed as a UUID intended for Supabase Auth `auth.users.id`. If a non-UUID auth provider is chosen later, an internal `user_identities` mapping table will be introduced.
- **Separation of Health vs Readiness**: `/health` remains a pure liveness probe (200 OK without DB dependency); `/ready` performs DB ping.

## Real PostgreSQL Validation Status:

**REAL POSTGRES VALIDATION: PASSED (VERIFIED ON LIVE SUPABASE POSTGRESQL)**
- Connected to live PostgreSQL instance via `TEST_DATABASE_URL`.
- Migration execution & SHA-256 checksum persistence: **PASSED**
- Migration idempotency: **PASSED**
- Atomic Household + OWNER creation in single transaction: **PASSED**
- Adversarial cross-tenant isolation (preventing cross-household query/list/update/delete leaks): **PASSED**

## Known Limitations:

- Authentication is not yet integrated; `user_id` in `household_members` currently represents an opaque authenticated user ID provided by trusted backend callers.
- Repository methods enforce tenant filtering at the query level; Row-Level Security (RLS) policies will be added when auth context is available in Milestone 2B.

## Known Issues:

### LIVE_N8N_WORKFLOW_DRIFT

The checked-in `scratch_workflow_raw.json` is outdated compared with the current live n8n workflow. A fresh sanitised export should replace or archive the stale snapshot before n8n adapter milestones.

### DEPLOYMENT_RUNTIME_UNRESOLVED

It is not yet confirmed whether the current Hostinger account supports Node.js Web Apps or only static `public_html` hosting.

### PHASE1_PUBLIC_N8N_BOUNDARY

The browser currently calls a public n8n webhook directly. This remains active to preserve Phase 1 until tested backend adapters are cut over in Milestone 9.

## Validation Status:

- **TypeScript Typecheck**: PASSED (`npm run typecheck` in `backend/` — 0 errors)
- **Backend Unit & Integration Tests**: PASSED (`npm test` in `backend/` — 44/44 tests passed, 0 failures)
- **Real PostgreSQL Integration Tests**: PASSED (`npm run test:postgres` with `TEST_DATABASE_URL` — 3/3 tests passed on live Supabase PostgreSQL)
- **Backend Build**: PASSED (`npm run build` in `backend/` — cleanly generated `backend/dist/`)
- **Phase 1 Node Tests**: PASSED (`node --test tests/*.test.js` — 8/8 tests passed)
- **Phase 1 Python Tests**: PASSED (`python tests/page-structure.test.py` — 8/8 tests passed)
- **Phase 1 JS Syntax Check**: PASSED (`node --check` across all Phase 1 scripts — 0 errors)
