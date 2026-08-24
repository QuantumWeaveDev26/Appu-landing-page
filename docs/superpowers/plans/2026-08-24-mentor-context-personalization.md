# MentorContext Personalization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Route a fresh, backend-authoritative, tenant-scoped MentorContext into every APPU mentor request without changing existing auth, quota, payment, guest, or voice behavior.

**Architecture:** Replace the mixed generic AI context with a discriminated `MentorContext` union and an authoritative builder that reads the scoped child and personalisation records on every authenticated request. Carry it under the explicit `mentorContext` n8n envelope field, keep guests minimal, and document exact manual changes for the authoritative live workflow export.

**Tech Stack:** TypeScript, Fastify, Zod, PostgreSQL/pg-mem, Node test runner, n8n workflow JSON.

**Spec:** `docs/superpowers/specs/2026-08-24-mentor-context-personalization-design.md`

## Global Constraints

- Do not modify payment behavior, auth behavior, subscription behavior, guest quota behavior, Phase 1 UI/runtime, the live n8n workflow, or ElevenLabs behavior.
- Do not expose secrets, direct n8n URLs, household IDs, parent data, billing data, or security data to the browser or MentorContext.
- Do not modify or track `0-Click Discovery Call Scheduling (Google Meet + WhatsApp) (2).json`.
- Do not commit or push.
- Construct authenticated MentorContext from authoritative storage on every message after auth, ownership, ACTIVE subscription, entitlement, and quota checks.

---

### Task 1: Lock the canonical MentorContext contract with failing tests

**Files:**
- Modify: `backend/tests/milestone4-entitlements-and-gateway.test.ts`

**Interfaces:**
- Consumes: existing Fastify test app, tenancy/personalisation repositories, mock n8n client.
- Produces: contract expectations for `MentorContextBuilder.buildMentorContext(...)` and `N8nMessageEnvelope.mentorContext`.

- [x] **Step 1: Replace the legacy builder assertions with the flat authenticated contract**

Assert exact learner/profile fields, server entitlement flags, `mode: 'authenticated'`, and `personalizationEnabled: true`; assert UI-only and arbitrary fields are absent.

- [x] **Step 2: Add route-level differential and update-propagation tests**

Create two child rows and two personalisation rows in one household, send the same message for both, and assert two materially different captured `mentorContext` objects. Update one child's personalisation, send the next message, and assert the next captured context uses the update while the other child's context is unchanged.

- [x] **Step 3: Add spoofing, cross-household, and guest contract assertions**

Send forged `mentorContext` input and assert it is stripped and replaced by DB values. Request another household's child and assert rejection with no additional n8n call. Assert guest context is exactly the minimal guest union and contains no authenticated fields.

- [x] **Step 4: Run the focused test and confirm red state**

Run: `npm test -- --test-name-pattern="MentorContext|personalization"`

Expected: failure because the new builder/type/envelope are not implemented.

### Task 2: Implement the canonical backend contract

**Files:**
- Create: `backend/src/domain/personalisation/mentor-context-builder.ts`
- Modify: `backend/src/domain/personalisation/types.ts`
- Modify: `backend/src/domain/personalisation/index.ts`
- Delete: `backend/src/domain/personalisation/ai-context-builder.ts`
- Modify: `backend/src/domain/gateway/types.ts`
- Modify: `backend/src/routes/appu-gateway.ts`
- Modify: `backend/src/gateway/smoke-test-n8n.ts`

**Interfaces:**
- Produces: `AuthenticatedMentorContext`, `GuestMentorContext`, `MentorContext`, and `MentorContextBuilder.buildMentorContext(db, householdId, childId, entitlements)`.
- Produces: `N8nMessageEnvelope.mentorContext: MentorContext` with no legacy `context` property.

- [x] **Step 1: Define the discriminated types**

Use the schema in the approved design. Reuse existing `LearningStyle` and `ResponseStyle` types. Do not include presentation, voice, arbitrary context, tenant, payment, or secret fields.

- [x] **Step 2: Implement the authoritative builder**

Load the child through `TenancyRepository.getChildProfile(db, householdId, childId)`, load personalisation through `PersonalisationRepository.getPersonalisation(db, householdId, childId)`, apply current safe defaults, and derive all entitlement flags server-side. Build a new object on every call.

- [x] **Step 3: Replace the gateway envelope field**

After existing authorization/subscription/quota reservation, build `mentorContext` and send it under that explicit name. Preserve the existing current-turn language override (`request language` then `mentorContext.primaryLanguage`) while keeping the stored primary language authoritative inside MentorContext. Construct the exact minimal guest context in the guest branch. Do not change response or accounting logic.

- [x] **Step 4: Update the opt-in smoke envelope**

Use an authenticated MentorContext-shaped object and remove all UI-only fields. Do not run it unless a safe configured webhook URL is present.

- [x] **Step 5: Run focused and full backend validation**

Run: `npm run typecheck`, `npm test`, and `npm run build` from `backend/`.

Expected: all commands exit 0.

### Task 3: Document the exact live n8n manual integration

**Files:**
- Create: `docs/N8N_MENTOR_CONTEXT_RUNBOOK.md`
- Modify: `docs/PROJECT_CONTEXT.md`
- Modify: `docs/PHASE2_ARCHITECTURE.md`
- Modify: `docs/CURRENT_TASK.md`

**Interfaces:**
- Consumes: the read-only authoritative production workflow export and the backend `MentorContext` contract.
- Produces: exact copy/paste node changes and deployment tests without exposing embedded secrets.

- [x] **Step 1: Document `Normalize Website Input` replacement code**

Preserve its current supported message/session aliases, set website fields, carry only a copied `mentorContext`, and remove full-payload JSON from validation error messages.

- [x] **Step 2: Document `Validate APPU Conversation Envelope` replacement code**

Keep existing agent input/session/channel validation. For website messages require `mentorContext.mode` to be `authenticated` or `guest`; validate required authenticated scalar/array/boolean fields and the exact minimal guest contract; output a normalized safe object.

- [x] **Step 3: Document the APPU Mentor prompt append**

Append a runtime block at the end of the unchanged production master prompt using `{{ JSON.stringify($json.mentorContext || {}) }}`. State that existing `learner_profile`/`profile_name` remains WhatsApp-only and must not compete with website MentorContext.

- [x] **Step 4: Document security findings and node tests**

Flag literal credential/header values in the exported ElevenLabs and Meta HTTP nodes without printing them; recommend rotation and n8n Credentials/environment storage. Provide authenticated, guest, malformed, two-child, preference-update, WhatsApp-regression, and voice-path test cases.

- [x] **Step 5: Update shared project documents**

Record the canonical contract, authoritative live-workflow drift, implementation status, validation status, remaining manual deployment, and risk ownership.

### Task 4: Run complete regression and security validation

**Files:**
- Test only: backend and frontend test/build inputs.

**Interfaces:**
- Consumes: completed backend contract and documentation.
- Produces: verification evidence for the final report.

- [x] **Step 1: Run backend verification**

From `backend/`, run `npm run typecheck`, `npm test`, `npm run test:postgres` when a real configured PostgreSQL URL is safely available, and `npm run build`.

- [x] **Step 2: Run frontend verification**

From `frontend/`, run `node --test tests/*.test.js`, `python tests/page-structure.test.py`, `node tests/audit-frontend-bundle.cjs`, and `node tests/check-no-duplicates.cjs`.

- [x] **Step 3: Run repository hygiene checks**

Run `git diff --check`, `git status --short`, and verify the authoritative n8n export remains unmodified and untracked.

- [x] **Step 4: Review the diff for scope and secret exposure**

Confirm no payment, auth, subscription, quota, frontend runtime, n8n export, or voice behavior changed; inspect new tracked-text candidates for credential-like values without printing matches.

- [x] **Step 5: Produce the required A-P report**

Report repository state, architecture, schema, flows, isolation proof, payload transition, files/tests/validation, exact manual n8n changes, remaining production steps/risks, and `SAFE TO COMMIT` based on all checks and the still-required live n8n edit.
