# APPU WhatsApp-Side Conversational Onboarding Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement phone-only learner onboarding directly over WhatsApp, enabling APPU to guide new or incomplete learners through full web personalization parity (9 core fields) conversationally, save incrementally via HMAC-authenticated endpoints, and transition seamlessly into personalized tutoring with link-later web account merging.

**Tech Stack:** TypeScript, Fastify, PostgreSQL (`pg-mem` for unit tests), Zod, Node.js crypto (HMAC-SHA256), Node.js test runner (`node --import tsx --test tests/<file>`).  
**Spec Reference:** [`docs/superpowers/specs/2026-09-09-whatsapp-onboarding-design.md`](file:///C:/Users/Naveen%20Reddy/AppData/Roaming/October/worktrees/Appu-landing-page/apollo-1788930525212/docs/superpowers/specs/2026-09-09-whatsapp-onboarding-design.md)

---

## Prerequisites & Authoritative Constraints

- **STRICTLY GATED:** Prepared for coordinator review. No code, no migrations, no workflow changes shall be executed until approved by Atlas.
- **Zero Schema Migrations:** Architectural audit verified that `households` with zero `household_members` rows, single `child_profiles`, `child_personalisation`, and beta subscriptions exist cleanly in the current PostgreSQL schema without any DDL changes.
- **Phone-Only Account Model:** No email or password is required for WhatsApp onboarding.
- **Implied Consent:** Inbound WhatsApp messages set `whatsapp_consent = TRUE` and `whatsapp_consent_at = NOW()` on the household profile.
- **Strict HMAC Authentication:** All onboarding write endpoints require `X-APPU-Timestamp` and `X-APPU-Signature` validated against `N8N_APPU_CALLBACK_HMAC_SECRET`.
- **Test Placement Invariant:** All tests located in `backend/tests/` (plural) running via `node --import tsx --test tests/<file>`. Do NOT co-locate tests in `src/`.

---

## Tasks Breakdown

### Task 1: Domain Types & Completeness Evaluator

- [ ] **Step 1.1: Define Onboarding Types**
  Create `backend/src/domain/whatsapp/onboarding/types.ts`:
  - Define `OnboardingField` union:
    `'name' | 'grade' | 'dob' | 'preferredLanguage' | 'favoriteSubjects' | 'interests' | 'learningStyle' | 'responseStyle' | 'goals'`
  - Define `OnboardingState`:
    ```typescript
    export interface OnboardingState {
      isComplete: boolean;
      completedFields: OnboardingField[];
      missingFields: OnboardingField[];
      nextPromptField: OnboardingField | null;
      collectedData: Record<string, unknown>;
    }
    ```
  - Define `SaveOnboardingStepInput`:
    ```typescript
    export interface SaveOnboardingStepInput {
      phone: string;
      field?: OnboardingField;
      value?: unknown;
      fields?: Partial<Record<OnboardingField, unknown>>;
    }
    ```

- [ ] **Step 1.2: Implement Completeness & Progression Engine**
  Create `backend/src/domain/whatsapp/onboarding/completeness.ts`:
  - Define canonical progression sequence:
    `['name', 'grade', 'dob', 'preferredLanguage', 'favoriteSubjects', 'interests', 'learningStyle', 'responseStyle', 'goals']`
  - Implement `evaluateCompleteness(child: ChildProfileRow | null, personalisation: ChildPersonalisationRow | null): OnboardingState`:
    - Checks name: `child?.preferred_name` or `child?.nickname` is set and non-empty.
    - Checks grade: `child?.grade_band` is set and not default placeholder.
    - Checks DOB: `child?.dob` is set and represents age between 3 and 25 years.
    - Checks preferredLanguage: `personalisation?.preferred_language` is valid ISO code.
    - Checks favoriteSubjects: array with `length >= 1`.
    - Checks interests: array with `length >= 1`.
    - Checks learningStyle: valid enum (`visual`, `auditory`, `kinesthetic`, `reading_writing`, `interactive`).
    - Checks responseStyle: valid enum (`playful`, `balanced`, `focused`).
    - Checks goals: array with `length >= 1`.
    - Computes `completedFields`, `missingFields`, and determines `nextPromptField` as the first entry in `missingFields`.

---

### Task 2: Repository & Persistence Layer

- [ ] **Step 2.1: Phone-Only Household & Profile Repository**
  Create `backend/src/domain/whatsapp/onboarding/repository.ts`:
  - `findOrCreatePhoneOnlyHousehold(tx: Queryable, normalizedPhone: string)`:
    - Finds existing household by `parent_phone = normalizedPhone` OR creates a new household:
      ```sql
      INSERT INTO households (name, parent_phone, whatsapp_consent, whatsapp_consent_at)
      VALUES ('Learner Household', $1, TRUE, NOW())
      RETURNING id, name, parent_phone, whatsapp_consent, whatsapp_consent_at;
      ```
    - Ensures beta subscription exists via `ensureBetaSubscription(tx, household.id, 30)`.
  - `findOrCreateActiveChild(tx: Queryable, householdId: string, initialName?: string, initialGrade?: string)`:
    - Finds active child profile for household OR inserts initial child profile:
      ```sql
      INSERT INTO child_profiles (household_id, preferred_name, grade_band, status)
      VALUES ($1, $2, $3, 'ACTIVE')
      RETURNING id, preferred_name, grade_band, status, nickname, dob;
      ```
  - `applyFieldUpdates(tx: Queryable, householdId: string, childId: string, updates: FieldUpdatePayload)`:
    - If `name`, `nickname`, `grade`, or `dob` are present, updates `child_profiles`.
    - If `preferredLanguage`, `favoriteSubjects`, `interests`, `learningStyle`, `responseStyle`, or `goals` are present, calls `PersonalisationRepository.upsertPersonalisation`.

---

### Task 3: Domain Service & Validation

- [ ] **Step 3.1: Service Layer with Zod Validation**
  Create `backend/src/domain/whatsapp/onboarding/service.ts`:
  - Reuse Zod validation schemas from `backend/src/routes/children.ts`:
    - `name`: string, min 1, max 100, safeStringPattern.
    - `grade`: string, min 1, max 50, safeStringPattern.
    - `dob`: YYYY-MM-DD, age 3–25 years old.
    - `preferredLanguage`: regex `^[a-z]{2}(-[A-Z]{2})?$`.
    - `learningStyle`: enum `LearningStyles`.
    - `responseStyle`: enum `ResponseStyles`.
    - `favoriteSubjects`, `interests`, `goals`: array of safe strings, max 20 items.
  - Implement `saveStep(db: TransactionalQueryable, input: SaveOnboardingStepInput)`:
    - Normalizes phone number.
    - Validates field payloads against corresponding schema; throws `BadRequestError` on validation failure.
    - Executes atomic transaction:
      1. Resolves/creates phone-only household.
      2. Resolves/creates active child profile.
      3. Applies field updates.
      4. Evaluates updated completeness.
    - Returns `{ success: true, householdId, childId, onboarding: updatedState }`.

- [ ] **Step 3.2: Enhance WhatsApp Context Service**
  Update `backend/src/domain/whatsapp/context-service.ts`:
  - When household is found, evaluate onboarding completeness.
  - If profile is incomplete, return `mentorContext` with `mode: 'onboarding'` alongside `onboarding` state.
  - When household is NOT found, return `recognized: false`, `mentorContext: { mode: 'onboarding', primaryLanguage: 'en', personalizationEnabled: false }`, and initial `onboarding` state (`nextPromptField: 'name'`).

---

### Task 4: Fastify HMAC Routes

- [ ] **Step 4.1: Register Onboarding Routes**
  Create `backend/src/routes/whatsapp-onboarding.ts`:
  - Route: `POST /api/appu/whatsapp/onboarding/save-step`
    - Verifies HMAC-SHA256 signature using `verifyAppuHmacSignature` and `opts.signingSecret`.
    - Validates request body schema using Zod.
    - Calls `WhatsAppOnboardingService.saveStep(opts.db, parsedBody)`.
    - Returns HTTP 200 with updated onboarding state.
  - Route: `POST /api/appu/whatsapp/onboarding/state` (Read-only state resolution)
    - Verifies HMAC signature.
    - Resolves and returns current onboarding state for a phone number without modifying data.

- [ ] **Step 4.2: Register Plugin in Backend App**
  Update `backend/src/app.ts`:
  - Register `whatsappOnboardingRoutes` with `signingSecret: env.N8N_APPU_CALLBACK_HMAC_SECRET`.

---

### Task 5: Link-Later Web Account Merging

- [ ] **Step 5.1: Implement Household Claim Service**
  In `backend/src/domain/tenancy/service.ts`:
  - Add `claimPhoneOnlyHousehold(db: TransactionalQueryable, userId: string, rawPhone: string)`:
    - Normalizes phone number.
    - Queries household by normalized phone.
    - Checks `household_members`: if count is 0, links `userId` as `role = 'OWNER'`.
    - If count > 0, returns `{ claimed: false, reason: 'ALREADY_CLAIMED' }`.
  - Wire into parent web profile update / onboarding endpoint in `backend/src/routes/tenancy.ts` or `children.ts`.

---

### Task 6: Comprehensive Test Suites

- [ ] **Step 6.1: Unit & Integration Tests**
  Create `backend/tests/whatsapp-onboarding.test.ts`:
  - Test: Unrecognized phone returns `recognized: false` and `onboarding.nextPromptField = 'name'`.
  - Test: Saving name creates phone-only household, child profile, and provisions beta subscription.
  - Test: Incremental field updates advance `completedFields` and `nextPromptField`.
  - Test: Validation failures (DOB <3 or >25 years old, forbidden characters, bad enums) return 400.
  - Test: Full 9-field completion sets `isComplete = true` and updates `mentorContext.mode = 'authenticated'`.
  - Test: HMAC signature validation rejects invalid/expired signatures (401).
  - Test: Link-later claiming links web user to phone-only household successfully.

- [ ] **Step 6.2: Regression & Typecheck Verification**
  - Run `npx tsc --noEmit` across backend.
  - Run full test suite:
    `node --import tsx --test tests/whatsapp-context-*.test.ts tests/whatsapp-onboarding.test.ts`.

---

### Task 7: Upstream n8n Integration (Production-Gated)

- [ ] **Step 7.1: Add `Save Learner Profile Step` Tool**
  - In workflow `drr7AUOcj1VrU0j8`, add `@n8n/n8n-nodes-langchain.toolCode`:
    - Name: `save_onboarding_step`
    - Parameters: `field` (string), `value` (string | array).
    - Code: Performs signed HMAC POST to `https://api.appuai.online/api/appu/whatsapp/onboarding/save-step`.
  - Connect tool to `APPU Mentor`.

- [ ] **Step 7.2: Update `Normalize WhatsApp Input`**
  - Extract `onboarding` object from context response and pass downstream.

- [ ] **Step 7.3: Update `APPU Mentor` System Prompt**
  - Add conversational onboarding instructions to Section 16 (RUNTIME CONTEXT):
    - Ask ONE question at a time.
    - Parse flexible learner answers (e.g. age -> DOB, multi-field answers).
    - Save via `save_onboarding_step` before replying.
    - Celebrate completion and segue to tutoring.
