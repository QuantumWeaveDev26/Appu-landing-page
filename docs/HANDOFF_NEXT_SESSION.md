# AppuAI Project Comprehensive Handoff Briefing

**Date:** 26 October 2026 (IST)  
**Workspace:** `apollo-1788930525212` (`C:\Users\Naveen Reddy\AppData\Roaming\October\worktrees\Appu-landing-page\apollo-1788930525212`)  
**Main Directory:** `D:\office\Appu-landing-page`  
**Git Remote:** `https://github.com/QuantumWeaveDev26/Appu-landing-page.git`  
**Active Work Branch:** `develop`  
**Current Commit (HEAD):** `4b9d622`  
**Production Branch:** `main` (synced and fast-forwarded to `4b9d622`)  
**Live Frontend Branch:** `frontend-production` (deployed via GitHub Actions)  
**Live URLs:**
- Website: `https://appuai.online`
- Backend API: `https://api.appuai.online`
- n8n Brain: `https://n8n.srv1871828.hstgr.cloud` (Workflow: `drr7AUOcj1VrU0j8`)

---

## 1. Quick Start for the Incoming Agent

When you start your session, run these commands to verify the environment is 100% green:

```bash
# 1. Run all 454 frontend tests
node --test tests/*.test.js

# 2. Check monorepo duplicate file prevention (strictly 0 allowed)
node tests/check-no-duplicates.cjs

# 3. Audit frontend bundle static dependencies
node tests/audit-frontend-bundle.cjs

# 4. Check HTML structure & asset cache version pin
python tests/page-structure.test.py

# 5. Check backend TypeScript compilation
cd backend && npx tsc --noEmit && cd ..

# 6. Check backend conversation history & quiz protocol tests
cd backend && node --import tsx --test tests/*conversation*.test.ts tests/*quiz*.test.ts && cd ..
```

---

## 2. Project Architecture & Deployment Rules

1. **Monorepo Structure:**
   - `frontend/`: Pure vanilla JavaScript, CSS, and HTML. There is **NO** webpack/vite build step for the website; browser loads modules directly.
   - `backend/`: Fastify + TypeScript application (`backend/src/`). Node.js 22+.
   - `native/`: React Native Expo app (built separately via EAS).
   - `tests/`: Node native test runner (`node --test`), Python tests, and audit scripts.
   - `docs/`: Architecture, deployment guides, and QA reports.

2. **Single Canonical File Rule:**
   - Every frontend file lives strictly inside `frontend/`.
   - Never duplicate frontend scripts (e.g. `app.js`, `style.css`) into the repo root. `tests/check-no-duplicates.cjs` strictly enforces this.

3. **Asset Cache Versioning (`?v=`):**
   - Current release asset query string is `?v=20261026-01`.
   - All 25 references in `frontend/index.html` (4 CSS links + 21 script tags) MUST have matching `?v=` query strings.
   - Pinned in `tests/page-structure.test.py` (`test_release_version_query_strings_bumped`). If you bump it, update both files.

4. **Deployment Pipeline:**
   - Pushing to `origin/main` automatically triggers `.github/workflows/deploy-frontend.yml`.
   - The workflow runs all tests and audits, then publishes `frontend/` to the orphan branch `frontend-production`.
   - Hostinger serves the live website (`https://appuai.online`) directly from `frontend-production`.
   - Hostinger git integration tracks `main` for the backend (`https://api.appuai.online`).

---

## 3. Current State & Recent QA Repairs (F01–F19)

Detailed finding-by-finding report is in `docs/qa/appuai-2026-10-24/FIX_STATUS.md`.

### Completed & Deployed Fixes:
- **F01 (Menu Overlay):** Drawer overlay, scrim, and backdrop blur are synchronously closed and reset before stage or lesson card renders.
- **F02 (Curriculum Badges):** Official NCERT 2026-27 catalogue (`frontend/curriculum-catalogue.js`) cross-checks grade and chapter. Misattributed chapters display "Related chapter: Class X Chapter Y" or are omitted; verified chapters render direct links to official NCERT ePathshala textbook PDFs.
- **F03 (Chat Order):** Deterministic SQL tie-breaker ensures user questions strictly sort before assistant answers when timestamps share the same second.
- **F05 (Progress Labels):** Header XP stars, title, level, and next-level indicator dynamically bind to the gamification progress model.
- **F06 (Modal Focus):** `setBackgroundInert(true)` makes background elements inert while modals are open, trapping Tab/Shift+Tab focus.
- **F07 (Discovery Modal Link):** Navigating to `index.html#discovery` (from `contact-us.html` or `pricing.html`) captures the hash at initial script evaluation, waits for the view to settle (~600ms), and automatically opens `#discovery-modal`. `hashchange` listener also handles in-page clicks.
- **F09 (Document Teaching Latency):** Added attempt indicators (`attempt 1/2`) and interactive "Cancel" / "Try again" action buttons that preserve uploaded text and files.
- **F10 (Pasted Notes Validation):** Code-point counter enforces `NOTES_PASTE_MAX = 16000`, disables submission when trimmed content is empty, and displays an accessible `#notes-paste-error` alert.
- **F12 (Mobile Study Toolbar):** At 390×844 mobile viewport, toolbar is given `min-height: 44px`, `flex-shrink: 0`, and horizontal scroll discovery to prevent 16px vertical clipping.
- **F13 (Signup CTA Routing):** Banner "Try Beta — Sign Up Free" and guest modals explicitly pass `authMode: 'signup'` to `openModal()`, correctly opening the Create Account tab instead of Sign In.
- **F14 (Prose Headings):** Prevented heuristics from turning the first 3 words of natural introductory sentences into arbitrary headings; only semantic sections become mind map branch headings.
- **F15 (Duplicate Footer):** Extra landing footer hidden; lesson block labels localized in English, Kannada, and Hindi.
- **F16 (Podcast Accessible Name):** Centrally manages button icon, visible text, accessible label ("Pause Appu Audio Lesson" / "Resume Appu Audio Lesson"), and ARIA progressbar.
- **F17 (Subscription Button):** Displays an informative banner explaining that billing plans are paused during beta rather than doing a silent no-op.
- **F18 (Conversational Quiz Grading):** Deterministic question/answer tracking protocol (`backend/src/domain/quiz/protocol.ts` and `service.ts`). Stored responses score deterministically (5/5) from structured state.
- **F19 (Quiz Ambiguity):** Quiz protocol prompt rules require unambiguous single best answers with specified baseline conditions.

---

## 4. Pending Product Decisions

These items were reviewed during QA and flagged for stakeholder alignment (do NOT invent arbitrary policies):

1. **F04 (Beta Chat Limit):**
   - Marketing on `pricing.html` and backend default `APPU_BETA_CHAT_LIMIT` say **30 free chats**.
   - Client `frontend/appu-config.js` sets `betaChatLimit: 5` (matching visitor guest quota).
   - Needs stakeholder confirmation whether registered parents receive 30 chats or 5 chats.

2. **F08 (WhatsApp Mandatory vs Optional):**
   - `frontend/parent-setup-ui.js` displays "Connect your WhatsApp — REQUIRED".
   - `privacy-policy.html` states that parent phone and messaging consent are optional.
   - Needs product confirmation whether WhatsApp onboarding is strictly mandatory or optional.

3. **F11 (Progress Report Gating):**
   - `POST /api/children/:childId/report` and `parent-reports-ui.js` require a star rating and feedback before generating a progress report.
   - Needs product confirmation whether to decouple report generation from mandatory star ratings.

4. **F07 (Public Fallback Contact):**
   - `contact-us.html` links to online booking (`index.html#discovery`).
   - For signed-out visitors who cannot book online, an authoritative public email address and phone number are needed (do not invent placeholder contact details).

---

## 5. Pending Backend / n8n Operations (Optional)

1. **n8n Workflow Brain:**
   - Draft version of workflow `drr7AUOcj1VrU0j8` prepends `$json.quizProtocol` to prompt input. Can be published in n8n when convenient. (Rollback version: `25521c88-bf8b-4bd3-b950-3567c01ee1f8`).
2. **Database Migration:**
   - Additive migration `backend/db/migrations/025_conversation_quiz_items.sql` (`CREATE TABLE IF NOT EXISTS conversation_quiz_items`) can be executed against production PostgreSQL via `npm run migrate`.

---

## 6. How to Continue Development

When making new changes:
1. Work on branch `develop`.
2. Keep edits modular and add regression tests in `tests/`.
3. Run the 6 verification commands from Section 1.
4. Commit with descriptive messages.
5. To release: fast-forward `main` to `develop` and push `main` to trigger the GitHub Actions live deployment.
