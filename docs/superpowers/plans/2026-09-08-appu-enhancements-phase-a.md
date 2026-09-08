# APPU System Enhancements Implementation Plan (Phase A)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement Phase A frontend-only enhancements: (1) Persistent Voice Response Popup, (2) Navigation Drawer i18n, (3) Route WhatsApp Study Note Share to Fixed Number `919740595677`, and (4) Visible Sign In / Sign Up CTA on the main page.

**Architecture:** Frontend-only presentation and interaction layer updates across `frontend/index.html`, `frontend/app.js`, `frontend/chat-agent.js`, `frontend/appu-backend-client.js`, `frontend/parent-onboarding-shell.js`, and `frontend/style.css`. Zero backend API changes, zero database migrations.

**Tech Stack:** Vanilla JavaScript (ES2022), HTML5, CSS3, Node.js test runner (`node:test`, `node:assert/strict`), Capacitor Android sync.

**Spec:** `docs/superpowers/specs/2026-09-08-appu-enhancements-design.md`

---

## Global Constraints

- **Strict TDD:** Every task must follow strict RED $\rightarrow$ GREEN testing before staging and committing. Touch only specified files.
- **No Version Bumps in Tasks:** Do NOT bump version strings (e.g. `?v=20260908-1`) in individual plan steps. The coordinator handles version bumping at deploy time.
- **Preserve Security Invariants:** No secrets, no plaintext credentials, and no unencrypted token persistence in `localStorage`.
- **Zero Hallucinated Numbers:** WhatsApp study note sharing strictly routes to the fixed verified number `919740595677`.
- **Responsive & Accessible:** All new interactive elements must have clear focus styles, `aria-label` / `aria-live` attributes, and adhere to the dark luxury glassmorphism design system.

---

### Task 1: Route WhatsApp Study Note Share to Fixed Number `919740595677` (Item 3)

**Files:**
- Modify: `frontend/appu-backend-client.js`
- Modify: `frontend/chat-agent.js`
- Modify: `tests/whatsapp-note-share.test.js`

**Context:** The existing "Share note to parent's WhatsApp" button verifies `parentPhone` and `whatsappConsent` from session state, falling back to Parent Zone setup modal if missing. This task updates the destination to APPU's fixed study companion number (`919740595677`), removes the consent gate (since the learner is voluntarily sharing to APPU's line), and updates UI copy while preserving formatting sanitization, character budget, and image exclusion.

- [ ] **Step 1: Update unit tests in `tests/whatsapp-note-share.test.js` to assert new requirements (RED)**

In `tests/whatsapp-note-share.test.js`:
1. Assert `AppuBackendClient.buildWhatsAppShareUrl()` defaults to recipient `919740595677` when `targetPhone` is omitted or passed as `919740595677`.
2. Assert clicking `.btn-share-whatsapp` generates `https://wa.me/919740595677?text=...` even when `AppuSession.parentContext` has no phone and `whatsappConsent` is false.
3. Assert clicking the button does NOT trigger `ParentSetupUI.openModal(4)` or an alert prompt.
4. Assert button text reflects "Send note to WhatsApp" or "Share note on WhatsApp".

- [ ] **Step 2: Run tests and verify RED**

Run: `node --test tests/whatsapp-note-share.test.js`  
Expected: FAIL on target phone number and unconsented direct send assertions.

- [ ] **Step 3: Update `frontend/appu-backend-client.js`**

Update `buildWhatsAppShareUrl(targetPhone = '919740595677', text, childName = '')`:
- Default `targetPhone` to `'919740595677'`.
- Clean non-digits: `const cleanPhone = (typeof targetPhone === 'string' && targetPhone.trim()) ? targetPhone.replace(/\D/g, '') : '919740595677';`
- Return `https://wa.me/${cleanPhone || '919740595677'}?text=${encodeURIComponent(formattedNote)}`.

- [ ] **Step 4: Update `frontend/chat-agent.js`**

In `renderMessage(msg)`:
- Update button markup:
  - `shareBtn.setAttribute('title', "Send study note to APPU on WhatsApp");`
  - `shareBtn.setAttribute('aria-label', "Send study note to APPU on WhatsApp");`
  - `shareBtn.innerHTML = '<i class="fa-brands fa-whatsapp" aria-hidden="true"></i> <span>Send note to WhatsApp</span>';`
- In `shareBtn.onclick`:
  - Remove parent phone/consent lookup and modal 4 fallback.
  - Read `childName` from session or personalization.
  - Call `client.buildWhatsAppShareUrl('919740595677', msg.text, childName)`.
  - Open via `window.open(url, '_blank')`.

- [ ] **Step 5: Run tests and verify GREEN**

Run: `node --test tests/whatsapp-note-share.test.js`  
Expected: PASS (all assertions green).

- [ ] **Step 6: Stage and commit Task 1**

```bash
git add frontend/appu-backend-client.js frontend/chat-agent.js tests/whatsapp-note-share.test.js
git commit -m "feat: route whatsapp study note share to fixed companion number"
```

---

### Task 2: Add Visible Sign In / Sign Up CTA on Main Page & Drawer (Item 2)

**Files:**
- Modify: `frontend/index.html`
- Modify: `frontend/parent-onboarding-shell.js`
- Modify: `frontend/app.js`
- Modify: `frontend/style.css`
- Create: `tests/landing-auth-ui.test.js`

**Context:** Currently, unauthenticated users who skip the welcome gate or visit on web must discover "Parent Setup" to log in. This task introduces an explicit, visible "Sign in / Sign up" button on the main stage/topbar and inside the native navigation drawer.

- [ ] **Step 1: Write failing unit tests in `tests/landing-auth-ui.test.js` (RED)**

Create `tests/landing-auth-ui.test.js` asserting:
1. When session is unauthenticated, `#btn-main-auth` is rendered and visible.
2. Clicking `#btn-main-auth` invokes `ParentSetupUI.openModal(1)` (Auth Step 1).
3. When `AppuSession.isAuthenticated()` becomes true, `#btn-main-auth` is hidden and `#parent-session-badge` is visible.
4. In native app mode, `#btn-main-auth` is accessible in the navigation drawer account slot.

- [ ] **Step 2: Run test and verify RED**

Run: `node --test tests/landing-auth-ui.test.js`  
Expected: FAIL because `#btn-main-auth` is not present in DOM or wired in auth lifecycle.

- [ ] **Step 3: Update `frontend/index.html`**

1. Inside `.topbar-actions` (adjacent to `#parent-session-badge`):
   ```html
   <button id="btn-main-auth" class="auth-pill-btn" type="button">
     <i class="fa-solid fa-arrow-right-to-bracket" aria-hidden="true"></i>
     <span>Sign in / Sign up</span>
   </button>
   ```
2. Inside `#nav-drawer-account-slot`: include placeholder for native auth action.

- [ ] **Step 4: Update `frontend/style.css`**

Add styles for `.auth-pill-btn`:
- Cyan neon border outline (`1px solid rgba(0, 242, 254, 0.4)`), glass background (`rgba(10, 25, 47, 0.7)`).
- Hover transition, glowing shadow, accessible font size, flex alignment.

- [ ] **Step 5: Wire click handler & session sync**

1. In `frontend/parent-onboarding-shell.js` (`updateHeaderSessionBadge`):
   - When authenticated (`isAuthed`): hide `#btn-main-auth` (`style.display = 'none'`).
   - When unauthenticated: display `#btn-main-auth` (`style.display = 'inline-flex'`).
2. In `frontend/app.js`:
   - Attach click listener to `#btn-main-auth`:
     ```javascript
     const btnMainAuth = document.getElementById('btn-main-auth');
     if (btnMainAuth) {
       btnMainAuth.addEventListener('click', () => {
         if (window.ParentSetupUI && typeof window.ParentSetupUI.openModal === 'function') {
           window.ParentSetupUI.openModal(1);
         }
       });
     }
     ```
   - In native mode (`isNativePlatform`), relocate or clone `#btn-main-auth` into `#nav-drawer-account-slot`.

- [ ] **Step 6: Run tests and verify GREEN**

Run: `node --test tests/landing-auth-ui.test.js`  
Expected: PASS (all assertions green).

- [ ] **Step 7: Stage and commit Task 2**

```bash
git add frontend/index.html frontend/parent-onboarding-shell.js frontend/app.js frontend/style.css tests/landing-auth-ui.test.js
git commit -m "feat: add visible sign in and sign up cta on main page and navigation drawer"
```

---

### Task 3: Translate Left-Side Drawer Menu Strings (Item 6)

**Files:**
- Modify: `frontend/app.js`
- Create: `tests/drawer-i18n.test.js`

**Context:** The left-side navigation drawer (`#nav-drawer`) currently stays 100% English when language is switched to Kannada or Hindi. This task wires all drawer strings into `UI_TRANSLATIONS` and `applyUiTranslations(lang)`.

- [ ] **Step 1: Write failing unit test in `tests/drawer-i18n.test.js` (RED)**

Create `tests/drawer-i18n.test.js` asserting:
1. Calling `setLanguage('kn')` translates:
   - `#nav-drawer-title small` $\rightarrow$ `'ಅಪ್ಪುವಿನೊಂದಿಗೆ ಕಲಿಯಿರಿ'`
   - `#btn-close-nav-drawer` aria-label $\rightarrow$ `'ಮೆನು ಮುಚ್ಚಿ'`
   - `#btn-quick-schedule span` $\rightarrow$ `'ಬೆಂಬಲ ಕರೆಯನ್ನು ನಿಗದಿಪಡಿಸಿ'`
   - `#btn-sound-toggle span` $\rightarrow$ `'ಧ್ವನಿ ಪರಿಣಾಮಗಳು'`
   - Legal links (`Privacy Policy`, `Terms & Conditions`, `Cancellation & Refunds`, `Shipping & Delivery`, `Pricing`, `Contact Us`) $\rightarrow$ Kannada equivalents.
2. Calling `setLanguage('hi')` translates all drawer items into Hindi equivalents.
3. Calling `setLanguage('en')` restores English strings.

- [ ] **Step 2: Run test and verify RED**

Run: `node --test tests/drawer-i18n.test.js`  
Expected: FAIL because `applyUiTranslations` does not touch drawer elements.

- [ ] **Step 3: Update `frontend/app.js`**

1. In `UI_TRANSLATIONS`:
   - Add drawer dictionary keys for `en`, `kn`, and `hi`:
     - `drawerLearnWithAppu`
     - `drawerCloseMenu`
     - `drawerScheduleCall`
     - `drawerSoundEffects`
     - `drawerPrivacy`
     - `drawerTerms`
     - `drawerCancellation`
     - `drawerShipping`
     - `drawerPricing`
     - `drawerContact`
2. In `applyUiTranslations(lang)`:
   - Update drawer title small copy.
   - Update close button aria-label.
   - Update quick schedule button span, title, aria-label.
   - Update sound toggle button span, aria-label.
   - Query `.nav-drawer-legal a` elements by matching `href` and update `textContent`.

- [ ] **Step 4: Run tests and verify GREEN**

Run: `node --test tests/drawer-i18n.test.js`  
Expected: PASS (all assertions green).

- [ ] **Step 5: Stage and commit Task 3**

```bash
git add frontend/app.js tests/drawer-i18n.test.js
git commit -m "fix: wire navigation drawer strings into language translation system"
```

---

### Task 4: Implement Persistent Voice Response Popup (Item 7)

**Files:**
- Modify: `frontend/index.html`
- Modify: `frontend/app.js`
- Modify: `frontend/voice-engine.js`
- Modify: `frontend/style.css`
- Create: `tests/voice-popup-persistence.test.js`

**Context:** When interacting by voice with the chat drawer closed, Appu's audio response currently mirrors into `#subtitles-text`, but vanishes within seconds as speech recognition restarts or when the user speaks again. This task adds a dedicated persistent voice popup that holds Appu's reply for a minimum of 30 seconds or until the NEXT assistant response arrives.

- [ ] **Step 1: Write failing unit test in `tests/voice-popup-persistence.test.js` (RED)**

Create `tests/voice-popup-persistence.test.js` asserting:
1. When voice interaction receives assistant reply, `#voice-reply-popup` becomes visible with reply text.
2. When speech recognition starts (`recognition.onstart`) and streams "Listening...", `#voice-reply-popup` remains visible with the assistant's previous text intact.
3. When user interim transcript arrives, `#voice-reply-popup` remains visible and unaffected.
4. Popup persists until either:
   - Next assistant response arrives (updates text and resets timer).
   - Dismiss button (`#btn-close-voice-popup`) is clicked.
   - 30 seconds elapse without a new response.
5. Opening chat drawer dismisses the popup cleanly.

- [ ] **Step 2: Run test and verify RED**

Run: `node --test tests/voice-popup-persistence.test.js`  
Expected: FAIL because `#voice-reply-popup` does not exist and persistence logic is unimplemented.

- [ ] **Step 3: Update `frontend/index.html`**

Add `#voice-reply-popup` markup above `.response-dock`:
```html
<div id="voice-reply-popup" class="voice-reply-popup" role="region" aria-live="polite" hidden>
  <div class="voice-popup-header">
    <div class="voice-popup-title">
      <span class="online-dot" aria-hidden="true"></span>
      <strong id="voice-popup-title-text">Appu says</strong>
    </div>
    <button id="btn-close-voice-popup" class="icon-btn voice-popup-close" type="button" aria-label="Dismiss response">
      <i class="fa-solid fa-xmark" aria-hidden="true"></i>
    </button>
  </div>
  <div id="voice-popup-content" class="voice-popup-body"></div>
</div>
```

- [ ] **Step 4: Update `frontend/style.css`**

Style `.voice-reply-popup`:
- Floating glassmorphic card (`backdrop-filter: blur(16px)`, `background: rgba(10, 25, 47, 0.9)`).
- Max-width 640px, centered above the bottom control dock, z-index 90.
- Cyan accent border (`border: 1px solid rgba(0, 242, 254, 0.35)`).
- Dismiss button positioned top-right.
- Smooth opacity and translateY entrance transition.

- [ ] **Step 5: Implement Voice Popup Controller in `frontend/app.js`**

1. Create helper functions:
   - `showVoicePopup(text)`:
     - Sets `#voice-popup-content.textContent = text`.
     - Shows `#voice-reply-popup` (`hidden = false`, adds `.is-visible`).
     - Clears existing popup auto-hide timer.
     - Sets timer to auto-hide after `Math.max(30000, readingDurationMs)`.
   - `hideVoicePopup()`:
     - Clears timer.
     - Hides `#voice-reply-popup` (`hidden = true`, removes `.is-visible`).
2. Hook into `handleUserInteraction`:
   - When assistant reply is received and `#chat-drawer` is not open: call `showVoicePopup(reply)`.
3. Dismiss triggers:
   - Close button click: `hideVoicePopup()`.
   - Chat drawer open: `hideVoicePopup()`.
4. Ensure `voiceEngine` status updates (`Listening...`, interim speech) target `.response-card` / `#subtitles-text` only, leaving `#voice-reply-popup` untouched.

- [ ] **Step 6: Run tests and verify GREEN**

Run: `node --test tests/voice-popup-persistence.test.js`  
Expected: PASS (all assertions green).

- [ ] **Step 7: Stage and commit Task 4**

```bash
git add frontend/index.html frontend/app.js frontend/voice-engine.js frontend/style.css tests/voice-popup-persistence.test.js
git commit -m "feat: implement persistent voice response popup for hands-free conversations"
```

---

### Task 5: Full Regression & Bundle Verification

- [ ] **Step 1: Run all unit and integration tests**

```bash
node --test tests/*.test.js
```
Expected: All tests PASS.

- [ ] **Step 2: Run frontend bundle audit and duplication check**

```bash
node tests/audit-frontend-bundle.cjs
node tests/check-no-duplicates.cjs
python tests/page-structure.test.py
```
Expected: 0 bundle errors, 0 duplicate files, all page structure tests pass.

- [ ] **Step 3: Verify no version bumps were made in working tree**

Confirm version references remain untouched. (Coordinator will bump version at deploy time).
