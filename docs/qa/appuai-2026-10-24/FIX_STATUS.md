# AppuAI QA Repair Status Report (24 October 2026 Findings)

**Date of Verification:** 26 October 2026 (IST)  
**Baseline QA Report:** 24 October 2026 (`REPORT.md`, `ACCEPTANCE.md`, `FIX_REQUEST.md`)  
**Worktree:** `apollo-1788930525212`  
**Branch:** `develop`  
**Asset Release Version:** `?v=20261026-01`  
**Deployment State:** Local worktree committed/staged only. **NO production deploy, NO git push to main or origin/develop, NO production database migration executed, and NO n8n workflow draft published.**

---

## Executive Summary

| Category | Findings | Count |
|---|---|---|
| **Fixed** | F01, F02, F03, F05, F06, F07, F09, F10, F12, F13, F14, F16, F17, F18 | 14 |
| **Fixed via Protocol (Sample Verified)** | F19 | 1 |
| **Partially Fixed** | F15 (Landing duplicate footer removed, 4 core lesson card labels localized in EN/KN/HI; report/upload subdialogs remain English, native educational linguist review pending) | 1 |
| **Decision Required** | F04 (Beta chat allowance: 5 vs 30), F08 (WhatsApp mandatory vs optional), F11 (Report gated behind star rating), F07 (Fallback public contact details) | 3 (+1) |
| **Total Findings** | F01–F19 | 19 |

---

## Finding-by-Finding Status (F01–F19)

| ID | Title & Severity | Status | Reproduced Root Cause | Changed Files & Commits | Regression Tests Executed | Verification Evidence | Remaining Decisions & Limitations |
|---|---|---|---|---|---|---|---|
| **F01** | Saved lesson strands invisible menu overlay (P1) | **Fixed** | `SavedLessonsUI.studyLesson()` and `ParentReportsUI.openModal()` opened panels or stage without dismissing `#nav-drawer` and its scrim, leaving `aria-hidden="false"` on the off-screen drawer and backdrop blur active. | `frontend/app.js`, `frontend/saved-lessons-ui.js`, `frontend/parent-reports-ui.js`<br>`d410c2b` | `tests/qa-2026-10-24-drawer.test.js` (5/5 pass) | Drawer overlay, scrim, and backdrop blur are synchronously closed and reset before stage or lesson card renders. | None. Verified in DOM & integration suite. |
| **F02** | Generated curriculum sources incorrectly attributed (P1) | **Fixed** | Source badges generated hallucinated, unverified attributions (e.g. attributing Class 11 Biology *Photosynthesis in Higher Plants* as Class 8 Science) with unlinked plain text. | `frontend/curriculum-catalogue.js`, `frontend/lesson-card-renderer.js`, `frontend/index.html`<br>`7ad7232` | `tests/qa-2026-10-24-curriculum-source.test.js` (7/7 pass) | Official NCERT 2026-27 catalogue cross-checks grade and chapter. Misattributed chapters display "Related chapter: Class X Chapter Y" or are omitted; verified chapters render direct links to official NCERT ePathshala textbook PDFs. | Covers NCERT Science & Math Classes 6–10. Non-catalogue topics omit source badge rather than inventing attribution. |
| **F03** | Restored chat puts answer before question (P2) | **Fixed** | Messages sharing coarse same-second `created_at` timestamps sorted arbitrarily in PostgreSQL queries, resulting in assistant responses displaying above user prompts on reload. | `backend/src/domain/conversation/repository.ts`, `backend/src/domain/report/service.ts`<br>`7f163d8` | `backend/tests/conversation-history.test.ts` (11/11 pass) | Deterministic SQL tie-breaker: user turn strictly sorts before assistant turn when timestamps match. `appendSuccessfulExchange` stamps answer after question. No database migration required. | None. Existing historical messages remain intact. |
| **F04** | Signup offers disagree: 30 vs 5 free chats (P2) | **Decision Required** | `pricing.html` offers 30 complimentary personalised chats; `frontend/appu-config.js` sets `betaChatLimit: 5` (matching visitor guest limit). Backend `APPU_BETA_CHAT_LIMIT` default is 30, but runtime prod environment setting is unknown. | `frontend/appu-config.js`, `frontend/pricing.html`, `backend/src/config.ts` | `tests/appu-config.test.js`, `tests/guest-access-ui.test.js` | Discrepancy isolated between marketing copy (30) and client configuration (5). Normal registered parent quota enforcement cannot be validated with the admin test account. | **Product Decision Required:** Confirm whether registered parents receive 30 complimentary chats or 5 during beta. |
| **F05** | Progress labels disagree with actual progress (P2) | **Fixed** | Header XP button `aria-label` was hardcoded to "XP Stars: 120" and title to "Level 2: Curious Explorer". Quest modal calculated `currentLvlInfo.level` instead of `+ 1` for next level. | `frontend/app.js`, `frontend/index.html`<br>`f4b837a` | `tests/qa-2026-10-24-ui-fixes.test.js` ("F05: XP accessible name, level title...") | Dynamic binding connects `state.xp`, `levelPill.title`, `aria-valuenow`, and `#game-next-level` to the central gamification progress model. | None. Verified in test suite. |
| **F06** | Parent setup modal does not contain keyboard focus (P2) | **Fixed** | Parent setup modal lacked modal backdrop inerting; pressing Shift+Tab from modal close button escaped the modal into the underlying page composer. | `frontend/parent-setup-ui.js`<br>`f4b837a` | `tests/qa-2026-10-24-ui-fixes.test.js` ("F06: the parent setup modal makes the rest of the page inert...") | `setBackgroundInert(true)` marks background sibling elements `inert = true` while modal is open, trapping focus within the active dialog and restoring previous inert states upon `closeModal()`. | Tested via browser `inert` in synthetic DOM; physical screen reader verification pending. |
| **F07** | Support scheduling link returns to landing page (P2) | **Fixed** *(with decision required on fallback contact)* | `contact-us.html` and `pricing.html` linked to `index.html#discovery`. `landing-page.js` `showLanding()` cleared `url.hash = ''`, and `app.js` lacked logic to detect `#discovery` and open `#discovery-modal`. | `frontend/app.js`, `frontend/landing-page.js`, `tests/qa-2026-10-24-ui-fixes.test.js` | `tests/qa-2026-10-24-ui-fixes.test.js` ("F07: #discovery hash is captured at init and opens discovery booking modal") | `app.js` captures `initialLocationHash` at script evaluation time, checks `#discovery` on DOM ready and after landing settles (~600ms), and calls `openDiscoveryModal()`. Listens to `hashchange`. `closeDiscoveryModal()` clears `#discovery`. Booking form submission is NOT triggered in automated tests to avoid fake lead generation. | **Product Decision Required:** Official fallback contact info (support email/phone) for signed-out users who cannot book online; no placeholder details invented. |
| **F08** | WhatsApp marked REQUIRED despite optional policy (P2) | **Decision Required** | Basic Profile displays "Connect your WhatsApp — REQUIRED", whereas `privacy-policy.html` states that parent phone and messaging consent are optional. | `frontend/parent-setup-ui.js`, `frontend/privacy-policy.html` | `tests/parent-setup-ui.test.js`, `tests/whatsapp-note-share.test.js` | Native inputs currently lack `required` HTML attributes; consent was unchecked in inspected QA profile. | **Product Decision Required:** Confirm whether WhatsApp onboarding is strictly mandatory for registered accounts or optional per the privacy policy. |
| **F09** | Document teaching long latency with unclear retry feedback (P2) | **Fixed** | When document teaching or visual generation took long or timed out, the UI displayed a vague "Working it out" state without progress, attempt indicators, or a way for the learner to abort or retry. | `frontend/app.js`, `frontend/lesson-card-renderer.js`<br>`1f7c88f` | `tests/qa-2026-10-24-notes-retry.test.js` (6/6 pass) | Added explicit attempt counters (`attempt 1/2`), clear pending/retrying badges, and interactive "Cancel" / "Try again" action buttons that preserve the uploaded document and typed query. | Controlled network latency benchmark not performed; UI recovery mechanisms verified. |
| **F10** | Whitespace notes have no validation message & oversized input enabled (P2) | **Fixed** | Whitespace-only notes enabled submission without explaining why teaching failed; text > 16,000 characters was allowed to submit and lacked inline error messaging. | `frontend/app.js`, `frontend/index.html`<br>`56c0b19` | `tests/qa-2026-10-24-ui-fixes.test.js` ("F10: pasted notes are validated by trimmed content...") | `checkPastedNotes()` uses Unicode code points (`Array.from(val).length`), disables submission when trimmed text is empty, enforces `NOTES_PASTE_MAX = 16000`, and displays an accessible `#notes-paste-error` alert. | None. Verified at 0, 15,999, 16,000, 16,001, and 17,000 characters. |
| **F11** | Reports gated behind feedback rating (P2) | **Decision Required** | `POST /api/children/:childId/report` and `parent-reports-ui.js` require a star rating and feedback submission before generating a child progress report (`HTTP 403 feedback_required`). | `backend/src/routes/reports.ts`, `frontend/parent-reports-ui.js` | `backend/tests/reports.test.ts` | Code requires prior feedback row in `family_feedback` table before issuing report. | **Product Decision Required:** Product stakeholder decision needed on whether to decouple progress report generation from mandatory star ratings. |
| **F12** | Mobile study toolbar clips 44 px tabs into 16 px strip (P1) | **Fixed** | Flex container rules and insufficient `min-height` in `style.css` allowed `.study-toolbar` / `.study-modes-tabs` to compress down to 16px when constrained on mobile screens (390×844), clipping the 44px buttons. Wheel/touch events lacked horizontal scroll discovery. | `frontend/style.css`, `frontend/lesson-card-renderer.js`<br>`0b9347e` | `tests/qa-2026-10-24-mobile-study-tabs.test.js` (7/7 pass) | Enforced `flex-shrink: 0`, explicit touch target min-heights (44px), scroll fade indicators, and horizontal touch/wheel scroll handling. Verified at 390px, 768px, and 1366px viewports. | Real physical phone hardware swipe check pending emulated browser tests. |
| **F13** | Signup CTA opens Sign In (P3) | **Fixed** | Banner "Try Beta — Sign Up Free" and guest limit modal "Create Free Account" opened `ParentSetupUI.openModal()` without explicitly resetting the active tab to Sign Up, inheriting the last-used mode (defaulting to Sign In). | `frontend/app.js`, `frontend/parent-setup-ui.js`<br>`f4b837a` | `tests/qa-2026-10-24-ui-fixes.test.js` ("F13: sign-up CTAs open Create Account...") | Explicitly passes `authMode: 'signup'` or `'signin'` to `openModal(step, authMode)`, switching active tabs and header title every time. | None. Verified in unit tests. |
| **F14** | Guest answer renderer breaks prose into arbitrary headings (P3) | **Fixed** | `lesson-card-renderer.js` heuristic parsed the first 3 words of every introductory sentence into mind map branch headings (e.g. "That beautiful reddish", "Imagine sunlight as"). | `frontend/lesson-card-renderer.js`<br>`f4b837a` | `tests/qa-2026-10-24-ui-fixes.test.js` ("F14: plain prose never becomes first-three-word headings...") | Disallowed sentence fragment splitting; natural prose is retained as full descriptive paragraphs, while structured sections (e.g. "Inputs:", "Steps:") are parsed into semantic branch nodes. | None. Verified against sample transcripts. |
| **F15** | Duplicate footer and partial localisation (P3) | **Partially Fixed** | Landing page contained duplicate footer markup (`.landing-footer-strip` and `.landing-marketing-footer`). Lesson card block labels ("Think of it like this", "Step by step", "Quick check", "Tap step to explore") were hardcoded in English. | `frontend/style.css`, `frontend/lesson-card-renderer.js`<br>`28af85d`, `0a12b1a` | `tests/qa-2026-10-24-ui-fixes.test.js` ("F15: one footer on the landing page...") | Duplicate footer hidden via CSS rules. Lesson block labels localized across English, Kannada, and Hindi. | **Limitations:** Upload and report subdialog strings remain in English; native educational Kannada and Hindi linguist review recommended. |
| **F16** | Podcast play/pause accessible name is stale (P3) | **Fixed** | While the visible podcast icon toggled between play and pause, the accessible `aria-label` stayed "Play Appu Audio Lesson". Progress was not exposed via ARIA. | `frontend/lesson-card-renderer.js`<br>`f4b837a` | `tests/qa-2026-10-24-ui-fixes.test.js` ("F16: the podcast button accessible name follows...") | `setPlayButton()` centrally manages icon, visible label, and accessible name ("Pause Appu Audio Lesson", "Resume Appu Audio Lesson"). Added `role="progressbar"` with `aria-valuenow`. | Audio synthesis acoustic quality not evaluated; accessibility names verified. |
| **F17** | Subscription button has no visible outcome in admin view (P3) | **Fixed** | Clicking "Manage Subscription Plans" in the profile modal was a silent no-op for accounts without an active Razorpay subscription or during beta where paid plans are paused. | `frontend/parent-setup-ui.js`<br>`81aea2c` | `tests/qa-2026-10-24-ui-fixes.test.js` | Replaces silent no-op with an informative banner explaining that paid plans are paused during beta, displaying current entitlement details. | Normal-parent account live billing test pending commercial plan unpausing. |
| **F18** | Conversational quiz invents wrong answer and miscalculates score (P1) | **Fixed** | In conversational five-question quiz mission, score and past answers were reconstructed by the LLM from chat prose. In the QA scenario, Q4 accepted "oxygen" ("Exactly!"), but the LLM later hallucinated that the user answered "carbon dioxide", wrongly scoring 4/5. | `backend/src/domain/quiz/protocol.ts`, `backend/src/domain/quiz/service.ts`, `backend/src/domain/quiz/index.ts`, `backend/db/migrations/025_conversation_quiz_items.sql`, `backend/src/routes/appu-gateway.ts`<br>`47aaab2` | `backend/tests/conversation-gateway.test.ts` (10/10 pass) | Added deterministic question/answer tracking protocol. Stored responses score deterministically (5/5). Model output prose is anchored to backend score. Live-model evidence recorded in `evidence/f18-live-quiz-after-fix.txt`. | Rollout pending: requires n8n workflow draft publish and migration `025` execution on deployment. |
| **F19** | Multiple-choice question has ambiguous single best answer (P2) | **Fixed via Protocol** | Q5 asked what factor affects photosynthesis "the most" without specifying environmental limiting conditions, creating ambiguity under Blackman's Law of Limiting Factors (NCERT Biology §11.10). | `backend/src/domain/quiz/protocol.ts`, n8n prompt rules<br>`47aaab2` | `backend/tests/conversation-gateway.test.ts` | Quiz protocol rules enforce unambiguous single best answers under stated baseline conditions. | Sample verified; ongoing prompt monitoring for newly generated quiz topics. |

---

## Test Verification Summary

All automated checks executed and passing on branch `develop` (HEAD at asset version `20261026-01`):

1. **Frontend Test Suite:** `node --test tests/*.test.js`
   - **Result:** 454 passed / 0 failed (58 test suites, duration ~18s)
2. **Duplication Audit:** `node tests/check-no-duplicates.cjs`
   - **Result:** 0 duplicates found across all 38 canonical frontend files.
3. **Bundle Integrity Audit:** `node tests/audit-frontend-bundle.cjs`
   - **Result:** 0 static dependency errors, 0 security violations.
4. **HTML Page Structure Tests:** `python tests/page-structure.test.py`
   - **Result:** 12 passed / 0 failed (verifies all 25 `?v=20261026-01` asset query strings).
5. **Backend Typecheck:** `cd backend && npx tsc --noEmit`
   - **Result:** Clean TypeScript compilation with 0 type errors.
6. **Backend History & Quiz Tests:** `cd backend && node --import tsx --test tests/*conversation*.test.ts tests/*quiz*.test.ts`
   - **Result:** 39 passed / 0 failed (5 suites, duration ~7.3s).

---

## Unverified Areas & Explicit Limitations

In compliance with `ACCEPTANCE.md` and `FIX_REQUEST.md`:
- **Physical Mobile Devices:** Verified under emulated 390×844 and 768×1024 viewports in Chromium; physical iOS Safari and Android Chrome touch interactions were not physically tested.
- **Screen Reader Navigation:** Focus trapping verified via DOM `inert` property attributes and synthetic Tab/Shift+Tab tests; physical NVDA/JAWS/VoiceOver sweeps have not been conducted.
- **Normal-Parent Account Entitlements:** Testing was executed using the supplied Admin Unlimited Access account; normal registered-user quota exhaustion (5 vs 30) requires confirmation of F04.
- **Live Payments & WhatsApp Delivery:** Live Razorpay checkout and WhatsApp webhook message delivery were not executed with real credentials.
- **Live Microphone Recognition:** Audio playback state and controls verified; live speech-to-text recognition under ambient room noise was not re-benchmarked.

---

## Pending Product Decisions

1. **F04 (Beta Chat Limit):** Align marketing copy (30 on `pricing.html` and backend default) with frontend client configuration (5 in `appu-config.js`).
2. **F08 (WhatsApp Requirement):** Confirm whether WhatsApp number and consent are compulsory or optional during parent onboarding.
3. **F11 (Progress Report Gating):** Confirm whether progress reports should remain gated behind a star rating and feedback submission.
4. **F07 (Fallback Contact):** Provide authoritative public support email address and phone number to present on `contact-us.html` for visitors unable to book via the online calendar.

---

## Rollout & Rollback Instructions (Execute only when user instructs to deploy)

### Rollout Steps:
1. **n8n Workflow Brain:** Publish draft version of APPU Mentor workflow (`drr7AUOcj1VrU0j8`), which prepends `$json.quizProtocol` to prompt input.
2. **Database Migration:** Run additive database migration `025_conversation_quiz_items.sql` against production PostgreSQL (`npm run migrate`).
3. **Deploy Develop:** Fast-forward push `develop` to `origin/develop` and merge/push to `main`.

### Rollback Steps:
1. **n8n Workflow:** Revert workflow `drr7AUOcj1VrU0j8` to published version `25521c88-bf8b-4bd3-b950-3567c01ee1f8`.
2. **Database Migration:** Run `DROP TABLE IF EXISTS conversation_quiz_items CASCADE;`.
3. **Deploy Revert:** Revert commit on `main` to `81aea2c` or previous stable release tag.
