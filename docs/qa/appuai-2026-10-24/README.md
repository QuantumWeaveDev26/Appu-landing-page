# AppuAI repair handoff

Prepared 26 October 2026 from the live functional QA performed on 24 October 2026. This is a historical test baseline, not a retest of the current deployment.

## Put this folder in the existing project workspace

Copy this folder to `docs/qa/appuai-2026-10-24/` inside the project repository. Keep the application source in its existing locations. Do not replace source files with this folder.

Read in this order:

1. `FIX_REQUEST.md` — the task to give the coding assistant.
2. `REPORT.md` — all 19 findings, reproduction steps, observed results, priorities and coverage limits.
3. `ACCEPTANCE.md` — checks required to close each finding.
4. `evidence/` — screenshots and the conversational quiz transcript.
5. `fixtures/` — synthetic homework PNGs, PDF/TXT notes, an oversized TXT and an unsupported CSV for reproduction.

If only one document can be uploaded, upload `REPORT.md` and paste `FIX_REQUEST.md` into the chat. For reliable reproduction, provide the whole folder or ZIP.

## Existing project material the coding assistant may need

The project workspace should already contain the frontend source, dependency manifest/lockfile, API/backend source, relevant database schema and migrations, and existing tests. If any part is developed separately, provide that part as well. Provide relevant n8n workflow exports only if they actually implement the affected tutoring, grading, notes, reporting or messaging paths; use sanitized exports without credentials. Include a short deployment/environment map identifying which service owns each feature and which environment is staging.

Use an `.env.example` with names/placeholders when configuration context is needed. Do not upload production `.env` files, API keys, OAuth tokens, database passwords, real learner data, `node_modules`, generated build folders or unrelated backups.

The report did not inspect implementation code. File names, root causes and required schema changes must be established from the actual project. Some findings may already be fixed in commits after the test date; verify before changing them.

## Product decisions to resolve from existing configuration/documentation

- Registered beta allowance: pricing said 30 personalised chats; signup said 5. Guest five-question access is a separate allowance. Do not silently pick a registered allowance or modify entitlements just to match a label.
- WhatsApp number/consent: UI said required; privacy copy said optional. Confirm intended behaviour and align implementation and copy.
- Reports: the feedback gate is a product recommendation, not proof that report generation is broken. Confirm whether feedback should be optional; do not fabricate a user rating.
- Billing: payments were held during beta. Do not enable billing or start transactions to fix a nonresponsive subscription button.

The supplied QA account was Admin Unlimited Access. Verification of normal parent quotas, multi-child isolation, registration and paid plans requires suitable test accounts/environments. A screenshot of an admin screen is not evidence that ordinary-user entitlements work.
