# APPU — Feature & Status Overview

Last updated: 2026-09-15 · Stage: **Public Beta (live in production)**

This is the single up-to-date snapshot of what APPU is, what ships today, and what's next.
For deep dives see the per-feature specs under `docs/superpowers/specs/` and the runbooks in `docs/`.
Repository code is the source of truth where docs and code disagree.

---

## 1. Product

APPU is a personalised AI learning companion for CBSE students (Classes 5–12), by **IGR Academy**.
It is **one product with one shared learning record per child**, reached through three channels:

- **Website** — `https://appuai.online`
- **Native Android app** — React Native / Expo (separate from the website, same backend)
- **WhatsApp** — Meta Business Cloud

Parents are the account owners: they sign in, personalise the tutor for their child, and receive
progress reports. A student can start on one channel and continue on another — the tutor remembers them.

Languages: **English, Kannada, Hindi**.

---

## 2. Architecture (six parts)

| Part | Where | Role |
|------|-------|------|
| Website | `appuai.online` (Hostinger) | Public site + learning UI (vanilla HTML/CSS/JS) |
| Native app | `online.appuai.appu` (Android) | True native app (React Native, Expo SDK 57, EAS) |
| WhatsApp | Meta Graph API | Two-way tutoring, onboarding, proactive sends |
| Backend API | `api.appuai.online` (Hostinger Node) | Source of truth: auth, households, children, personalisation, history, entitlements, reports (Fastify + TypeScript) |
| Database | Supabase Postgres (`cmulkkpinwernuzhtegp`) | Child-scoped data; SQL migrations through **019** |
| AI workflow | n8n "APPU Mentor" (`drr7AUOcj1VrU0j8`) | LLM agent (OpenAI), WhatsApp routing, report/analysis, crons |

Backend ↔ n8n calls are **HMAC-SHA256 signed** (`v1=` prefix over `timestamp + "." + rawBody`).
The child-scoped `conversation_messages` table means web, app, and WhatsApp all feed the **same memory per child**.

---

## 3. What's shipped (all LIVE unless marked)

### Access & personalisation
- **5 free guest chats, then sign-in gate** (web + app). Guests get 5 chats; continuing requires sign-in + child personalisation. Guest limit enforced backend-side (`DEFAULT_MAX_TURNS = 5`).
- **Child personalisation** — name/nickname, grade, DOB, favourite subjects, interests, learning style, response style, goals, primary language. The tutor greets/teaches the child by name on every channel. (Root fix: the n8n system message reads `mentorContext` in Expression mode.)
- **Sign-in with email or Google** (web + native, `signInWithIdToken`).

### Learning experience
- **Conversational tutor** with learning missions (explain, quiz, homework help, exam practice).
- **Voice** — STT input (`expo-speech-recognition` on native; Web Speech on web) + audio replies; hands-free live mode with restart rate-limiting.
- **Chat history** per child, synced across web and app.
- **Shared memory per child** — one learning record across channels.

### WhatsApp
- **New-user onboarding inside WhatsApp** — an unknown number is walked through setup one field at a time (name→grade→dob→subjects→language→interests→learning style→response style→goals→explicit consent), saved as a **phone-only household**, then chats personalised. No schema migration required (households have no auth-user requirement).
- **Recognised numbers** load the child's profile + recent history via `WhatsAppContextService`.
- **Proactive sends** — weekly parent digest, daily study tip, birthday wish, study reminders (with a 0-OAuth calendar link). Cron-driven; consent-gated.

### Reports & feedback
- **Child performance report (PDF)** — `POST /api/children/:childId/report`. Reads the child's `conversation_messages` + personalisation, an LLM produces a structured JSON report (overall score, per-subject bars, strengths, improvements, topics, recommendations), rendered to a designed PDF (`@react-pdf/renderer`). Household-scoped (no IDOR), feedback-gated. Downloadable on web/app; sent as a WhatsApp document.
- **Parent feedback gate** — one-time structured feedback (rating 1–5 + what's-working + what-to-improve, **both required**) unlocks reports for the family. Migration `019_family_feedback`.
- **Feedback → Google Sheet** — every submission (web + WhatsApp) fire-and-forgets to an n8n webhook → appends to the "Parent Feedback" tab of the team Google Sheet.
- **Feedback prompt after 12 chats** — signed-in parents hit a non-dismissable feedback gate after `feedbackChatThreshold` (12) chats and must submit before continuing (web + app).

### Native Android app
- **True native app** (React Native), separate from the website, sharing the backend. Distributed as installable APKs via EAS for testing.
- **Parent Zone** — learner setup, personalisation, reports tab, PDF download/share (`expo-file-system` / `expo-sharing`).
- **Google Play release** — *planned* (signed AAB, store listing, Families policy).

---

## 4. Key flows

**New learner (web/app):** 5 free guest chats → sign-in gate → create account → set up child + personalisation → personalised tutoring.

**New number on WhatsApp:** first message → Appu asks each detail one at a time → phone-only profile + consent saved → personalised tutoring.

**Progress report:** parent submits one-time feedback → reports unlock → generate a fresh AI report on demand → download PDF (web/app) or receive on WhatsApp.

**One memory per child:** all chats stored scoped to the child → web/app/WhatsApp write to the same record → reports read the full record → the tutor is consistent everywhere.

---

## 5. Infrastructure & deployment

- **Repo:** `github.com/QuantumWeaveDev26/Appu-landing-page`, branch `main`.
- **Website:** push `main` → GitHub Action (`.github/workflows/deploy-frontend.yml`) validates + publishes `frontend/` to the `frontend-production` branch → Hostinger serves it. Cache-bust `?v=YYYYMMDD-N` pinned in `index.html` and `tests/page-structure.test.py`. **Current: `v=20260915-4`.**
- **Backend:** Hostinger managed Node auto-builds from `main` (tsc, **`--omit=dev` install** — any type package the build needs must be in `dependencies`, not `devDependencies`). A failed build or new env var needs a **Deploy / Restart** in hPanel.
- **Database:** versioned SQL migrations run against Supabase, applied by the team (never automatically). Currently through `019`.
- **n8n:** production-gated — changes are staged via the n8n API then **published** to activate. The ~16K-char tutor system message is fragile; edited with care (kept in Expression mode).
- **Note:** `api.igr.academy` is a separate/legacy Hostinger app; the live backend everything calls is `api.appuai.online`.

### Secrets
Never in docs or code. API keys, tokens, the HMAC callback secret, and the Supabase service/web client secrets live only in their secure stores (hosting env vars, Supabase, n8n credentials). Identifiers in this doc are references, not credentials.

---

## 6. In progress & next

- **In progress** — automated project tracking to Trello (secure n8n Trello credential + a log webhook).
- **Planned** — Google Play release of the native app (signed AAB, listing, Families policy).
- **Planned** — "link later" account merge (WhatsApp phone-only profile ↔ web account); held until phone-OTP verification is added, to keep it safe from unverified-phone takeover.
- **In progress** — device QA (mic/voice + mobile input on specific Android devices, e.g. OnePlus 13R).

---

## 7. Reference (non-secret)

| Thing | Value |
|-------|-------|
| Website | `appuai.online` |
| Backend API | `api.appuai.online` |
| Supabase project | `cmulkkpinwernuzhtegp` |
| n8n workflow | `drr7AUOcj1VrU0j8` ("APPU Mentor") |
| EAS project | `@naveen.qwai/appu` |
| App packages | `online.appuai.appudev` (dev/preview), `online.appuai.appu` (prod) |
| Feedback sheet | Google Sheet · "Parent Feedback" tab |
| Latest DB migration | `019_family_feedback` |

### Team & process
Naveen maintains the project, working with an AI coordinator (plans/reviews) and an AI implementer
(builds), coordinated on a shared canvas. Work ships in small, reviewed changes to `main` and is
verified live before being marked done. Backend, native app, and n8n changes are reviewed before merge.
