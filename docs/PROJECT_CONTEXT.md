# Appu Project Context

Last updated: 2026-08-24

## Start here

Future development agents should read:

1. `docs/PROJECT_CONTEXT.md`
2. `docs/PHASE2_ARCHITECTURE.md`
3. `docs/CURRENT_TASK.md`

Then inspect the relevant code. Repository code is the source of truth when documentation and implementation disagree. The manually verified live n8n workflow is authoritative for live workflow topology where the checked-in workflow snapshot is known to be stale.

## Product

Appu is an AI learning companion for children in Classes 5–12. Parents are the account owners and purchasers; children are the primary learning users. Phase 2 will add parent accounts, isolated child profiles, controlled personalisation, subscriptions, entitlements, usage quotas, Razorpay, consent/privacy controls, and a parent dashboard.

The product must remain child-safe, privacy-conscious, multilingual, voice-enabled, and visually consistent with Phase 1.

## Current repository

- `frontend/` is the only canonical browser application. Production frontend deployment is GitHub `frontend-production` → Hostinger.
- `backend/` is a Node.js/TypeScript/Fastify API with PostgreSQL, Supabase token verification, household/child tenancy, database-driven plans/entitlements, Razorpay test-mode subscription state, usage/voice accounting, guest access, and the protected APPU n8n gateway.
- Browser AI traffic follows Browser → APPU Backend → policy/accounting checks → n8n. Direct browser-to-n8n traffic is not an approved runtime path.
- `docs/` contains architecture, deployment, current-task, and operational runbook material.
- `scratch_workflow_raw.json` is stale.
- The untracked `0-Click Discovery Call Scheduling (Google Meet + WhatsApp) (2).json` is a sensitive read-only export of the current live production workflow. Never commit or use it as a source of credentials.

### Canonical MentorContext (2026-08-24)

For every authenticated APPU message, the backend verifies bearer identity, household membership, child ownership, ACTIVE subscription, entitlements, and quota before reading child personalisation and constructing a fresh `AuthenticatedMentorContext`. The n8n envelope carries it only under `mentorContext`. Guests receive a minimal discriminated context with no learner identifiers or saved preferences. UI-only settings, arbitrary `additionalContext`, parent/household/payment/security data, and secrets are excluded.

The live workflow still requires the manual append-only integration in `docs/N8N_MENTOR_CONTEXT_RUNBOOK.md`; until deployed, backend payloads contain MentorContext but the production mentor prompt will not yet consume it.

## Phase 1 capabilities to preserve

- Existing single-screen Appu UI and entrance video.
- English/Kannada selection.
- Browser speech recognition.
- Chat drawer and mission prompts.
- Appu avatar states and subtitles.
- Parent Zone call-booking experience until it is securely replaced.
- n8n AI orchestration.
- Live n8n ElevenLabs generation and Base64 audio response.
- `voice-contract.js` response compatibility.

Do not move ElevenLabs credentials into the browser. Do not rewrite the live voice workflow before a backend-to-n8n adapter has passed integration tests.

## Corrected current live Appu flow

The product owner manually verified this current live website path:

```text
Website Webhook
  -> Normalize Website Input
  -> Validate APPU Conversation Envelope
  -> APPU Mentor / AI Agent
  -> Restore APPU Response Context
  -> Is WhatsApp Channel
  -> Generate APPU Voice (ElevenLabs)
  -> Encode Audio to Base64
  -> Respond to Website Webhook
```

Known issue:

```text
LIVE_N8N_WORKFLOW_DRIFT:
The checked-in n8n snapshot is outdated compared with the production/live workflow.
A fresh sanitized export should replace it before it is used as architecture documentation.
```

## Current security boundary

The Fastify backend is the application authority for authentication, household/child ownership, ACTIVE subscription state, entitlements, guest limits, and usage reservations. The browser supplies a selected `childId`, but the backend scopes every child/personalisation lookup to the authenticated household. Invalid bearer tokens never fall back to guest access.

The n8n website webhook remains a server-side integration boundary that must be restricted or cryptographically authenticated; validating the MentorContext shape alone cannot prove that a request originated from the APPU backend.

## Phase 2 target

```text
Web UI
  -> Appu Backend
  -> authentication
  -> household/child ownership
  -> subscription
  -> entitlement
  -> security rate limit
  -> atomic quota reservation
  -> sanitised child context
  -> n8n
  -> Appu AI
  -> ElevenLabs through n8n when entitled
  -> usage reconciliation
  -> response
```

The backend—not n8n or the browser—is the authority for authentication, ownership, subscription status, entitlements, quota, pricing, and payment activation.

## Recommended provisional technology

- Keep the existing Phase 1 frontend during the initial backend milestones.
- Add a Node.js/TypeScript/Fastify backend.
- Use PostgreSQL, preferably managed through Supabase pending final approval.
- Use managed parent authentication with server verification.
- Use Razorpay Subscriptions and Standard Checkout in test mode first.
- Use database-driven plans and typed entitlements.
- Use an append-only usage ledger plus atomic reservations.
- Use household tenancy and per-child context isolation.

Hostinger Node.js availability remains unconfirmed. If the account supports Node.js Web Apps, prefer a same-origin deployment. Otherwise keep the static site and host the API on a separate managed runtime/edge-function platform with strict origin and session controls.

## Product principles

- Parent owns the account and billing relationship.
- Each child has isolated preferences, learning context, conversation context, and usage.
- Explicit preferences, learning context, and conversation context remain separate.
- Personalisation uses approved tokens; never accept arbitrary CSS/fonts/colours.
- Paid resources are metered; never advertise or implement true unlimited AI/voice.
- Plan names, prices, and limits are data/configuration, not security logic.
- Browser claims never grant plans, entitlements, quota, or payment success.
- n8n orchestrates AI/voice but is not the security authority.
- Collect the minimum child data required for a useful experience.
- Legal wording and compliance conclusions require human review.
- Preserve Phase 1 until each adapter/cutover is tested.

## Current validation baseline

As of 2026-08-20:

- 8 Python structural tests pass.
- 8 Node voice contract/safety tests pass.
- Existing browser JavaScript passes syntax checks.
- The repository working tree was clean before Phase 2 documentation was created.

## Next action

Review `docs/PHASE2_ARCHITECTURE.md`, resolve or defer the Hostinger runtime decision, obtain a fresh sanitised live n8n export, and approve a detailed Milestone 1 implementation plan before application code changes.
