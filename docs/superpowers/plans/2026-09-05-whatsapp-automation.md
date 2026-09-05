# APPU WhatsApp & Calendar Parent Automations Implementation Plan (Phase 1)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement Phase 1 parent WhatsApp automation plumbing: optional parent phone and explicit opt-in consent collection during personalization (web + Android app), household-scoped backend storage and validation, explicit injection of verified phone and consent into the n8n AI gateway envelope (zero AI hallucination of phone numbers), and an in-chat "share study note to parent WhatsApp" affordance.

**Architecture:** Household is the storage boundary for parental contact info (`parent_phone`, `whatsapp_consent`, `whatsapp_consent_at`). The authenticated gateway retrieves this verified record and explicitly passes it into the n8n message envelope. The upstream n8n workflow binds WhatsApp tools directly to the server-supplied envelope phone, strictly removing `$fromAI` recipient generation. The frontend collects phone + consent in Step 4 with a clear rationale disclosure, and provides a student note-sharing affordance gated on consent.

**Tech Stack:** PostgreSQL migrations, Fastify 5, TypeScript 5, Zod, Node test runner, pg-mem, vanilla JavaScript/HTML/CSS, n8n MCP, Capacitor Android.

**Spec:** `docs/superpowers/specs/2026-09-05-whatsapp-automation-design.md`

---

## Global Constraints

- **Optional by Design:** Parent phone is never required. If omitted or unconsented, all automations remain completely silent/off.
- **Strict Opt-In:** Checkbox must be unchecked by default. Explicit action required to consent.
- **Household Scoping:** Contact preferences belong to `households`, shared across all child profiles in that household.
- **Zero Hallucinated Numbers:** n8n must never ask LLMs to generate or guess telephone numbers via `$fromAI`. All sends bind directly to `$json.parent_phone`.
- **Template Gating:** Out-of-window proactive sends (daily tips, weekly digests, scheduled calendar reminders) require Meta-approved templates. Phase 1 focuses on collection, envelope plumbing, in-window/click-to-chat note sharing, and infrastructure readiness.
- **Strict TDD:** Every task must follow strict RED $\rightarrow$ GREEN testing before staging and committing. Touch only specified files.

---

### Task 1: Household communication preferences schema & domain model

**Files:**
- Create: `backend/db/migrations/015_household_whatsapp_preferences.sql`
- Modify: `backend/src/domain/tenancy/types.ts`
- Modify: `backend/src/domain/tenancy/repository.ts`
- Create: `backend/tests/household-whatsapp-preferences.test.ts`

**Interfaces:**
- Consumes: `TransactionalQueryable` from `backend/src/db/types.ts`.
- Produces: `HouseholdNotificationPreferences`, `UpdateHouseholdNotificationInput`, `TenancyRepository.getNotificationPreferences`, `TenancyRepository.updateNotificationPreferences`.

- [ ] **Step 1: Write failing schema and repository unit tests**

In `backend/tests/household-whatsapp-preferences.test.ts`, write unit tests using `pg-mem` asserting:
1. Migration `015` applies cleanly and adds columns `parent_phone`, `whatsapp_consent`, `whatsapp_consent_at`.
2. Initial default for a new household has `parent_phone: null`, `whatsapp_consent: false`, `whatsapp_consent_at: null`.
3. Updating with valid phone `+919876543210` and `whatsappConsent: true` sets the phone, boolean `true`, and records a non-null `whatsapp_consent_at` timestamp.
4. Setting `whatsappConsent: false` clears `whatsapp_consent_at` to `null` and toggles `whatsapp_consent` to `false`.
5. Updating with an invalid phone format (e.g. `12345` or `invalid`) is rejected.

- [ ] **Step 2: Run test and verify RED**

Run: `node --import tsx --test tests/household-whatsapp-preferences.test.ts` (from `backend/`).  
Expected: FAIL because migration `015` and repository methods do not exist yet.

- [ ] **Step 3: Create migration `015_household_whatsapp_preferences.sql`**

```sql
ALTER TABLE households
  ADD COLUMN IF NOT EXISTS parent_phone VARCHAR(32) NULL,
  ADD COLUMN IF NOT EXISTS whatsapp_consent BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS whatsapp_consent_at TIMESTAMPTZ NULL;

CREATE INDEX IF NOT EXISTS idx_households_parent_phone
  ON households(parent_phone)
  WHERE parent_phone IS NOT NULL;
```

- [ ] **Step 4: Implement domain types and repository methods**

In `backend/src/domain/tenancy/types.ts`:
* Export `HouseholdNotificationPreferences` and `UpdateHouseholdNotificationInput`.

In `backend/src/domain/tenancy/repository.ts`:
* Implement `getNotificationPreferences(db, householdId)`
* Implement `updateNotificationPreferences(db, householdId, input)`:
  * Normalizes Indian 10-digit numbers `^[6-9]\d{9}$` to `+91...`.
  * Validates E.164 pattern `/^\+[1-9]\d{6,14}$/`.
  * Sets `whatsapp_consent_at = NOW()` when consent transitions to `true`.
  * Sets `whatsapp_consent_at = NULL` when consent is `false`.

- [ ] **Step 5: Run tests and verify GREEN**

Run: `node --import tsx --test tests/household-whatsapp-preferences.test.ts`.  
Expected: PASS (all assertions green).

- [ ] **Step 6: Stage and commit Task 1**

```bash
git add backend/db/migrations/015_household_whatsapp_preferences.sql backend/src/domain/tenancy/types.ts backend/src/domain/tenancy/repository.ts backend/tests/household-whatsapp-preferences.test.ts
git commit -m "feat: add household whatsapp preferences domain"
```

---

### Task 2: Backend REST endpoints & gateway envelope plumbing

**Files:**
- Modify: `backend/src/domain/gateway/types.ts`
- Modify: `backend/src/routes/household.ts`
- Modify: `backend/src/routes/children.ts`
- Modify: `backend/src/routes/appu-gateway.ts`
- Create: `backend/tests/household-notifications-api.test.ts`
- Modify: `backend/tests/milestone4-entitlements-and-gateway.test.ts`

**Interfaces:**
- Consumes: `TenancyRepository`, `HouseholdAuthorizationService`.
- Produces: `GET /api/household/notifications`, `PATCH /api/household/notifications`, unified `PUT /api/children/:childId/personalisation` (accepts optional phone+consent), and enriched `N8nMessageEnvelope`.

> **Note on Tests:** Use the existing gateway test file `backend/tests/milestone4-entitlements-and-gateway.test.ts`. If using `pg-mem`, include the RLS-strip wrapper (migration 012 `ENABLE ROW LEVEL SECURITY` does not parse in `pg-mem`).

- [ ] **Step 1: Write failing API and gateway envelope tests**

In `backend/tests/household-notifications-api.test.ts`:
1. `GET /api/household/notifications` requires auth and returns current household phone + consent.
2. `PATCH /api/household/notifications` updates phone and consent for the authenticated parent.
3. `PUT /api/children/:childId/personalisation` successfully accepts optional `{ parentPhone, whatsappConsent }` and updates household state.

In `backend/tests/milestone4-entitlements-and-gateway.test.ts`:
1. Assert that mock `n8nClient.sendMessage` receives an envelope containing `parentPhone: '+919876543210'` and `whatsappConsent: true` when opted in.
2. Assert that if `whatsappConsent: false`, `parentPhone` is passed as `null` and `whatsappConsent: false`.

- [ ] **Step 2: Run tests and verify RED**

Run: `node --import tsx --test tests/household-notifications-api.test.ts tests/milestone4-entitlements-and-gateway.test.ts`.  
Expected: FAIL due to missing routes and envelope properties.

- [ ] **Step 3: Update `N8nMessageEnvelope`**

In `backend/src/domain/gateway/types.ts`:
```ts
export interface N8nMessageEnvelope {
  // ... existing fields ...
  parentPhone?: string | null;
  whatsappConsent?: boolean;
}
```

- [ ] **Step 4: Implement routes and gateway envelope enrichment**

* In `backend/src/routes/household.ts`: Add `GET /api/household/notifications` and `PATCH /api/household/notifications`.
* In `backend/src/routes/children.ts`: Update `updatePersonalisationSchema` to optionally accept `parentPhone` and `whatsappConsent`, saving to `TenancyRepository.updateNotificationPreferences` within the same request.
* In `backend/src/routes/appu-gateway.ts`: Query household notification preferences and inject `parentPhone` and `whatsappConsent` into the constructed envelope.

- [ ] **Step 5: Run tests and verify GREEN**

Run: `node --import tsx --test tests/household-notifications-api.test.ts tests/milestone4-entitlements-and-gateway.test.ts`.  
Expected: PASS (all assertions green).

- [ ] **Step 6: Stage and commit Task 2**

```bash
git add backend/src/domain/gateway/types.ts backend/src/routes/household.ts backend/src/routes/children.ts backend/src/routes/appu-gateway.ts backend/tests/household-notifications-api.test.ts backend/tests/milestone4-entitlements-and-gateway.test.ts
git commit -m "feat: plumb parent whatsapp consent into appu gateway envelope"
```

---

### Task 3: Upstream n8n website normalization (Phase 1 Scope)

> **IMPORTANT COORDINATION NOTICE:** Task 3 is a LIVE n8n mutation in production environment. It is production-gated and requires human confirmation. Coordinator Atlas will relay instructions manually. Do NOT touch n8n until Atlas explicitly coordinates it.
>
> **Scope Note:** In Phase 1, Task 3 modifies ONLY the "Normalize Website Input" node to pass through `parent_phone` and `whatsapp_consent`. Live send nodes (`Send template in WhatsApp Business Cloud`, `Send WhatsApp Template`) remain untouched in Phase 1 (they fire only for template/proactive sends which are Phase 2).

**Files:**
- Upstream n8n workflow: `drr7AUOcj1VrU0j8`
- Test fixture / verification script: `backend/tests/n8n-whatsapp-recipient-fixture.test.ts`

**Interfaces:**
- Node modified: `Normalize Website Input` only.

- [ ] **Step 1: Write integration test fixture for n8n normalization**

In `backend/tests/n8n-whatsapp-recipient-fixture.test.ts`:
Assert that a signed envelope with `parentPhone: '+919876543210'` and `whatsappConsent: true`:
1. Passes through `Normalize Website Input` with `parent_phone: '919876543210'` and `whatsapp_consent: true`.
2. When `whatsappConsent: false`, `parent_phone` is output as `null`.

- [ ] **Step 2: Run test fixture and verify RED**

Expected: FAIL against current n8n normalization code.

- [ ] **Step 3: Update `Normalize Website Input` in workflow `drr7AUOcj1VrU0j8`**

Add extraction and normalization for `parentPhone` and `whatsappConsent`:
```javascript
const parentPhone = j.whatsappConsent && j.parentPhone
  ? String(j.parentPhone).replace(/[^0-9]/g, '')
  : null;

return [{
  json: {
    ...j,
    // ... existing normalization ...
    parent_phone: parentPhone,
    whatsapp_consent: Boolean(j.whatsappConsent)
  }
}];
```

- [ ] **Step 4: Publish workflow and verify GREEN**

Validate and publish workflow in n8n. Run test fixture against active webhook.  
Expected: PASS.

- [ ] **Step 5: Stage and commit verification test**

```bash
git add backend/tests/n8n-whatsapp-recipient-fixture.test.ts
git commit -m "docs: record n8n whatsapp recipient binding verification"
```

---

### Task 4: Frontend personalization UI & consent collection

**Files:**
- Modify: `frontend/index.html`
- Modify: `frontend/parent-setup-ui.js`
- Modify: `frontend/parent-onboarding-shell.js`
- Modify: `frontend/style.css`
- Modify: `tests/parent-onboarding-shell.test.js`
- Modify: `tests/parent-setup-ui.test.js`

**Interfaces:**
- Consumes: `ParentOnboardingShell`, `parent-setup-ui.js`.
- Produces: Visual phone input, opt-in checkbox, "why we ask" disclosure, and payload forwarding to backend.

- [ ] **Step 1: Write failing frontend onboarding tests**

In `tests/parent-onboarding-shell.test.js` and `tests/parent-setup-ui.test.js`:
1. Assert Step 4 DOM contains `#pos-parent-phone`, `#pos-whatsapp-consent`, and rationale copy.
2. Assert `#pos-whatsapp-consent` is unchecked by default.
3. Assert saving personalization includes `parentPhone` and `whatsappConsent: true` when checked.
4. Assert entering phone without checking consent sends `whatsappConsent: false`.
5. Assert invalid phone triggers user-friendly validation banner without submitting.

- [ ] **Step 2: Run tests and verify RED**

Run: `node --test tests/parent-onboarding-shell.test.js tests/parent-setup-ui.test.js`.  
Expected: FAIL due to missing DOM elements and payload keys.

- [ ] **Step 3: Update `frontend/index.html` & `frontend/style.css`**

Add `.pos-whatsapp-section` inside `#pos-step-pers` with `#pos-parent-phone`, `#pos-whatsapp-consent`, and explanatory text. Style with luxury dark-mode glassmorphic cards and Emerald accent for WhatsApp.

- [ ] **Step 4: Update `frontend/parent-setup-ui.js` & `parent-onboarding-shell.js`**

Wire `#pos-parent-phone` and `#pos-whatsapp-consent` into `renderPersonalisationStep` and form submission. Forward in `savePersonalisation`.

- [ ] **Step 5: Run tests and verify GREEN**

Run: `node --test tests/parent-onboarding-shell.test.js tests/parent-setup-ui.test.js`.  
Expected: PASS (all assertions green).

- [ ] **Step 6: Stage and commit Task 4**

```bash
git add frontend/index.html frontend/parent-setup-ui.js frontend/parent-onboarding-shell.js frontend/style.css tests/parent-onboarding-shell.test.js tests/parent-setup-ui.test.js
git commit -m "feat: collect optional parent whatsapp phone and consent at personalization"
```

---

### Task 5: "Send study note to parent WhatsApp" in-chat affordance

> **Sender Semantics & Android Invariant:** The affordance uses client-side `https://wa.me/<parentPhone>?text=<encodedNote>`. Make sender semantics explicit in UI copy: this action opens the **user/learner's** WhatsApp client to send the note **TO** their parent (it is the user sending to the parent, not an automated server push from APPU). On Android/Capacitor, verify that triggering this intent opens the native WhatsApp app (not an in-app WebView browser).

**Files:**
- Modify: `frontend/chat-agent.js`
- Modify: `frontend/appu-backend-client.js`
- Modify: `frontend/style.css`
- Create: `tests/whatsapp-note-share.test.js`

**Interfaces:**
- Produces: In-chat action button on assistant explanations with consent-check, explicit user-to-parent copy, and `wa.me/` fallback.

- [ ] **Step 1: Write failing note-share UI tests**

In `tests/whatsapp-note-share.test.js`:
1. Assert that after an assistant explanation turn, a `.btn-share-whatsapp` affordance is available.
2. Assert UI copy clearly communicates that it opens WhatsApp on the device to send to the parent.
3. If `AppuSession` indicates parent WhatsApp is consented, clicking generates a clean, URL-encoded `https://wa.me/<parentPhone>?text=...` link.
4. If parent WhatsApp is not consented, clicking triggers an informative modal/toast prompting parental setup.
5. Image attachments are never included in the shared note URL.

- [ ] **Step 2: Run tests and verify RED**

Run: `node --test tests/whatsapp-note-share.test.js`.  
Expected: FAIL.

- [ ] **Step 3: Implement note share in `chat-agent.js` & `appu-backend-client.js`**

Add helper to generate clean educational study note summaries (sanitized of internal tags, trimmed under 500 chars) and wire click handler with consent check.

- [ ] **Step 4: Run tests and verify GREEN**

Run: `node --test tests/whatsapp-note-share.test.js`.  
Expected: PASS.

- [ ] **Step 5: Stage and commit Task 5**

```bash
git add frontend/chat-agent.js frontend/appu-backend-client.js frontend/style.css tests/whatsapp-note-share.test.js
git commit -m "feat: add study note whatsapp share affordance with consent gating"
```

---

### Task 6: Privacy policy disclosure, audits, and mobile sync

**Files:**
- Modify: `frontend/privacy-policy.html`
- Modify: `tests/public-policy-pages.test.js`
- Modify: `docs/HANDOFF.md`
- Synced output: `mobile/android/app/src/main/assets/public/**` (if tracked)

**Interfaces:**
- Produces: Truthful disclosure of WhatsApp communications, bundle audits, and Capacitor sync.

- [ ] **Step 1: Write failing privacy policy test**

In `tests/public-policy-pages.test.js`, assert that `privacy-policy.html` discloses:
1. Optional parent phone number collection for WhatsApp updates.
2. Explicit consent requirement and ability to opt out at any time.
3. Strict non-sharing of phone numbers with third parties.

- [ ] **Step 2: Run policy test and verify RED**

Run: `node --test tests/public-policy-pages.test.js`.  
Expected: FAIL.

- [ ] **Step 3: Update `frontend/privacy-policy.html`**

Add disclosure under parent communications and data sharing sections.

- [ ] **Step 4: Run complete suite and bundle audits**

```bash
node tests/audit-frontend-bundle.cjs
node tests/check-no-duplicates.cjs
node --test tests/*.test.js
python tests/page-structure.test.py
cd backend && npm run typecheck && npm run build && cd ..
cd mobile && npx cap sync android && cd ..
```

Expected: All exit `0`.

- [ ] **Step 5: Stage and commit Task 6**

```bash
git add frontend/privacy-policy.html tests/public-policy-pages.test.js docs/HANDOFF.md
git commit -m "docs: disclose whatsapp parent communications policy"
```

---

## Phase 2 Outline (Template-Gated — Out of Scope for Phase 1)

Phase 2 will be scheduled only after external dependencies are satisfied:

1. **Meta Message Template Approval (External Dependency):**
   * Review and approval of WhatsApp Business templates (`appu_daily_mission_v1`, `appu_weekly_parent_digest_v1`, `appu_study_note_v1`).
2. **Send-Node Recipient Hardening:**
   * In n8n workflow `drr7AUOcj1VrU0j8`, rebind `recipientPhoneNumber` in `Send template in WhatsApp Business Cloud` and `Send WhatsApp Template` nodes from `$fromAI(...)` to verified `$json.parent_phone`, strictly gated on `whatsapp_consent === true`.
3. **Automated Google Calendar Events:**
   * Attach OAuth credential `la60UP5jvTDO4zHz` to `Create an event in Google Calendar` node, mapping summary, start/end timestamps, and attendee emails from learner study requests.
4. **Scheduled Proactive Sends:**
   * Query database for consented parent phone numbers and dispatch scheduled morning tips and Sunday parent digests via approved Meta templates.
