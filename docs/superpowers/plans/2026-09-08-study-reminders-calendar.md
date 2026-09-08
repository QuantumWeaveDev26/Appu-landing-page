# APPU Study Reminders & Google Calendar Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement automated, server-verified study schedule recording, 0-OAuth Google Calendar link generation, and proactive WhatsApp reminders via approved Meta template `appu_study_reminder`.

**Tech Stack:** TypeScript, Fastify, PostgreSQL, Zod, Node.js crypto (HMAC-SHA256), Node.js test runner (`node --import tsx --test tests/<file>`), `pg-mem`.  
**Spec Reference:** [`docs/superpowers/specs/2026-09-08-study-reminders-calendar-design.md`](file:///D:/office/Appu-landing-page/docs/superpowers/specs/2026-09-08-study-reminders-calendar-design.md)  
**Template Checklist Reference:** [`docs/whatsapp-templates.md`](file:///D:/office/Appu-landing-page/docs/whatsapp-templates.md)

---

## Prerequisites & Authoritative Constraints

- **STRICTLY GATED:** This plan is prepared for coordinator review. No code, no migrations, no workflow changes shall be executed until approved by Atlas.
- **Strict Consent Enforcement:** Only households with `whatsapp_consent = TRUE` and `parent_phone IS NOT NULL` are eligible for schedule recording and proactive study reminders.
- **Approved Meta Template:** `appu_study_reminder` is confirmed `APPROVED` in language `'en'` under WABA `1041501015099784` with parameters `{{1}}` (child name), `{{2}}` (topic), and `{{3}}` (time).
- **HMAC Authentication:** All endpoints require `X-APPU-Timestamp` and `X-APPU-Signature` using `N8N_APPU_CALLBACK_HMAC_SECRET`.
- **Atomic Concurrency:** Reminder claiming must use `FOR UPDATE SKIP LOCKED` to guarantee zero duplicate sends across concurrent cron runs.
- **Zero-OAuth Calendar URL:** Google Calendar links are pre-computed web intent URLs; no Google OAuth token management or storage is introduced.
- **Test Setup Invariant:** All tests located in `backend/tests/` (plural) running via `node --import tsx --test tests/<file>` using the canonical `pg-mem` harness (`gen_random_uuid`, RLS-strip). Do NOT co-locate tests in `src/`.

---

## Tasks Breakdown

### Task 1: Database Migration 018 (`study_schedules`)

- [ ] **Step 1.1: Create Migration File**
  Create `backend/db/migrations/018_study_schedules.sql`:
  - Create table `study_schedules` with columns:
    - `id UUID PRIMARY KEY DEFAULT gen_random_uuid()`
    - `household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE`
    - `child_id UUID NOT NULL REFERENCES child_profiles(id) ON DELETE CASCADE`
    - `topic VARCHAR(150) NOT NULL`
    - `scheduled_at TIMESTAMPTZ NOT NULL`
    - `time_display VARCHAR(50) NOT NULL`
    - `raw_expression VARCHAR(150) NULL`
    - `reminder_sent BOOLEAN NOT NULL DEFAULT FALSE`
    - `reminder_sent_at TIMESTAMPTZ NULL`
    - `calendar_event_id VARCHAR(255) NULL`
    - `created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`
  - Add partial index `idx_study_schedules_pending_reminders` on `(scheduled_at) WHERE reminder_sent = FALSE`.
  - Add lookup index `idx_study_schedules_lookup` on `(household_id, child_id, scheduled_at DESC)`.
  - Add descriptive column and table comments.

- [ ] **Step 1.2: Verify Migration Idempotency**
  - Verify migration executes cleanly against local PostgreSQL or pg-mem test harness without syntax errors.

---

### Task 2: Domain Repository & Service Implementation

- [ ] **Step 2.1: Domain Types**
  Create `backend/src/domain/study-schedule/types.ts`:
  - Define `StudyScheduleRecord`.
  - Define `CreateStudyScheduleInput`.
  - Define `StudyReminderTargetPayload` matching Meta template parameter schema.
  - Define `StudyReminderJobResponse`.

- [ ] **Step 2.2: Implement `StudyScheduleRepository`**
  Create `backend/src/domain/study-schedule/repository.ts`:
  - `create(db: Queryable, params: InsertScheduleParams): Promise<StudyScheduleRecord>`
  - `claimPendingReminders(db: Queryable, windowMinutes: number, limit: number, dryRun?: boolean): Promise<ClaimedStudyReminder[]>`
    - Uses CTE:
      ```sql
      WITH due_schedules AS (
        SELECT s.id
        FROM study_schedules s
        JOIN households h ON h.id = s.household_id
        JOIN child_profiles c ON c.id = s.child_id
        WHERE s.reminder_sent = FALSE
          AND s.scheduled_at <= (NOW() + ($1 || ' minutes')::interval)
          AND s.scheduled_at >= (NOW() - INTERVAL '15 minutes')
          AND h.whatsapp_consent = TRUE
          AND h.parent_phone IS NOT NULL
          AND c.status = 'ACTIVE'
        ORDER BY s.scheduled_at ASC
        LIMIT $2
        FOR UPDATE OF s SKIP LOCKED
      )
      UPDATE study_schedules
      SET reminder_sent = CASE WHEN $3 = TRUE THEN FALSE ELSE TRUE END,
          reminder_sent_at = CASE WHEN $3 = TRUE THEN NULL ELSE NOW() END
      WHERE id IN (SELECT id FROM due_schedules)
      RETURNING id, household_id, child_id, topic, scheduled_at, time_display;
      ```
  - `listUpcomingByChild(db: Queryable, householdId: string, childId: string, limit?: number): Promise<StudyScheduleRecord[]>`

- [ ] **Step 2.3: Implement `StudyScheduleService`**
  Create `backend/src/domain/study-schedule/service.ts`:
  - `generateGoogleCalendarUrl(topic, scheduledAt, childName, durationMinutes)`: Constructs web intent URL.
  - `recordSchedule(db, input)`:
    - Resolves household and active child by phone. Verifies consent.
    - Validates `scheduledAt` is strictly in the future (minimum 1 min ahead, maximum 60 days).
    - Sanitizes strings (`topic` max 150 chars, `timeDisplay` max 50 chars).
    - Calls repository to insert schedule.
    - Generates calendar URL and returns composite response.
  - `claimDueReminders(db, options)`:
    - Calls repository claiming method.
    - Resolves recipient child names and formats Meta template parameters:
      `parameters: [ { type: 'text', text: childName }, { type: 'text', text: topic }, { type: 'text', text: timeDisplay } ]`.
    - Returns structured payload with `templateName = 'appu_study_reminder'` and `templateLanguage = 'en'`.

- [ ] **Step 2.4: Unit Test Repository & Service**
  Create `backend/tests/study-schedule-repository.test.ts` and `backend/tests/study-schedule-service.test.ts`:
  - Verify insertion and retrieval.
  - Verify past dates reject with appropriate validation error.
  - Verify atomic claiming does not claim records already marked `reminder_sent = TRUE`.
  - Verify consent filtering: households with `whatsapp_consent = false` are omitted.
  - Run `node --import tsx --test tests/study-schedule-repository.test.ts` and `node --import tsx --test tests/study-schedule-service.test.ts`.

---

### Task 3: Backend REST Endpoints & HMAC Route Registration

- [ ] **Step 3.1: Implement Route Handler**
  Create `backend/src/routes/study-schedules.ts`:
  - `POST /api/appu/study-schedules`:
    - Enforces HMAC auth with `verifyAppuHmacSignature`.
    - Validates body with Zod (`phone`, `topic`, `scheduledAt`, `timeDisplay`, `rawExpression`).
    - Returns `200 OK` with schedule details and `calendarUrl`.
  - `POST /api/appu/whatsapp/proactive/study-reminders`:
    - Enforces HMAC auth.
    - Validates body with Zod (`dryRun`, `limit`, `windowMinutes`).
    - Fail-safe wrapper returning HTTP 200 `{ success: false, targets: [] }` on uncaught errors.

- [ ] **Step 3.2: Register Routes in Fastify App**
  Update `backend/src/app.ts`:
  - Import `studySchedulesRoutes` from `./routes/study-schedules.js`.
  - Register under `N8N_APPU_CALLBACK_HMAC_SECRET` guard alongside `whatsappContextRoutes` and `whatsappProactiveRoutes`.

- [ ] **Step 3.3: Integration Test Endpoints**
  Create `backend/tests/study-schedules-routes.test.ts`:
  - Test valid HMAC signature yields 200.
  - Test invalid HMAC signature yields 401.
  - Test expired timestamp yields 401.
  - Test past timestamp payload yields 400.
  - Run `node --import tsx --test tests/study-schedules-routes.test.ts`.

---

### Task 4: Upstream n8n Integration (Production-Gated)

- [ ] **Step 4.1: Disconnect & Retire Legacy Node**
  - In workflow `drr7AUOcj1VrU0j8`, disconnect `Create an event in Google Calendar` from `APPU Mentor`.

- [ ] **Step 4.2: Add `Record Study Schedule Tool`**
  - Add node `Record Study Schedule Tool` (`@n8n/n8n-nodes-langchain.toolCode`):
    - Name: `record_study_schedule`
    - Description: *"Schedule a future study session or set a reminder for a specific topic and time. Parameters: topic (string), scheduled_at_iso (ISO 8601 string), time_display (e.g. 3:00 PM)."*
    - Code: Performs signed HMAC-SHA256 request to `POST /api/appu/study-schedules` using `$env.N8N_APPU_CALLBACK_HMAC_SECRET`.
  - Connect tool input to `APPU Mentor`.

- [ ] **Step 4.3: Add 15-Minute Study Reminder Cron Pipeline**
  - Add `Study Reminder 15m Cron` (`n8n-nodes-base.scheduleTrigger` v1.2, cron: `*/15 * * * *`).
  - Connect to `Fetch Due Study Reminders` (`n8n-nodes-base.code` v2) which executes HMAC POST to `/api/appu/whatsapp/proactive/study-reminders`.
  - Connect to `Has Due Reminders?` (`n8n-nodes-base.if`).
  - Connect true output to `Send WhatsApp Study Reminder` (`n8n-nodes-base.httpRequest` to Meta Cloud API).

---

### Task 5: End-to-End Verification & Documentation

- [ ] **Step 5.1: Typecheck & Full Backend Suite**
  - Run `npm run build` or `npx tsc --noEmit`.
  - Run full test suite: `node --import tsx --test tests/proactive-whatsapp-*.test.ts tests/study-*.test.ts`.

- [ ] **Step 5.2: Staging / Live Verification**
  - Create a test schedule scheduled for +20 minutes from now.
  - Execute proactive study reminder endpoint with `dryRun: true`.
  - Confirm target formatting with `appu_study_reminder` template and exact parameter bindings.
  - Review live n8n execution log.
