# APPU System Enhancements Implementation Plan (Phase B) — Nickname & DOB

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement Phase B enhancements:
1. Migration 016: Add `nickname` (VARCHAR(50) NULL) and `dob` (DATE NULL) to `child_profiles`.
2. Backend Tenancy Domain: Update domain interfaces, repository row mappers, queries, and mutations.
3. Backend Personalisation & Routes: Accept `nickname` and `dob` in `PUT /api/children/:childId/personalisation` (and `PATCH /api/children/:childId`), validating age bounds (3–25 years) and safe string format.
4. Mentor Context Integration: Feed `nickname` into `MentorContextBuilder` so APPU addresses the child by their preferred nickname across web, mobile, and WhatsApp.
5. Frontend Personalisation UI: Add optional nickname and DOB inputs in Step 4 of `parent-setup-ui.js`, with client-side validation, full `en`/`kn`/`hi` i18n, state synchronization, and single `h1` preservation.

**Tech Stack:** TypeScript, Fastify, PostgreSQL (pg-mem for unit tests), Vanilla JavaScript (ES2022), HTML5, CSS3, Node.js test runner (`node:test`, `node:assert/strict`).

**Spec Reference:** `docs/superpowers/specs/2026-09-08-appu-enhancements-design.md` §3.5–3.6.

---

## Data Model Audit & Recommendation

### Recommendation: Place `nickname` and `dob` on `child_profiles` (Identity)

After auditing the tenancy, personalisation, and session architectures, we strongly recommend placing both `nickname` and `dob` on **`child_profiles`**, rather than `child_personalisation`.

#### Justification:
1. **Core Identity Semantics vs Configurable Preferences**:
   - `child_profiles` represents foundational human identity: `preferred_name`, `grade_band`, `status`. Date of birth (`dob`) is an immutable, objective demographic identity attribute (identical to date of birth in standard SIS / student identity schemas). It is not a configurable preference or learning style.
   - `nickname` is an alternate identity name directly paired with `preferred_name` (e.g. "Shreedhar" vs "Shree", "Alexander" vs "Alex").
   - `child_personalisation` is reserved for pedagogical/aesthetic settings (`preferred_language`, `learning_style`, `response_style`, `favorite_subjects`, `interests`, `font_preference`, `theme_preference`).
2. **Lifecycle Independence & Resilience**:
   - `child_profiles` is created at household onboarding. A child profile always exists. `child_personalisation` is a downstream 1:1 record that may be deferred, reset, or absent if a user completes only basic setup. Storing `dob` on `child_profiles` guarantees identity attributes are always intact.
3. **Architectural Grounding for Phase D (Birthday Automations)**:
   - In Phase D, a daily cron job will query birthdays to trigger proactive WhatsApp wishes (`households.whatsapp_consent = TRUE`). Querying `child_profiles.dob` directly (with an index on `(EXTRACT(MONTH FROM dob), EXTRACT(DAY FROM dob))` or simple filter) avoids unnecessary inner joins or dependency on `child_personalisation`.
4. **Single-Request UX via Transactional Route**:
   - In Migration 015, `PUT /api/children/:childId/personalisation` was designed to accept `parentPhone` and `whatsappConsent` (which live on `households`), executing the update inside an atomic transaction alongside `child_personalisation`.
   - We follow this exact established pattern: `PUT /api/children/:childId/personalisation` accepts `nickname` and `dob`, updating `child_profiles` and `child_personalisation` in the same transaction. The frontend Step 4 questionnaire remains a single seamless submit.

---

## Global Constraints & Invariants

1. **Strict TDD:** Every task must implement failing tests first (RED), followed by the minimal implementation (GREEN), then refactor.
2. **Backward Compatibility:** All new database columns are strictly `NULL` by default. Existing child profiles remain fully valid with `nickname = NULL` and `dob = NULL`.
3. **No Unilateral Version Bumps:** Do NOT bump `window.APPU_CONFIG.version` or query parameters (e.g., `?v=...`) in tasks. The coordinator/Atlas bumps versions at deploy time.
4. **Preserve Single `h1`:** All HTML additions in `frontend/index.html` must preserve the invariant of exactly one `<h1>` in the document.
5. **Deployment Sequencing:** Migration 016 is maintainer-gated and must be executed in PostgreSQL BEFORE deploying backend application code referencing the new columns.

---

## Task Breakdown

### Task 1: Migration 016 & Tenancy Domain Updates

**Files:**
- Create: `backend/db/migrations/016_child_nickname_and_dob.sql`
- Modify: `backend/src/domain/tenancy/types.ts`
- Modify: `backend/src/domain/tenancy/repository.ts`
- Create: `backend/tests/child-profile-nickname-dob.test.ts`

**Context:**
Create migration 016 to add `nickname VARCHAR(50) NULL` and `dob DATE NULL` to `child_profiles`. Update domain types and `TenancyRepository` CRUD methods to read, insert, update, and map these columns.

- [ ] **Step 1: Write failing unit tests in `backend/tests/child-profile-nickname-dob.test.ts` (RED)**
  - Test `TenancyRepository.createChildProfile` stores and returns `nickname` and `dob` (formatted as `YYYY-MM-DD`).
  - Test `TenancyRepository.createChildProfile` defaults `nickname` and `dob` to `null` when omitted.
  - Test `TenancyRepository.updateChildProfile` updates `nickname` and `dob`, and allows setting them to `null`.
  - Test `TenancyRepository.getChildProfile` and `listChildProfilesByHousehold` retrieve `nickname` and `dob`.

- [ ] **Step 2: Run test to confirm RED**
  - Run: `node --test backend/tests/child-profile-nickname-dob.test.ts`
  - Expected: FAIL (types and columns missing).

- [ ] **Step 3: Create Migration `backend/db/migrations/016_child_nickname_and_dob.sql`**
  ```sql
  -- ==============================================================================
  -- Migration: 016_child_nickname_and_dob.sql
  -- Description: Learner nickname for friendly addressing and date of birth for age-adapted learning
  -- ==============================================================================

  ALTER TABLE child_profiles
    ADD COLUMN IF NOT EXISTS nickname VARCHAR(50) NULL,
    ADD COLUMN IF NOT EXISTS dob DATE NULL;

  COMMENT ON COLUMN child_profiles.nickname IS 'Preferred informal name for APPU conversational addressing';
  COMMENT ON COLUMN child_profiles.dob IS 'Child date of birth for age-adapted pedagogy and birthday wishes';
  ```

- [ ] **Step 4: Update `backend/src/domain/tenancy/types.ts`**
  - Update `ChildProfile`:
    - `nickname: string | null;`
    - `dob: string | null;`
  - Update `CreateChildProfileInput`:
    - `nickname?: string | null;`
    - `dob?: string | null;`
  - Update `UpdateChildProfileInput`:
    - `nickname?: string | null;`
    - `dob?: string | null;`

- [ ] **Step 5: Update `backend/src/domain/tenancy/repository.ts`**
  - In `ChildProfileRow` interface, add `nickname?: string | null; dob?: Date | string | null;`.
  - In `mapChildProfileRow`:
    - Map `nickname: row.nickname ?? null`.
    - Map `dob: row.dob ? (typeof row.dob === 'string' ? row.dob.slice(0, 10) : (row.dob instanceof Date ? row.dob.toISOString().slice(0, 10) : null)) : null`.
  - In `createChildProfile`:
    - Add `nickname` and `dob` to `INSERT INTO child_profiles (...) VALUES (...) RETURNING ...`.
  - In `updateChildProfile`:
    - When `input.nickname !== undefined`, append `nickname = $N`.
    - When `input.dob !== undefined`, append `dob = $N`.
  - In `getChildProfile` and `listChildProfilesByHousehold`:
    - Include `nickname` and `dob` in `SELECT` list.

- [ ] **Step 6: Run test to confirm GREEN**
  - Run: `node --test backend/tests/child-profile-nickname-dob.test.ts`
  - Expected: PASS (all repository assertions green).

- [ ] **Step 7: Stage and commit Task 1**
  ```bash
  git add backend/db/migrations/016_child_nickname_and_dob.sql backend/src/domain/tenancy/types.ts backend/src/domain/tenancy/repository.ts backend/tests/child-profile-nickname-dob.test.ts
  git commit -m "feat: add migration 016 and child profile nickname and dob in tenancy domain"
  ```

---

### Task 2: MentorContext Integration (Addressing by Nickname)

**Files:**
- Modify: `backend/src/domain/personalisation/mentor-context-builder.ts`
- Modify: `backend/src/domain/personalisation/types.ts`
- Create: `backend/tests/mentor-context-nickname.test.ts`

**Context:**
`MentorContextBuilder` constructs canonical `mentorContext` for authenticated sessions on both Web and WhatsApp. When a learner has a non-empty `nickname`, `mentorContext.learnerName` must be set to `nickname.trim()`. If `nickname` is missing or blank, it falls back to `child.preferredName`. This ensures APPU immediately uses the nickname everywhere without requiring changes to n8n prompt logic or envelope validation.

- [ ] **Step 1: Write failing unit tests in `backend/tests/mentor-context-nickname.test.ts` (RED)**
  - Test 1: When `child.nickname` is `"Shree"`, `buildFromResolved` outputs `learnerName: 'Shree'`.
  - Test 2: When `child.nickname` is `null` or `undefined`, `buildFromResolved` outputs `learnerName: child.preferredName`.
  - Test 3: When `child.nickname` is empty or whitespace-only (e.g. `"   "`), `buildFromResolved` falls back to `child.preferredName`.
  - Test 4: `buildMentorContext` loads child with nickname from DB and builds context with `learnerName: child.nickname`.

- [ ] **Step 2: Run test to confirm RED**
  - Run: `node --test backend/tests/mentor-context-nickname.test.ts`
  - Expected: FAIL.

- [ ] **Step 3: Update `backend/src/domain/personalisation/mentor-context-builder.ts`**
  - In `buildFromResolved`:
    - Accept `child: { id: string; preferredName: string; gradeBand: string; nickname?: string | null; dob?: string | null }`.
    - Compute addressing name:
      ```typescript
      const effectiveName = (child.nickname && child.nickname.trim())
        ? child.nickname.trim()
        : child.preferredName;
      ```
    - Set `learnerName: effectiveName`.

- [ ] **Step 4: Run test to confirm GREEN**
  - Run: `node --test backend/tests/mentor-context-nickname.test.ts`
  - Expected: PASS.

- [ ] **Step 5: Stage and commit Task 2**
  ```bash
  git add backend/src/domain/personalisation/mentor-context-builder.ts backend/src/domain/personalisation/types.ts backend/tests/mentor-context-nickname.test.ts
  git commit -m "feat: inject learner nickname into mentor context for conversational addressing"
  ```

---

### Task 3: Backend Routes & Zod Validation (Personalisation & Children Routes)

**Files:**
- Modify: `backend/src/routes/children.ts`
- Create: `backend/tests/children-nickname-dob-api.test.ts`

**Context:**
Expose `nickname` and `dob` on the HTTP layer:
1. `PUT /api/children/:childId/personalisation`: Accept optional `nickname` and `dob` alongside personalisation fields, saving to `child_profiles` within the same transaction.
2. `PATCH /api/children/:childId`: Accept optional `nickname` and `dob`.
3. `POST /api/children`: Accept optional `nickname` and `dob`.
4. Validate `nickname` (1–50 safe chars, nullable) and `dob` (valid past date, age 3–25 years, nullable).

- [ ] **Step 1: Write failing API unit tests in `backend/tests/children-nickname-dob-api.test.ts` (RED)**
  - Test 1: `PUT /api/children/:childId/personalisation` with valid `nickname: "Aavu"` and `dob: "2014-06-15"` returns 200 and updates `child_profiles`.
  - Test 2: `PUT /api/children/:childId/personalisation` rejects future DOB (e.g. 2030-01-01) with 400.
  - Test 3: `PUT /api/children/:childId/personalisation` rejects age under 3 (e.g. 6 months old) with 400.
  - Test 4: `PUT /api/children/:childId/personalisation` rejects age over 25 with 400.
  - Test 5: `PUT /api/children/:childId/personalisation` rejects invalid date strings (e.g. "not-a-date" or "2015-02-31") with 400.
  - Test 6: `PUT /api/children/:childId/personalisation` rejects nickname exceeding 50 characters or containing forbidden characters (`<`, `>`, `$`, `` ` ``).
  - Test 7: `PUT /api/children/:childId/personalisation` accepts `null` to clear `nickname` and `dob`.
  - Test 8: `PATCH /api/children/:childId` accepts `nickname` and `dob`.
  - Test 9: `GET /api/children/:childId` returns `nickname` and `dob` on the child profile object.

- [ ] **Step 2: Run test to confirm RED**
  - Run: `node --test backend/tests/children-nickname-dob-api.test.ts`
  - Expected: FAIL.

- [ ] **Step 3: Update `backend/src/routes/children.ts`**
  - Add DOB validation helper:
    ```typescript
    const dobSchema = z
      .string()
      .trim()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date of birth must be in YYYY-MM-DD format')
      .refine((dateStr) => {
        const parts = dateStr.split('-').map(Number);
        const parsed = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2]));
        if (
          parsed.getUTCFullYear() !== parts[0] ||
          parsed.getUTCMonth() !== parts[1] - 1 ||
          parsed.getUTCDate() !== parts[2]
        ) {
          return false;
        }
        const now = new Date();
        if (parsed > now) return false;
        const ageYears = (now.getTime() - parsed.getTime()) / (1000 * 60 * 60 * 24 * 365.25);
        return ageYears >= 3 && ageYears <= 25;
      }, 'Learner age must be between 3 and 25 years')
      .nullable()
      .optional();

    const nicknameSchema = z
      .string()
      .trim()
      .min(1, 'Nickname cannot be empty')
      .max(50, 'Nickname must not exceed 50 characters')
      .regex(safeStringPattern, 'Nickname contains forbidden characters')
      .nullable()
      .optional();
    ```
  - Update `createChildSchema`: add `nickname: nicknameSchema`, `dob: dobSchema`.
  - Update `updateChildSchema`: add `nickname: nicknameSchema`, `dob: dobSchema`.
  - Update `updatePersonalisationSchema`: add `nickname: nicknameSchema`, `dob: dobSchema`.
  - In `PUT /api/children/:childId/personalisation`:
    - Destructure `{ parentPhone, whatsappConsent, nickname, dob, ...personalisationData } = bodyResult.data`.
    - In transaction:
      - If `nickname !== undefined || dob !== undefined`:
        ```typescript
        await TenancyRepository.updateChildProfile(tx, household.id, child.id, {
          ...(nickname !== undefined ? { nickname } : {}),
          ...(dob !== undefined ? { dob } : {})
        });
        ```
      - Update notification preferences (if `parentPhone` or `whatsappConsent` present).
      - Upsert personalisation data.
  - In `GET /api/children/:childId` and `PATCH /api/children/:childId`: ensure `nickname` and `dob` are included in the returned `child` object.

- [ ] **Step 4: Run test to confirm GREEN**
  - Run: `node --test backend/tests/children-nickname-dob-api.test.ts`
  - Expected: PASS.

- [ ] **Step 5: Run targeted backend regression suite**
  - `node --test backend/tests/child-profile-nickname-dob.test.ts`
  - `node --test backend/tests/mentor-context-nickname.test.ts`
  - `node --test backend/tests/children-nickname-dob-api.test.ts`
  - `node --test backend/tests/household-notifications-api.test.ts`
  - `node --test backend/tests/whatsapp-context-route.test.ts`
  - Expected: All pass.

- [ ] **Step 6: Stage and commit Task 3**
  ```bash
  git add backend/src/routes/children.ts backend/tests/children-nickname-dob-api.test.ts
  git commit -m "feat: accept and validate child nickname and dob in children and personalisation routes"
  ```

---

### Task 4: Frontend Personalization Step 4 UI & State Integration

**Files:**
- Modify: `frontend/index.html`
- Modify: `frontend/parent-setup-ui.js`
- Modify: `frontend/app.js`
- Modify: `frontend/style.css`
- Create: `tests/personalisation-nickname-dob-ui.test.js`

**Context:**
Add optional Nickname and Date of Birth inputs to Step 4 of the Parent Setup / Personalisation modal. Pre-fill them from the selected child record, perform client-side validation on submit, include them in the `savePersonalisation` payload, update in-memory child state, provide full `en`/`kn`/`hi` translations, and preserve the single `h1` rule.

- [ ] **Step 1: Write failing frontend unit tests in `tests/personalisation-nickname-dob-ui.test.js` (RED)**
  - Test 1: DOM contains `#pos-child-nickname` and `#pos-child-dob` inside `#pos-pers-form`.
  - Test 2: `renderPersonalisationStep(child)` pre-fills `#pos-child-nickname` and `#pos-child-dob` from `child.nickname` and `child.dob`.
  - Test 3: Form submission rejects future DOB or age < 3 / > 25 with alert message.
  - Test 4: Form submission submits `nickname` and `dob` in payload to `window.ParentOnboardingShell.savePersonalisation`.
  - Test 5: Translations for `#pos-child-nickname-label` and `#pos-child-dob-label` exist in `en`, `kn`, `hi`.
  - Test 6: Document preserves exactly one `<h1>`.

- [ ] **Step 2: Run test to confirm RED**
  - Run: `node --test tests/personalisation-nickname-dob-ui.test.js`
  - Expected: FAIL.

- [ ] **Step 3: Update `frontend/index.html`**
  - In `#pos-step-pers` form (`#pos-pers-form`), add nickname and DOB inputs in a `.field-grid`:
    ```html
    <div class="field-grid">
      <label><span id="pos-child-nickname-label">Learner Nickname</span>
        <input id="pos-child-nickname" type="text" maxlength="50" placeholder="e.g. Shree or Alex">
      </label>
      <label><span id="pos-child-dob-label">Date of Birth</span>
        <input id="pos-child-dob" type="date">
      </label>
    </div>
    ```
  - Verify document `h1` count remains strictly 1.

- [ ] **Step 4: Update `frontend/parent-setup-ui.js`**
  - Cache elements:
    ```javascript
    const posChildNickname = document.getElementById('pos-child-nickname');
    const posChildDob = document.getElementById('pos-child-dob');
    ```
  - In `renderPersonalisationStep(child)`:
    - Pre-fill:
      ```javascript
      if (posChildNickname) posChildNickname.value = child.nickname || '';
      if (posChildDob) posChildDob.value = child.dob || '';
      ```
  - In `persForm.addEventListener('submit')`:
    - Read values:
      ```javascript
      const rawNickname = posChildNickname?.value?.trim() || '';
      const rawDob = posChildDob?.value?.trim() || '';
      ```
    - Validate `rawNickname`: max 50 chars, no forbidden chars (`<`, `>`, `$`, `` ` ``).
    - Validate `rawDob`: if present, ensure valid `YYYY-MM-DD`, not in future, age between 3 and 25 years. If invalid, `showAlert(t('dobAgeInvalidAlert') || 'Learner age must be between 3 and 25 years.')` and return.
    - Attach to `personalisationData`:
      ```javascript
      nickname: rawNickname || null,
      dob: rawDob || null
      ```
    - On successful save:
      ```javascript
      if (child) {
        child.nickname = rawNickname || null;
        child.dob = rawDob || null;
      }
      ```
  - In launch greeting (Step 5):
    - Greet using effective name: `const addressingName = child.nickname || child.preferredName; window.app.handleUserInteraction(greet(addressingName));`.

- [ ] **Step 5: Update `frontend/app.js` (i18n & DOM Translations)**
  - Add dictionary keys to `UI_TRANSLATIONS`:
    - `posChildNicknameLabel`:
      - `en`: "Learner Nickname"
      - `kn`: "ಕಲಿಕಾರ್ಥಿಯ ಅಡ್ಡಹೆಸರು"
      - `hi`: "शिक्षार्थी का उपनाम"
    - `posChildDobLabel`:
      - `en`: "Date of Birth"
      - `kn`: "ಹುಟ್ಟಿದ ದಿನಾಂಕ"
      - `hi`: "जन्म तिथि"
    - `dobAgeInvalidAlert`:
      - `en`: "Please enter a valid date of birth (learner age must be between 3 and 25 years)."
      - `kn`: "ದಯವಿಟ್ಟು ಮಾನ್ಯವಾದ ಹುಟ್ಟಿದ ದಿನಾಂಕವನ್ನು ನಮೂದಿಸಿ (ಕಲಿಕಾರ್ಥಿಯ ವಯಸ್ಸು 3 ರಿಂದ 25 ವರ್ಷಗಳ ನಡುವೆ ಇರಬೇಕು)."
      - `hi`: "कृपया एक मान्य जन्म तिथि दर्ज करें (शिक्षार्थी की आयु 3 से 25 वर्ष के बीच होनी चाहिए)।"
  - In `applyUiTranslations(lang)`:
    - Wire `#pos-child-nickname-label` and `#pos-child-dob-label`.

- [ ] **Step 6: Update `frontend/style.css`**
  - Add dark luxury glassmorphism styling for `#pos-child-dob` (`input[type="date"]`) so date picker icons and input boxes match the cyan/slate luxury design tokens.

- [ ] **Step 7: Run test to confirm GREEN**
  - Run: `node --test tests/personalisation-nickname-dob-ui.test.js`
  - Run: `python tests/page-structure.test.py`
  - Expected: PASS.

- [ ] **Step 8: Stage and commit Task 4**
  ```bash
  git add frontend/index.html frontend/parent-setup-ui.js frontend/app.js frontend/style.css tests/personalisation-nickname-dob-ui.test.js
  git commit -m "feat: add nickname and dob inputs to personalisation questionnaire with i18n"
  ```

---

## Verification & Quality Gates

Run the comprehensive regression gate prior to handing off Phase B:

```bash
# 1. Backend regression suite
node --test backend/tests/child-profile-nickname-dob.test.ts
node --test backend/tests/mentor-context-nickname.test.ts
node --test backend/tests/children-nickname-dob-api.test.ts
node --test backend/tests/tenancy-parent-phone-lookup.test.ts
node --test backend/tests/whatsapp-context-service.test.ts
node --test backend/tests/whatsapp-context-route.test.ts
node --test backend/tests/household-notifications-api.test.ts

# 2. Frontend regression suite
node --test tests/personalisation-nickname-dob-ui.test.js
node --test tests/landing-auth-ui.test.js
node --test tests/drawer-i18n.test.js
node --test tests/whatsapp-note-share.test.js
node --test tests/voice-popup-persistence.test.js
python tests/page-structure.test.py
```
Expected: All suites passing, clean git working tree, no version bumps.
