# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users
School students in Class 5–12 (roughly 10–17), using Appu on their own, mostly on a phone. Parents create the account, add the learner, set controls and approve study-time unlocks, but are not in the room during daily use. Guests (not signed in) try Appu from the public landing page before a parent signs up.

## Product Purpose
APPU AI by IGR Academy is a personal learning companion: a child asks a question (typed, spoken, or as a homework photo / uploaded notes) and Appu explains it at their class level with a voice answer and visual lesson (mind map, steps, quiz, flashcards, study guide, diagram, podcast). Success is a child coming back day after day because asking Appu is the easiest way to understand schoolwork.

## Positioning
Curriculum-aware (NCERT/CBSE 2026-27) explanations in English, Kannada and Hindi, spoken in Appu's own voice, with parent oversight (reports, study-time limits, WhatsApp unlock) — a tutor a child can use alone that a parent can trust.

## Operating Context
- Daily use: a child on a phone after school or during homework, often short sessions, sometimes by voice.
- Inputs: typed question, live mic, homework photo, uploaded PDF/TXT notes or pasted text.
- Outputs: spoken answer + visual lesson card with study modes; saved lessons in "My Learning"; conversation history.
- Guardrails: study-time limit with parent WhatsApp unlock; guest allowance on the landing page; beta (payments on hold).

## Capabilities and Constraints
- Must stay: ask box with mic, Appu character, upload notes / homework photo, XP / streak / study timer — all visible on the home screen (owner decision, 2026-10-26).
- Everything else (missions, prompt library, parent zone, reports, settings, saved lessons, history, tour, theme/language) moves out of the way into a sidebar/menu.
- Static frontend (plain HTML/CSS/JS, no framework) served from Hostinger; backend api.appuai.online; brain in n8n.
- Languages: English, Kannada, Hindi throughout.
- Open decisions: registered beta chat allowance (30 vs 5), whether parent WhatsApp number is required, whether reports need a feedback rating, signed-out support contact.

## Brand Commitments
- Name: APPU AI — by IGr Academy; mascot/character "Appu" (elephant / avatar) and Appu's ElevenLabs voice.
- Reference given by the manager (2026-10-26): the Claude.ai home screen — one greeting, one big input, a quiet minimal sidebar (New, Search, Projects/Artifacts, Recents), few choices visible at once. The product must feel that simple and easy to come back to daily.

## Evidence on Hand
- QA report and fixes: docs/qa/appuai-2026-10-24/.
- No testimonials, usage metrics or school partnerships are on hand; do not invent them.

## Product Principles
1. One obvious next step: a child should know what to do within a second of opening Appu — ask.
2. Calm by default: show only what today's task needs; tools appear when asked for, not all at once.
3. Child-first language: short, friendly words a Class 5 student can read; no jargon.
4. Same experience everywhere: phone first, but laptop and the public landing page follow the same simple pattern.
5. Parents stay in control without cluttering the child's screen.

## Accessibility & Inclusion
Young readers: large readable text and touch targets (≥44px), works one-handed on a phone, full keyboard and screen-reader support, Kannada/Hindi scripts must render at readable sizes, reduced-motion respected.
