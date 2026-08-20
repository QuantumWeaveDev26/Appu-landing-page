# Current Task

Last updated: 2026-08-20

## Current Phase:

Phase 2 SaaS Foundation

## Current Milestone:

Milestone 1 — Backend & Domain Foundation (COMPLETE)

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
  - Implemented the 9-state internal subscription model: `DRAFT`, `PENDING_PAYMENT`, `AUTHENTICATED`, `ACTIVE`, `PAST_DUE`, `HALTED`, `PAUSED`, `CANCELLED`, `EXPIRED` (`backend/src/domain/subscription/`).
  - Implemented explicit allowed subscription transitions table, transition validator, and terminal/entitled state queries.
  - Implemented centralized entitlement definitions (`backend/src/domain/entitlements/`) supporting `boolean`, `integer`, `string` values for initial keys:
    - `max_children` (integer, min 1)
    - `monthly_voice_minutes` (integer, min 0)
    - `monthly_ai_sessions` (integer, min 0)
    - `multilingual` (boolean)
    - `advanced_personalisation` (boolean)
    - `parent_reports` (boolean)
    - `long_term_context` (boolean)
    - `premium_themes` (boolean)
  - Implemented pure `EntitlementResolver` and `validateEntitlementValue` without any plan-name conditionals (e.g. no `if (plan === "premium")`).
  - Added 21 focused unit tests across health endpoint, config validation, valid state transitions, invalid state transitions, and entitlement values.
  - Verified backend TypeScript typecheck, backend unit tests, backend build, Phase 1 regression tests, and Phase 1 JavaScript syntax checks all pass with 0 failures.
  - Confirmed Phase 1 runtime files and browser-to-n8n flow are completely untouched.

## In Progress:

- Preparation for Milestone 2 (Authentication and household tenancy).

## Next:

1. Obtain approval on Milestone 1 completion.
2. Formulate Milestone 2 implementation plan:
   - Parent identity and authentication service.
   - Household tenant root and membership model.
   - Child profile ownership and access sessions.
   - Row-Level Security (RLS) policies.
3. Keep Phase 1 browser-to-n8n direct flow active until backend personal context adapters and cutover verification are completed in subsequent milestones.

## Important Decisions:

- Phase 1 UI and browser voice playback remain untouched and fully working.
- Backend is created in an isolated `backend/` directory so frontend static deployment is unaffected.
- No ORM, database, auth, or payment packages were installed in Milestone 1.
- Subscription state machine uses explicit allowed transitions; terminal states cannot transition.
- Entitlements are resolved by data and value types, never by hardcoded plan name strings.
- ElevenLabs credentials remain server-side in n8n.

## Known Issues:

### LIVE_N8N_WORKFLOW_DRIFT

The checked-in `scratch_workflow_raw.json` is outdated compared with the current live n8n workflow. A fresh sanitised export should replace or archive the stale snapshot before n8n adapter milestones.

### DEPLOYMENT_RUNTIME_UNRESOLVED

It is not yet confirmed whether the current Hostinger account supports Node.js Web Apps or only static `public_html` hosting.

### PHASE1_PUBLIC_N8N_BOUNDARY

The browser currently calls a public n8n webhook directly. This remains active to preserve Phase 1 until tested backend adapters are cut over in Milestone 9.

## Validation Status:

- **TypeScript Typecheck**: PASSED (`npm run typecheck` in `backend/` — 0 errors)
- **Backend Unit Tests**: PASSED (`npm test` in `backend/` — 21/21 tests passed, 0 failures)
- **Backend Build**: PASSED (`npm run build` in `backend/` — cleanly generated `backend/dist/`)
- **Phase 1 Node Tests**: PASSED (`node --test tests/*.test.js` — 8/8 tests passed)
- **Phase 1 Python Tests**: PASSED (`python tests/page-structure.test.py` — 8/8 tests passed)
- **Phase 1 JS Syntax Check**: PASSED (`node --check` across all Phase 1 scripts — 0 errors)
