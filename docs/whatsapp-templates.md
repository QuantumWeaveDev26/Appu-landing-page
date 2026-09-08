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

## After approval
Send the coordinator the **exact approved names + language codes** (e.g. `appu_birthday_wish|en_US`). The variable **order must match** what the backend/n8n sends, so the send logic will be wired to these exact bodies.

**Unblocks:** Phase D (birthday) + weekly parent digest + daily tip + study reminders — all gated on these templates today.

**Prereqs already in place:** parent phone + WhatsApp consent collected (migration 015); DOB collected (migration 016); WhatsApp Business number connected (phoneNumberId 1288446054350994).
