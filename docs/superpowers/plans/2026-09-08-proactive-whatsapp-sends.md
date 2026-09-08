# APPU Proactive WhatsApp Sends Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement automated, server-verified, proactive WhatsApp messages for parents:
1. **Weekly Parent Progress Digest (`appu_weekly_digest`)**: Sunday cron computing real weekly learner metrics (sessions attended, questions asked, topics explored, focus areas).
2. **Daily Morning Tip (`appu_daily_tip`)**: Daily cron delivering grade-adapted pedagogical tips from a curated pool.
3. **Birthday Greeting (`appu_birthday_wish`)**: Daily cron dispatching personalized birthday wishes to children whose birthday matches today.
4. **Production-Gated n8n Integration**: Replaces dangling, unauthenticated AI tool nodes with reliable, HMAC-secured dispatch pipelines to Meta Cloud API.
5. **Study Reminder Blueprint (`appu_study_reminder`)**: Architecture outline for Google Calendar/study schedule sub-phase.

**Tech Stack:** TypeScript, Fastify, PostgreSQL, Zod, Node.js crypto (HMAC-SHA256), Node.js test runner (`node --import tsx --test tests/<file>`), `pg-mem`.  
**Spec Reference:** [`docs/superpowers/specs/2026-09-08-proactive-whatsapp-sends-design.md`](file:///D:/office/Appu-landing-page/docs/superpowers/specs/2026-09-08-proactive-whatsapp-sends-design.md)  
**Template Checklist Reference:** [`docs/whatsapp-templates.md`](file:///D:/office/Appu-landing-page/docs/whatsapp-templates.md)

---

## Prerequisites & Authoritative Constraints
- **Zero Database Migrations Required:** Requisite columns (`households.parent_phone`, `households.whatsapp_consent`, `child_profiles.nickname`, `child_profiles.dob`, `child_personalisation`, `conversation_sessions`, `conversation_messages`) already exist in production through Migrations 001–017.
- **Strict Consent Enforcement:** Only households with `whatsapp_consent = TRUE` and `parent_phone IS NOT NULL` are selected.
- **HMAC Authentication:** Endpoints require `X-APPU-Timestamp` and `X-APPU-Signature` using `N8N_APPU_CALLBACK_HMAC_SECRET`.
- **Deterministic Content Generation:** Content generated purely from real database activity and curated pedagogical pools (zero third-party LLM dependencies during cron runs).
- **Template Language Configuration:** Defined as a configurable constant (`DEFAULT_TEMPLATE_LANGUAGE = 'en'`) matching Meta's exact English registration code rather than hardcoded `en_US`.
- **Test Setup Invariant:** All tests located in `backend/tests/` (plural) running via `node --import tsx --test tests/<file>` using the canonical `pg-mem` harness (`gen_random_uuid`, RLS-strip). Do NOT co-locate tests in `src/`.
- **Template Gate:** Live delivery of in-review templates (`appu_daily_tip`, `appu_birthday_wish`) in production n8n is gated on Meta approval; backend APIs and unit tests are built and verified immediately.

---

## Tasks Breakdown

### Task 1: Backend Proactive WhatsApp Repository & Data Queries

- [ ] **Step 1.1: Create Domain Types**
  Create `backend/src/domain/whatsapp/proactive/types.ts`:
  - `WeeklyActivityMetrics`: `sessionCount`, `questionCount`, `recentTopics: string[]`, `favoriteSubjects: string[]`.
  - `EligibleHouseholdTarget`: `householdId`, `childId`, `parentPhone`, `childName`, `gradeBand`, `dob`, `metrics?`.
  - `MetaTemplateParameter`: `{ type: 'text'; text: string }`.
  - `ProactiveTargetPayload`: `householdId`, `childId`, `recipientPhone`, `templateName`, `templateLanguage`, `parameters: MetaTemplateParameter[]`.
  - `ProactiveJobResponse`: `success: boolean; jobType: string; generatedAt: string; count: number; targets: ProactiveTargetPayload[]`.

- [ ] **Step 1.2: Implement `ProactiveWhatsAppRepository`**
  Create `backend/src/domain/whatsapp/proactive/repository.ts`:
  - `findEligibleHouseholds(db: Queryable)`:
    ```sql
    SELECT 
      h.id AS household_id,
      h.parent_phone,
      c.id AS child_id,
      c.preferred_name,
      c.nickname,
      c.grade_band,
      c.dob,
      COALESCE(p.favorite_subjects, '[]'::jsonb) AS favorite_subjects
    FROM households h
    JOIN child_profiles c ON c.household_id = h.id
    LEFT JOIN child_personalisation p ON p.household_id = h.id AND p.child_id = c.id
    WHERE h.whatsapp_consent = TRUE
      AND h.parent_phone IS NOT NULL
      AND c.status = 'ACTIVE'
    ORDER BY h.id, c.created_at ASC;
    ```
  - `getWeeklyActivityMetrics(db: Queryable, householdId: string, childId: string, sinceDate: Date)`:
    - Query active session count:
      ```sql
      SELECT id, title, updated_at
      FROM conversation_sessions
      WHERE household_id = $1 AND child_id = $2
        AND updated_at >= $3 AND expires_at > NOW()
      ORDER BY updated_at DESC;
      ```
    - Query user message count:
      ```sql
      SELECT COUNT(*) AS total_messages,
             COUNT(*) FILTER (WHERE m.role = 'user') AS user_question_count
      FROM conversation_messages m
      JOIN conversation_sessions s ON s.id = m.conversation_id
      WHERE s.household_id = $1 AND s.child_id = $2
        AND m.created_at >= $3;
      ```
  - `findBirthdayTargetsToday(db: Queryable, todayDate: Date)`:
    - Query children whose `EXTRACT(MONTH FROM dob)` and `EXTRACT(DAY FROM dob)` match `todayDate` in `Asia/Kolkata` timezone with parent consent.

- [ ] **Step 1.3: Unit Test Repository Operations**
  Create `backend/tests/proactive-whatsapp-repository.test.ts`:
  - Assert filtering: households with `whatsapp_consent = false` or `parent_phone = null` are excluded.
  - Assert activity metrics calculation correctly aggregates sessions, questions, and titles.
  - Assert birthday matching correctly matches month and day regardless of birth year.
  - Run `node --import tsx --test tests/proactive-whatsapp-repository.test.ts`.

---

### Task 2: Deterministic Content Generation Engine

- [ ] **Step 2.1: Curated Daily Tip Catalogue**
  Create `backend/src/domain/whatsapp/proactive/tip-catalogue.ts`:
  - Categorized by grade tier: `5-7`, `8-10`, `11-12`.
  - Array of practical, age-appropriate CBSE study tips.
  - Export `resolveGradeTier(gradeBand?: string | null): GradeTier`.
  - Export `getTipForDay(tier: GradeTier, date: Date, childName: string, subject?: string): string`.

- [ ] **Step 2.2: Implement Content Generators**
  Create `backend/src/domain/whatsapp/proactive/generators.ts`:
  - `WeeklyDigestGenerator.generate(target: EligibleHouseholdTarget, metrics: WeeklyActivityMetrics)`:
    - Variable `{{1}}`: `target.childName` (effective name: `nickname || preferredName`).
    - Variable `{{2}}`: Summarizes sessions, questions, topics (or friendly "ready to learn" fallback if 0).
    - Variable `{{3}}`: Focus topics and daily study habit recommendation.
    - Returns sanitized `MetaTemplateParameter[]` adhering to character limits and zero forbidden newlines.
  - `DailyTipGenerator.generate(target: EligibleHouseholdTarget, date: Date)`:
    - Variable `{{1}}`: `target.childName`.
    - Variable `{{2}}`: Pedagogical tip tailored by grade tier.
  - `BirthdayWishGenerator.generate(target: EligibleHouseholdTarget)`:
    - Variable `{{1}}`: `target.childName`.

- [ ] **Step 2.3: Implement `ProactiveWhatsAppService`**
  Create `backend/src/domain/whatsapp/proactive/service.ts`:
  - `generateWeeklyDigest(db: Queryable, options: { dryRun?: boolean; limit?: number })`:
    - Queries eligible targets and weekly activity metrics.
    - Generates target payloads for `appu_weekly_digest`.
  - `generateDailyTip(db: Queryable, options: { dryRun?: boolean; limit?: number })`:
    - Queries eligible targets.
    - Generates target payloads for `appu_daily_tip`.
  - `generateBirthdayWishes(db: Queryable, options: { dryRun?: boolean; limit?: number })`:
    - Queries birthday targets for today.
    - Generates target payloads for `appu_birthday_wish`.

- [ ] **Step 2.4: Unit Tests for Content Generation**
  Create `backend/tests/proactive-whatsapp-generators.test.ts`:
  - Test zero-session edge case: renders motivating fallback with valid parameter count (3 parameters).
  - Test high-activity case: renders session count, question count, and topic titles under 250 chars.
  - Test daily tip grade tier selection and deterministic daily rotation.
  - Test birthday wish name formatting (1 parameter).
  - Run `node --import tsx --test tests/proactive-whatsapp-generators.test.ts`.

---

### Task 3: HMAC-Authenticated REST Endpoints

- [ ] **Step 3.1: Create REST Route Module**
  Create `backend/src/routes/whatsapp-proactive.ts`:
  - Fastify plugin accepting `{ db: TransactionalQueryable; signingSecret: string; signatureMaxAgeSeconds?: number }`.
  - Enforce HMAC verification (`verifyAppuHmacSignature`) on all requests.
  - Define Zod schema for query/body parameters (`dryRun`, `limit`).
  - Implement endpoints:
    - `POST /api/appu/whatsapp/proactive/weekly-digest`
    - `POST /api/appu/whatsapp/proactive/daily-tip`
    - `POST /api/appu/whatsapp/proactive/birthday-wishes`
  - Export route plugin.

- [ ] **Step 3.2: Register Routes in Backend Server**
  - Update `backend/src/routes/index.ts`: export `whatsapp-proactive.js`.
  - Update `backend/src/app.ts`: register `whatsappProactiveRoutes` alongside `whatsappContextRoutes` when `N8N_APPU_CALLBACK_HMAC_SECRET` is configured.

- [ ] **Step 3.3: Integration Tests**
  Create `backend/tests/whatsapp-proactive-routes.test.ts`:
  - Test 401 Unauthorized when HMAC headers are missing or signature is invalid.
  - Test 401 Unauthorized when signature timestamp is stale (> 300 seconds).
  - Test 200 OK with valid HMAC signature and verify response payload structure (`targets`, `parameters`).
  - Run `node --import tsx --test tests/whatsapp-proactive-routes.test.ts`.

---

### Task 4: Production-Gated n8n Integration

*Note: Executed in production n8n (`drr7AUOcj1VrU0j8`) following coordinator signoff.*

- [ ] **Step 4.1: Weekly Parent Digest Pipeline**
  - Wire `Sunday 6:00 PM Parent Digest Cron` to a new Code node `Fetch Weekly Digest Targets`.
  - In `Fetch Weekly Digest Targets`: Make HMAC POST request to `https://api.appuai.online/api/appu/whatsapp/proactive/weekly-digest`.
  - Return each item in `targets` as an n8n stream item.
  - Add IF node: check if targets exist.
  - Add HTTP Request node `Send Weekly Digest via Meta API`:
    - Post template payload to `https://graph.facebook.com/v20.0/1288446054350994/messages`.
    - Body uses `$json.recipientPhone`, `$json.templateName`, `$json.parameters`.
  - Disconnect / remove old `Prepare Parent Digest` dangling node.

- [ ] **Step 4.2: Daily Morning Tip Pipeline (Gated on Meta Approval)**
  - Wire `Schedule Trigger` (8:30 AM) to new Code node `Fetch Daily Tip Targets`.
  - Make HMAC POST request to `https://api.appuai.online/api/appu/whatsapp/proactive/daily-tip`.
  - Disconnect old `Prepare Daily Morning Tip` dangling node.
  - Wire to Meta API send node (or log in dry-run mode until approval confirmation).

- [ ] **Step 4.3: Daily Birthday Wish Pipeline (Gated on Meta Approval)**
  - Add `Daily 9:00 AM Birthday Cron` schedule trigger (`0 9 * * *`).
  - Wire to Code node `Fetch Birthday Targets` (HMAC POST to `/birthday-wishes`).
  - Wire to Meta API send node.

- [ ] **Step 4.4: Remove Obsolete / Dangling Nodes**
  - Remove dangling `Prepare Daily Morning Tip` and `Prepare Parent Digest`.
  - Remove `$fromAI` recipient references from interactive `Send WhatsApp Template` tool to prevent LLM hallucination.

---

### Task 5: Deferred Sub-Phase: Study Reminders & Calendar (Blueprint)

- [ ] **Step 5.1: Student Intent Extraction & Storage**
  - Scaffolding when Calendar feature is prioritized:
    - Create `study_schedules` table (`household_id`, `child_id`, `topic`, `scheduled_at`, `reminder_sent`).
    - Add AI function calling tool for `APPU Mentor` to record study intent.
- [ ] **Step 5.2: Reminder Cron & Dispatch**
  - Recurring 15-minute cron triggers `POST /api/appu/whatsapp/proactive/study-reminders`.
  - Backend dispatches `appu_study_reminder` (`{{1}}` child name, `{{2}}` topic, `{{3}}` time) for sessions starting in 15–30 minutes.

---

## Verification Plan

### Automated Tests
1. **Repository Unit Tests:**
   `node --import tsx --test tests/proactive-whatsapp-repository.test.ts`
   Verifies tenant filtering, active child selection, consent check, and weekly activity aggregation.
2. **Generators Unit Tests:**
   `node --import tsx --test tests/proactive-whatsapp-generators.test.ts`
   Verifies template variable structures, length boundaries, and fallback messaging.
3. **Route Integration Tests:**
   `node --import tsx --test tests/whatsapp-proactive-routes.test.ts`
   Verifies HMAC authentication enforcement, replay prevention, and HTTP response contracts.
4. **Full Backend Test Suite:**
   `npm test` in `backend/` to verify zero regressions across existing test suites.

### Manual / Dry-Run Verification
1. Call `POST /api/appu/whatsapp/proactive/weekly-digest` with `dryRun: true` and verify returned payload.
2. Call `POST /api/appu/whatsapp/proactive/daily-tip` with `dryRun: true` and inspect tip variety.
3. Call `POST /api/appu/whatsapp/proactive/birthday-wishes` with `dryRun: true`.
4. Inspect n8n execution log to confirm successful delivery of `appu_weekly_digest` to test parent phone without errors.
