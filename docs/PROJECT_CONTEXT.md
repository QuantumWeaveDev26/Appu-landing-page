# Appu Project Context

Last updated: 2026-08-20

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

The repository is currently a static application with no backend or database:

- `index.html` — child-facing single-screen Appu experience and dialogs.
- `style.css` — complete responsive design system.
- `app.js` — UI orchestration, chat, voice, language, settings, and Parent Zone.
- `chat-agent.js` — direct browser-to-n8n messages.
- `voice-engine.js` — browser speech recognition and returned-audio playback.
- `voice-contract.js` — n8n response normalisation.
- `avatar-stage.js` — Appu visual states.
- `tests/` — Phase 1 structural and voice safety/contract tests.
- `deploy/` and `deploy-to-hostinger.zip` — Hostinger static deployment artefacts.
- `scratch_workflow_raw.json` — stale n8n snapshot; not the current live topology.

No `package.json`, application server, authentication, database schema, migration system, or `.env.example` exists yet.

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

There is no trusted application boundary yet. The browser embeds and calls the public n8n webhook directly. It creates a short `localStorage` session ID that n8n currently uses for continuity. This ID is not authentication and must not become a child/tenant identity.

The Parent Zone also sends parent contact data directly to n8n and currently shows a fallback success state on request failure. This must be corrected when the backend flow is introduced.

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
