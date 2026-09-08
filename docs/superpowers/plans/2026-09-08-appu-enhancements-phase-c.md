# APPU System Enhancements Implementation Plan (Phase C) — Personalized Prompt Library

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement Phase C (Personalized Prompt Library):
1. **Migration 017:** Create `child_prompts` table with composite tenant indexing for storing categorized, personalized prompt recommendations.
2. **Backend Prompts Domain & Repository:** Implement domain entities, row mappers, and repository operations for loading, saving, and replacing prompts.
3. **Deterministic Prompt Generation Engine:** Build an intelligent, slot-filling prompt templating engine tailored across grade bands (`Grade 5–7`, `Grade 8–10`, `Grade 11–12`) and the 4 canonical categories (`quick_concepts`, `homework_hints`, `curious_mind`, `exam_drills`).
4. **Backend REST Routes:** Implement `GET /api/children/:childId/prompts` (lazy-generates if empty) and `POST /api/children/:childId/prompts/regenerate` with household authentication.
5. **Frontend Browsable Panel UI:** Add a responsive sliding sheet (`#prompt-library-panel`), category filter pills, prompt cards with icons, "Refresh Prompts" action, chat input population (`#chat-input`), and full `en`/`kn`/`hi` translations while preserving the single `<h1>` invariant.

**Tech Stack:** TypeScript, Fastify, PostgreSQL, Vanilla JavaScript (ES2022), HTML5, CSS3, Node.js test runner (`node:test`, `node:assert/strict`).

**Spec Reference:** `docs/superpowers/specs/2026-09-08-appu-enhancements-design.md` §3.7.

---

## Architectural Audit & Recommendation on Prompt Generation Fork

### 1. Audit of Current Backend AI / LLM Capabilities
- **Direct LLM Client Audit:** An exhaustive audit of `backend/package.json` and `backend/src/` confirms that the backend has **zero LLM dependencies** (no `openai`, no `@google/genai`, no `@langchain`, etc.).
- **Existing AI Pipeline:** All APPU AI interactions (chat reasoning, personality, and audio streaming) are decoupled and mediated through the **n8n webhook orchestrator** (`APPU_N8N_CHAT_WEBHOOK_URL` / `GATEWAY_WEBHOOK_URL`).
- **Backend Role:** The backend is strictly a fast, secure domain orchestrator handling tenancy, authentication, authorizations, usage metering, and mentor context delivery.

### 2. Evaluation of Generation Approaches

| Criteria | (a) Deterministic Profile-Templating | (b) Backend LLM SDK (OpenAI) | (c) n8n Workflow Path |
| :--- | :--- | :--- | :--- |
| **New Dependencies** | **None** (zero package additions) | Heavy (`openai` package + API keys) | Webhook HTTP client additions |
| **Response Latency** | **< 5ms** (instantaneous DB/memory) | 1,500ms – 4,000ms | 2,000ms – 6,000ms |
| **Operational Cost** | **$0.00** | Metered cost per child refresh | Metered LLM tokens |
| **Reliability & Uptime**| **100%** (no network/vendor flakiness) | Prone to OpenAI rate-limits/outages | Prone to n8n queue saturation |
| **Child Safety (COPPA)**| **100% Curated & Safe** (no halluncinations) | Requires runtime content filtering | Requires prompt guardrails |
| **Testability in CI** | **Pure, deterministic unit tests** | Requires mocking external HTTP APIs | Requires live/mocked n8n instance |
| **Personalization Feel**| High (injects subjects, interests, grade, name) | Very high (unconstrained prose) | Very high (unconstrained prose) |

### 3. Recommendation: Approach (a) Deterministic Profile-Templating
**We strongly recommend Approach (a): Deterministic Profile-Templating.**
- It adheres to APPU's lean architecture: the backend maintains zero external cloud AI dependencies.
- It dynamically generates 12–16 tailored prompts by slot-filling child metadata (`preferredName`, `gradeBand`, `favoriteSubjects`, `interests`, `learningStyle`).
- It guarantees complete child safety and pedagogical relevance with zero risk of hallucinations or inappropriate suggestions for minors.
- It delivers instantaneous rendering when opening the panel or clicking "Refresh Prompts".

---

## Audit of Existing Suggested-Prompt System

### 1. Main Page Mission Cards (`index.html` & `app.js`)
- `frontend/index.html` defines 4 static mission cards:
  - `#chip-explain` (`data-prompt="Explain a school topic to me in a simple, fun way. Start by asking which topic and class I am in."`)
  - `#chip-quiz` (`data-prompt="Play a quick five-question quiz with me. Start by asking my class and favorite subject."`)
  - `#chip-homework` (`data-prompt="Help me with my homework without simply giving the answer. Ask me to share the question and guide me step by step."`)
  - `#chip-exam` (`data-prompt="Help me practise for an exam. Start by asking my class, subject, chapter, and exam date."`)
- In `frontend/app.js`:
  ```javascript
  const chipButtons = document.querySelectorAll('.chip-action-btn');
  chipButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      const prompt = btn.getAttribute('data-prompt');
      if (prompt) handleUserInteraction(prompt);
    });
  });
  ```

### 2. Prompt Library Population Mechanism
In the new browsable Prompt Library panel:
- When a learner browses categories and taps a prompt card:
  1. The selected `promptText` is written to `#chat-input.value = promptText;`.
  2. The chat drawer is opened via `window.app.toggleChatDrawer(true);` (or directly updating `#chat-drawer.classList.add('is-open')`).
  3. The prompt library panel is closed.
  4. Focus is placed on `#chat-input.focus();`.
  5. If the learner taps the prompt card's inline action "Ask Appu", `window.app.handleUserInteraction(promptText)` is invoked directly.

---

## Data Model & Migration 017

```sql
-- ==============================================================================
-- Migration: 017_child_prompts.sql
-- Description: Stored, personalized prompt library for child profiles
-- ==============================================================================

CREATE TABLE IF NOT EXISTS child_prompts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
    child_id UUID NOT NULL REFERENCES child_profiles(id) ON DELETE CASCADE,
    category VARCHAR(50) NOT NULL CHECK (category IN (
        'quick_concepts',
        'homework_hints',
        'curious_mind',
        'exam_drills'
    )),
    prompt_text TEXT NOT NULL,
    icon VARCHAR(50) NOT NULL DEFAULT 'fa-lightbulb',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for fast category-filtered and recency-ordered lookups
CREATE INDEX IF NOT EXISTS idx_child_prompts_lookup
  ON child_prompts (household_id, child_id, category, created_at DESC);

-- Composite index for fast batch replacement and household scoping
CREATE INDEX IF NOT EXISTS idx_child_prompts_child
  ON child_prompts (household_id, child_id);
```

---

## Global Constraints & Invariants

1. **Strict Tenant Isolation:** Every prompt query and mutation must enforce `WHERE household_id = $1 AND child_id = $2`.
2. **Strict RED $\rightarrow$ GREEN TDD:** Run each test suite individually (`node --test ...` or `node --import tsx --test ...`). Never run the full `npm test` glob due to the pre-existing pg-mem RLS limitation on migration 012.
3. **No Unapproved Operations:** NO version bumps (coordinator bumps at deploy), NO git commits or pushes by worker, NO n8n modifications.
4. **Single `<h1>` Constraint:** `index.html` must continue to preserve strictly one `<h1>` element.

---

## Detailed Task Breakdown

### Task 1: Migration 017 & Prompts Domain Repository

**Files:**
- Create: `backend/db/migrations/017_child_prompts.sql`
- Create: `backend/src/domain/prompts/types.ts`
- Create: `backend/src/domain/prompts/repository.ts`
- Create: `backend/src/domain/prompts/index.ts`
- Create: `backend/tests/prompt-repository.test.ts`

- [ ] **Step 1: Write failing unit test in `backend/tests/prompt-repository.test.ts` (RED)**
  - Test 1: `savePrompts` stores prompts with household and child scoping.
  - Test 2: `getPromptsByChild` retrieves prompts ordered by `created_at ASC`.
  - Test 3: `replacePrompts` atomically clears prior prompts and stores new batch.
  - Test 4: Tenant safety: cannot retrieve prompts belonging to another household.
  - Test 5: Cascade delete: deleting a child profile cascades to delete prompts.

- [ ] **Step 2: Run test to confirm RED**
  - Command: `node --import tsx --test tests/prompt-repository.test.ts` (in `backend/`)
  - Expected: FAIL.

- [ ] **Step 3: Implement Migration 017 & Repository**
  - Create `backend/db/migrations/017_child_prompts.sql`.
  - Define `PromptCategory`, `ChildPrompt`, `CreatePromptInput` in `backend/src/domain/prompts/types.ts`.
  - Implement `PromptsRepository` in `backend/src/domain/prompts/repository.ts`:
    - `getPromptsByChild(db, householdId, childId): Promise<ChildPrompt[]>`
    - `savePrompts(db, householdId, childId, prompts: CreatePromptInput[]): Promise<ChildPrompt[]>`
    - `replacePrompts(db, householdId, childId, prompts: CreatePromptInput[]): Promise<ChildPrompt[]>`
    - `clearPrompts(db, householdId, childId): Promise<void>`
  - Export from `backend/src/domain/prompts/index.ts`.

- [ ] **Step 4: Run test to confirm GREEN**
  - Command: `node --import tsx --test tests/prompt-repository.test.ts`
  - Expected: PASS (5/5 tests).

- [ ] **Step 5: Hand off Task 1 diff + RED/GREEN to Atlas**
  - Commit message: `feat: add migration 017 and child prompts domain repository`

---

### Task 2: Deterministic Prompt Generation Engine & Service

**Files:**
- Create: `backend/src/domain/prompts/prompt-catalogue.ts`
- Create: `backend/src/domain/prompts/prompt-service.ts`
- Create: `backend/tests/prompt-service.test.ts`

- [ ] **Step 1: Write failing unit tests in `backend/tests/prompt-service.test.ts` (RED)**
  - Test 1: Generates 12–16 prompts distributed evenly across 4 categories (`quick_concepts`, `homework_hints`, `curious_mind`, `exam_drills`).
  - Test 2: Adapts prompts to child's grade band (`Grade 5–7` vs `Grade 8–10` vs `Grade 11–12`).
  - Test 3: Injects child's actual favorite subjects and interests into prompt slots.
  - Test 4: Falls back gracefully to sensible defaults when subjects or interests are empty.
  - Test 5: Injects child's preferred name or nickname when template supports addressing.
  - Test 6: `getOrGeneratePrompts` returns existing prompts if present, or generates and persists if empty.
  - Test 7: `regeneratePrompts` replaces existing prompts with fresh seed.

- [ ] **Step 2: Run test to confirm RED**
  - Command: `node --import tsx --test tests/prompt-service.test.ts`
  - Expected: FAIL.

- [ ] **Step 3: Implement Prompt Catalogue & Service**
  - `prompt-catalogue.ts`:
    - Define curated template structures per category and grade tier.
    - Token substitutions: `{subject}`, `{interest}`, `{grade}`, `{name}`.
    - Fallbacks: default subjects ("Science, Mathematics"), default interests ("Space, Technology").
    - Assign font-awesome icons per category/topic.
  - `prompt-service.ts`:
    - `generatePrompts(child, personalisation)`: slot-fills catalogue templates.
    - `getOrGeneratePrompts(db, householdId, childId)`: checks repo; if empty, fetches child + personalisation from tenancy/personalisation repos, generates, and persists.
    - `regeneratePrompts(db, householdId, childId)`: generates fresh batch and calls `PromptsRepository.replacePrompts`.

- [ ] **Step 4: Run test to confirm GREEN**
  - Command: `node --import tsx --test tests/prompt-service.test.ts`
  - Expected: PASS (7/7 tests).

- [ ] **Step 5: Hand off Task 2 diff + RED/GREEN to Atlas**
  - Commit message: `feat: implement deterministic profile-templated prompt generation service`

---

### Task 3: Backend REST Endpoints (`GET` & `POST .../regenerate`)

**Files:**
- Create: `backend/src/routes/prompts.ts`
- Modify: `backend/src/routes/index.ts`
- Modify: `backend/src/app.ts`
- Create: `backend/tests/prompts-api.test.ts`

- [ ] **Step 1: Write failing API unit tests in `backend/tests/prompts-api.test.ts` (RED)**
  - Test 1: `GET /api/children/:childId/prompts` requires auth (401 without token).
  - Test 2: `GET /api/children/:childId/prompts` rejects non-household child (404/403).
  - Test 3: `GET /api/children/:childId/prompts` lazy-generates and returns prompts for initialized child.
  - Test 4: `POST /api/children/:childId/prompts/regenerate` regenerates and returns updated prompts.
  - Test 5: Category query filter: `GET /api/children/:childId/prompts?category=quick_concepts` filters returned results.

- [ ] **Step 2: Run test to confirm RED**
  - Command: `node --import tsx --test tests/prompts-api.test.ts`
  - Expected: FAIL.

- [ ] **Step 3: Implement Fastify Route & App Registration**
  - `backend/src/routes/prompts.ts`:
    - Add `childId` UUID validation.
    - Enforce `HouseholdAuthorizationService.requireHouseholdMembership`.
    - Implement `GET /api/children/:childId/prompts` calling `PromptService.getOrGeneratePrompts`.
    - Implement `POST /api/children/:childId/prompts/regenerate` calling `PromptService.regeneratePrompts`.
  - Register in `backend/src/routes/index.ts` and `backend/src/app.ts`.

- [ ] **Step 4: Run test to confirm GREEN**
  - Command: `node --import tsx --test tests/prompts-api.test.ts`
  - Expected: PASS (5/5 tests).

- [ ] **Step 5: Run targeted backend regression suite**
  - `node --import tsx --test tests/child-profile-nickname-dob.test.ts tests/children-nickname-dob-api.test.ts tests/prompts-api.test.ts`
  - Run `npm run typecheck`.
  - Expected: Zero type errors, all tests pass.

- [ ] **Step 6: Hand off Task 3 diff + RED/GREEN to Atlas**
  - Commit message: `feat: add children prompt library REST routes and regeneration API`

---

### Task 4: Frontend Prompt Library Client, Browsable Panel UI, Populating Chat Input & i18n

**Files:**
- Modify: `frontend/index.html`
- Modify: `frontend/appu-backend-client.js`
- Create: `frontend/prompt-library-ui.js`
- Modify: `frontend/app.js`
- Modify: `frontend/style.css`
- Create: `tests/prompt-library-ui.test.js`

- [ ] **Step 1: Write failing frontend unit tests in `tests/prompt-library-ui.test.js` (RED)**
  - Test 1: DOM contains `#btn-explore-prompts` (trigger) and `#prompt-library-panel` with category tabs and card container.
  - Test 2: `fetchChildPrompts` calls backend endpoint and renders cards in `#prompt-library-panel`.
  - Test 3: Tapping a category filter tab filters the visible prompt cards.
  - Test 4: Tapping a prompt card populates `#chat-input.value` and opens `#chat-drawer`.
  - Test 5: Tapping "Refresh Prompts" calls `regenerateChildPrompts` and updates card view.
  - Test 6: Translations for prompt library titles, categories, and buttons exist in `en`, `kn`, `hi`.
  - Test 7: `index.html` strictly maintains exactly one `<h1>`.

- [ ] **Step 2: Run test to confirm RED**
  - Command: `node --test tests/prompt-library-ui.test.js`
  - Expected: FAIL.

- [ ] **Step 3: Update `frontend/index.html`**
  - Add "Explore Prompts" action pill on main stage / near mission deck (`#btn-explore-prompts`).
  - Add `#prompt-library-panel` sliding sheet:
    - Header: Title, subtitle, close button (`#btn-close-prompt-library`), refresh button (`#btn-refresh-prompts`).
    - Filter tabs: All, Quick Concepts, Homework Hints, Curious Mind, Exam Drills.
    - Card container: `#prompt-cards-container`.
  - Verify document `h1` count remains strictly 1.

- [ ] **Step 4: Update `frontend/appu-backend-client.js`**
  - Add `fetchChildPrompts(childId)` and `regenerateChildPrompts(childId)`.

- [ ] **Step 5: Create `frontend/prompt-library-ui.js`**
  - Module controller handling panel open/close, category tab switching, card rendering, and click events.
  - On prompt card click:
    ```javascript
    const chatInput = document.getElementById('chat-input');
    if (chatInput) {
      chatInput.value = promptText;
      window.app.toggleChatDrawer(true);
      closePromptLibrary();
      chatInput.focus();
    }
    ```

- [ ] **Step 6: Update `frontend/app.js` & `frontend/style.css`**
  - Add dictionary keys for `promptLibraryTitle`, `promptLibrarySubtitle`, `categoryAll`, `categoryQuickConcepts`, `categoryHomeworkHints`, `categoryCuriousMind`, `categoryExamDrills`, `btnRefreshPrompts` to `UI_TRANSLATIONS` (`en`, `kn`, `hi`).
  - Wire translations in `applyUiTranslations(lang)`.
  - Add luxury dark glassmorphic styling for `#prompt-library-panel`, category tabs, and prompt cards in `frontend/style.css`.

- [ ] **Step 7: Run test to confirm GREEN**
  - Run: `node --test tests/prompt-library-ui.test.js`
  - Run: `python tests/page-structure.test.py`
  - Run full FE glob: `node --test tests/*.test.js`
  - Expected: All pass.

- [ ] **Step 8: Hand off Task 4 diff + RED/GREEN to Atlas**
  - Commit message: `feat: add browsable prompt library panel UI with chat input population and i18n`

---

## Deployment & Verification Gate

1. **Migration Gate:** Migration 017 (`017_child_prompts.sql`) must be applied to the production database and verified before backend code deployment.
2. **Version Bump:** Release cache-buster version will be bumped by the coordinator at deploy time (e.g. `20260908-3`).
3. **End-to-End Regression:**
   ```bash
   # Backend
   node --import tsx --test backend/tests/prompt-repository.test.ts
   node --import tsx --test backend/tests/prompt-service.test.ts
   node --import tsx --test backend/tests/prompts-api.test.ts
   npm --prefix backend run typecheck

   # Frontend
   node --test tests/prompt-library-ui.test.js
   python tests/page-structure.test.py
   node --test tests/*.test.js
   ```
