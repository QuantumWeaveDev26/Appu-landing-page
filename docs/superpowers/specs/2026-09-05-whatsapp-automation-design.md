# APPU WhatsApp & Calendar Parent Automations Design (Phase 1)

Date: 2026-09-05  
Status: Draft design for coordinator review  

---

## 1. Executive Summary & Authoritative Principles

This specification designs **Phase 1** of the parent communication system for APPU, bridging learner activity on the website and mobile app with parent visibility on WhatsApp.

### Authoritative Constraints & User Decisions
1. **Optional & Consent-Gated:** Parent phone number is strictly **optional**, collected during learner personalization (or parent setup/settings). It is gated by an explicit, unchecked-by-default opt-in checkbox with a clear, user-facing "why we ask" rationale. If no phone is provided or consent is not granted, **all automations stay completely off**.
2. **Meta 24-Hour Window & Template Reality:** Inbound messages and within-window (24-hour) replies work over Meta Graph API. However, **no approved Meta message templates exist yet**. Therefore, all proactive, out-of-window messages (daily tips, weekly digests, homework pushes) require approved Meta templates (`templateName|language_code`). Template approval is an external human/Meta dependency.
3. **Phased Delivery:**
   * **Phase 1 (This Spec):** Phone collection + opt-in consent UI (web + app), household-scoped backend storage, explicit envelope plumbing into the n8n AI gateway (`parentPhone` and `whatsappConsent` directly injected—never hallucinated via `$fromAI`), and a learner "send this note to my parent's WhatsApp" affordance (with consent gating and direct/click-to-chat fallback).
   * **Phase 2 (Outlined only):** Automated Google Calendar study event creation and scheduled out-of-window proactive sends (Daily Morning Tip, Sunday Weekly Digest), strictly gated behind approved Meta templates and OAuth credential attachment.

---

## 2. Audit Findings & System Baseline

### A. Frontend & Mobile (Web + Capacitor Android)
* **Existing Phone Fields:** There is **no phone field** anywhere in the authenticated parent onboarding or learner setup flows (`parent-setup-ui.js`, `parent-onboarding-shell.js`, `appu-session.js`). The only phone input in the repository is `#lead-phone` on `frontend/index.html`, which belongs to the static public sales lead capture modal for IGr Academy consultations.
* **Personalization Flow:** Step 4 of onboarding (`#pos-step-pers` in `frontend/index.html` and `renderPersonalisationStep` in `frontend/parent-setup-ui.js`) collects learner-specific preferences (`preferredLanguage`, `learningStyle`, `fontPreference`, `responseStyle`, `themePreference`, `favoriteSubjects`, `interests`, `goals`). This is the natural and least intrusive place to introduce the optional parent phone and consent checkbox, complete with clear rationale.
* **Android Shell:** The Capacitor Android application loads directly from `frontend/` (`webDir: "../frontend"`). Any form elements added to `frontend/index.html` and wired in `frontend/parent-setup-ui.js` automatically propagate to mobile builds upon running `npx cap sync android`.

### B. Backend Data Model & Gateway Envelope
* **Tenancy Boundary:** A `household` is the tenant boundary for a parent account. A household contains 1 or more `child_profiles`, each with a `child_personalisation` row.
* **Storage Scope:** Parent phone and WhatsApp consent belong to the **household**, not the individual child profile. If a household has two children (e.g., Aryan in Class 6 and Ananya in Class 10), updates to the parent's phone number or consent status must apply household-wide, avoiding desynchronized contact records.
* **Current Gateway Envelope (`N8nMessageEnvelope`):**
  ```ts
  {
    requestId: string;
    action: 'sendMessage';
    channel: 'website';
    sessionId: string;
    chatInput: string;
    message: string;
    language: string;
    childId?: string;
    conversationId?: string;
    conversationHistory?: Array<{ role: 'user' | 'assistant'; text: string }>;
    includeAudio?: boolean;
    imageBase64?: string;
    imageMimeType?: string;
    mentorContext: MentorContext;
  }
  ```
  The gateway currently passes **zero** parent phone, **zero** household phone, and **zero** WhatsApp recipient/consent fields. There is no identity in the payload that an n8n WhatsApp node could use.

### C. n8n Upstream Workflow (`drr7AUOcj1VrU0j8`)
* **Existing Credentials:** n8n holds credential `HAx18qTlW3pyS1eJ` (`WhatsApp account`, type `whatsAppApi`) and `la60UP5jvTDO4zHz` (`Google Calendar account`, type `googleCalendarOAuth2Api`).
* **Node Credential Status:**
  * `Send WhatsApp Reply via Meta API` (Node `fa5e8d63`): Uses a raw `httpRequest` node with an embedded access token in the query string. This is functional for 24-hour in-window replies from WhatsApp inbound messages.
  * `Send template in WhatsApp Business Cloud` (Node `ab356d08`): Type `whatsAppTool`. `credentials: {}` (unattached). Uses `$fromAI('Recipient_s_Phone_Number')`.
  * `Send WhatsApp Template` (Node `n8n-nodes-base.whatsAppTool`): `credentials: {}` (unattached). Uses `$fromAI('Recipient_s_Phone_Number')`.
  * `Create an event in Google Calendar` (Node `2e363479`): Type `googleCalendarTool`. `credentials: {}` (unattached); summary, start/end times are empty.
  * `Prepare Daily Morning Tip` / `Prepare Parent Digest`: Hardcode fallback phone `"919740595677"`.
* **Hallucination Risk:** Allowing the AI model to supply the recipient phone number via `$fromAI` is a severe data privacy risk (an LLM can hallucinate or misroute sensitive learner study notes). The recipient number **must be strictly derived from verified server state**.

---

## 3. Phase 1 Architecture & Specifications

### 3.1 Data Model & Database Migration
Create migration `015_household_whatsapp_preferences.sql`:

```sql
-- Migration: 015_household_whatsapp_preferences.sql
-- Description: Household-scoped parent contact phone and WhatsApp automation consent

ALTER TABLE households
  ADD COLUMN IF NOT EXISTS parent_phone VARCHAR(32) NULL,
  ADD COLUMN IF NOT EXISTS whatsapp_consent BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS whatsapp_consent_at TIMESTAMPTZ NULL;

CREATE INDEX IF NOT EXISTS idx_households_parent_phone
  ON households(parent_phone)
  WHERE parent_phone IS NOT NULL;
```

#### Invariants:
* `parent_phone` is stored in normalized E.164 format (e.g. `+919876543210`).
* `whatsapp_consent` is a strict boolean. It can only be `TRUE` if `parent_phone` is non-null and valid.
* `whatsapp_consent_at` captures the timestamp when consent was granted (audit/compliance requirement).
* If `whatsapp_consent` is toggled off or `parent_phone` is cleared, `whatsapp_consent` becomes `FALSE` and `whatsapp_consent_at` is set to `NULL`.

---

### 3.2 Backend Domain & REST APIs

#### 1. Household Notification Service & Repository
* Extend `backend/src/domain/tenancy/types.ts` and `repository.ts`:
  ```ts
  export interface HouseholdNotificationPreferences {
    parentPhone: string | null;
    whatsappConsent: boolean;
    whatsappConsentAt: Date | null;
  }

  export interface UpdateHouseholdNotificationInput {
    parentPhone?: string | null;
    whatsappConsent?: boolean;
  }
  ```
* Validation rules via Zod:
  * Phone: Optional string matching international E.164 (`/^\+[1-9]\d{6,14}$/`). Whitespace and dashes are stripped before validation. Indian 10-digit numbers without country code (`^[6-9]\d{9}$`) are automatically normalized to `+91...`.
  * Consent: Boolean. If `whatsappConsent === true`, `parentPhone` must be present.

#### 2. API Endpoints
* `GET /api/household/notifications`: Returns `{ parentPhone, whatsappConsent, whatsappConsentAt }` for the authenticated parent's household.
* `PATCH /api/household/notifications`: Updates phone and consent.
* **Unified Personalization Handoff:** In addition to the dedicated endpoint, `PUT /api/children/:childId/personalisation` is updated to optionally accept `{ parentPhone, whatsappConsent }`. When provided by the parent in Step 4, the backend transactionally updates the household's notification preferences alongside the child's personalization record. This ensures zero friction during onboarding.

---

### 3.3 Gateway Envelope Plumbing (`/api/appu/gateway`)

Update `N8nMessageEnvelope` in `backend/src/domain/gateway/types.ts`:
```ts
export interface N8nMessageEnvelope {
  requestId: string;
  action: 'sendMessage';
  channel: 'website';
  sessionId: string;
  chatInput: string;
  message: string;
  language: string;
  childId?: string;
  conversationId?: string;
  conversationHistory?: Array<{ role: 'user' | 'assistant'; text: string }>;
  includeAudio?: boolean;
  imageBase64?: string;
  imageMimeType?: string;
  mentorContext: MentorContext;
  // Phase 1 WhatsApp parent context:
  parentPhone?: string | null;
  whatsappConsent?: boolean;
}
```

In `backend/src/routes/appu-gateway.ts`:
* When resolving the authenticated request, read `household.parent_phone` and `household.whatsapp_consent`.
* Inject `parentPhone: household.parent_phone || null` and `whatsappConsent: Boolean(household.whatsapp_consent)` into the envelope.
* **Security Guard:** If `whatsappConsent` is false, `parentPhone` is passed as `null` or omitted from downstream tool invocations, ensuring that n8n tools can never dispatch a message without active consent.

---

### 3.4 Upstream n8n Integration (Phase 1)

1. **Normalize Website Input (Phase 1 Only):**
   * Extract `parentPhone = j.parentPhone ?? null` and `whatsappConsent = Boolean(j.whatsappConsent)`.
   * Attach to normalized output:
     ```js
     parent_phone: j.whatsappConsent ? j.parentPhone : null,
     whatsapp_consent: Boolean(j.whatsappConsent)
     ```
   * Live send nodes (`Send template in WhatsApp Business Cloud`, `Send WhatsApp Template`) are intentionally **NOT modified in Phase 1**. They only trigger for template/proactive sends which belong to Phase 2 (template-gated). Phase 1 delivery is client-side `wa.me` (Section 3.5).

---

### 3.5 Frontend UI & Learner Note Share Affordance

#### 1. Personalization Form (Step 4)
Add the optional phone and consent fields immediately below `Learning Goal for Appu` and above `Save Preferences & Launch`:
```html
<div class="pos-whatsapp-section">
  <div class="pos-whatsapp-header">
    <i class="fa-brands fa-whatsapp text-emerald"></i>
    <span class="pos-whatsapp-title">WhatsApp Parent Updates (Optional)</span>
  </div>
  <p class="pos-whatsapp-desc">
    Get study notes your child asks to share, revision recaps, and weekly learning digests sent to your WhatsApp.
  </p>
  <div class="field-grid">
    <label>
      <span id="pos-parent-phone-label">Parent WhatsApp Number</span>
      <input id="pos-parent-phone" type="tel" autocomplete="tel" placeholder="+91 98765 43210">
    </label>
  </div>
  <label class="pos-checkbox-label">
    <input id="pos-whatsapp-consent" type="checkbox">
    <span>I agree to receive learning recaps and study notes from APPU on WhatsApp. You can opt out at any time.</span>
  </label>
</div>
```

#### 2. "Send Note to Parent's WhatsApp" In-Chat Affordance
* In `frontend/chat-agent.js`, when APPU finishes explaining a key concept, summarizing homework, or generating a revision quest, a discreet action button is appended:
  `[ 📲 Share to Parent's WhatsApp ]`
* **Sender Semantics (Explicit):** The button triggers a client-side `https://wa.me/<parentPhone>?text=<encodedNote>` action. This opens the **user/learner's WhatsApp** client with a pre-filled message addressing the parent (it is the user sending to their parent, not an automated server push from APPU).
* **Behavior:**
  * If parent phone and consent are active:
    * Clicking opens `https://wa.me/<parentPhone>?text=<encodedNote>`. On Android/Capacitor, ensure this triggers the native WhatsApp app intent rather than opening an in-app WebView browser.
  * If parent has **not** opted in or phone is missing:
    * A gentle educational prompt appears: *"Parent WhatsApp is not connected. Ask your parent to enable it in Settings so you can share study notes!"*

---

## 4. Phase 2 Outline (Template & Credential Gated)

Phase 2 will be implemented only after external dependencies are satisfied:

1. **Meta Message Template Review & Approval:**
   * Submit templates in Meta Business Manager:
     * `appu_daily_mission_v1`: Morning study mission for CBSE students.
     * `appu_weekly_parent_digest_v1`: Sunday evening progress summary.
     * `appu_study_note_v1`: Student-shared homework and concept notes.
2. **Send-Node Recipient Hardening (Eliminate `$fromAI`):**
   * Rebind `recipientPhoneNumber` in `Send template in WhatsApp Business Cloud` and `Send WhatsApp Template` from `$fromAI(...)` to verified `$json.parent_phone`, strictly gated on `whatsapp_consent === true`.
3. **Scheduled Proactive Sends:**
   * Wire cron triggers in n8n or backend cron job (`Prepare Daily Morning Tip` and `Prepare Parent Digest`).
   * Query database for households where `whatsapp_consent = true` and `parent_phone IS NOT NULL`.
   * Dispatch via official `whatsAppTool` referencing approved templates.
4. **Google Calendar Tool Integration:**
   * Attach OAuth credential `la60UP5jvTDO4zHz` to `Create an event in Google Calendar`.
   * Map summary, start time, end time, and attendee email from the learner's study session request.

---

## 5. Security, Privacy & Safety Invariants

1. **Parent-Only Consent:** Only an authenticated household owner/parent can grant or revoke WhatsApp consent. A child cannot override parental consent.
2. **Zero Hallucinated Numbers:** n8n must never ask LLMs to generate or guess telephone numbers. Phone numbers originate strictly from validated database records.
3. **COPPA / Minor Safety:** Learner conversation image bytes are never sent to WhatsApp. Text notes sent to parents are sanitized and educational only.
4. **Immediate Revocation:** Unchecking the consent box immediately disables all outbound WhatsApp automations for that household.
