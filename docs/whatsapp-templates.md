# APPU WhatsApp Message Templates — Meta Submission Checklist

Create these in **WhatsApp Manager → Message templates → Create template** (business: Quantum Weave).

Only **proactive** messages (APPU starts them, outside WhatsApp's 24-hour window) need templates. The in-chat "send note → +91 97405 95677" (user-initiated `wa.me`) and the WhatsApp context-sync replies (in-window) need **no template**.

Existing `hello_world` and `3p_direct_integration_` are Meta samples — ignore them.

## Rules
- **Name:** exactly lowercase letters + underscores as written (Meta rejects capitals/spaces).
- **Language:** create each in **English (US)** first (enough to go live). Optionally add **Kannada (kn)** + **Hindi (hi)** versions later with the same variables for localized delivery.
- **Category:** submit as marked below; Meta may reclassify `appu_daily_tip` / `appu_birthday_wish` to Marketing — that only affects pricing/opt-in, not function. Don't fight it.
- **Header / buttons:** none needed — plain body only.
- **Variables** use Meta's numbered placeholders `{{1}}`, `{{2}}`, … Provide the sample values shown (Meta requires a sample per variable at submission).
- Review time: minutes to ~24h.

---

## 1. `appu_weekly_digest` — Utility — Sunday parent progress summary
```
Hi! 📚 Here's {{1}}'s weekly learning summary with APPU:
{{2}}
Focus for next week: {{3}}
Reply here anytime to ask about your child's progress.
```
- `{{1}}` child name · `{{2}}` summary · `{{3}}` weak spots
- Samples: `Aishu` · `Completed 5 sessions on fractions and photosynthesis.` · `Long division, tenses`

## 2. `appu_study_reminder` — Utility — scheduled study reminder
```
Hi {{1}}! ⏰ Reminder: you planned to study {{2}} at {{3}} today. Open APPU whenever you're ready to begin!
```
- `{{1}}` child name · `{{2}}` topic · `{{3}}` time
- Samples: `Aishu` · `fractions` · `3:00 PM`

## 3. `appu_daily_tip` — Marketing — morning study tip
```
Good morning, {{1}}! ☀️ Today's APPU tip: {{2}}
Open APPU to explore more.
```
- `{{1}}` child name · `{{2}}` tip
- Samples: `Aishu` · `Break big problems into small steps — solve one part at a time.`

## 4. `appu_birthday_wish` — Marketing — birthday greeting (Phase D)
```
Happy Birthday, {{1}}! 🎉🎂 Wishing you a wonderful year full of learning and fun. — Team APPU
```
- `{{1}}` child name
- Sample: `Aishu`

---

## 5. `appu_study_note` — Utility — In-Chat "Send note to WhatsApp"
Dispatched directly from the chat UI when a parent or learner clicks "Send note to WhatsApp". Server-sends to the registered parent's number.
```
📝 A study note from {{1}}'s APPU learning session:

{{2}}
```
- Category: **Utility**
- Variables:
  - `{{1}}` child nickname / name (max 40 chars) · Sample: `Aarav`
  - `{{2}}` note text / key concept (max 1024 chars) · Sample: `Photosynthesis is the process by which green plants turn sunlight, water, and CO2 into food and oxygen.`
- ⚠️ Meta note: keep the body purely transactional. The earlier version's promotional sign-off ("Keep encouraging… — Team APPU") gets a Utility template **rejected** for marketing tone. Only the variables `{{1}}` (name) and `{{2}}` (note) matter to the backend — reword the rest freely as long as those two stay in that order.

## 6. `appu_parent_otp` — Authentication — 30-Min Session Hard Lock Unlock
Dispatched when the 30-minute study window hard locks and the parent requests an unlock OTP.
```
Your APPU parent unlock code is {{1}}. Valid for 10 minutes. Do not share this code.
```
- Category: **Authentication**
- Template Type: **One-time password (OTP)** / Code verification
- Button:
  - Type: **Copy code** (`copy_code`)
  - Label: `Copy code`
  - Parameter: `{{1}}`
- Variables:
  - `{{1}}` 6-digit numeric OTP · Sample: `482910`

## 7. `appu_usage_report` — Utility — Parental Session Screen Time Report
Dispatched alongside the OTP to provide parents full visibility into session active vs away duration.
```
📊 APPU study session update for {{1}}: {{2}} minutes actively learning, {{3}} minutes away or paused. The session is now paused for a parent screen-time check.
```
- Category: **Utility**
- Variables:
  - `{{1}}` child nickname / name · Sample: `Aarav`
  - `{{2}}` active minutes · Sample: `30`
  - `{{3}}` away/paused minutes · Sample: `5`
- ⚠️ Meta note: the body must **NOT** mention a "verification code" / OTP. Any reference to a code forces Meta to reclassify the template as **Authentication** (and then reject it as Utility) — this is why the earlier version failed. The unlock code is delivered by the separate `appu_parent_otp` (Authentication) template. Keep only the 3 variables `{{1}}` (name), `{{2}}` (active min), `{{3}}` (away min) in that order; reword the rest freely.

---

## After approval
Send the coordinator the **exact approved names + language codes** (e.g. `appu_birthday_wish|en_US`). The variable **order must match** what the backend/n8n sends, so the send logic will be wired to these exact bodies.

**Unblocks:** Phase D (birthday) + weekly parent digest + daily tip + study reminders — all gated on these templates today.

**Prereqs already in place:** parent phone + WhatsApp consent collected (migration 015); DOB collected (migration 016); WhatsApp Business number connected (phoneNumberId 1288446054350994).
