# APPU app ↔ website parity checklist

Goal (user, 2026-11-25): the native app must look like the website (DESIGN.md: Claude-style, the conversation is the page) and have every website feature working. No web wrapper.

Last update 2026-11-25 (build 5: light theme + automated tests). Status: ✅ done · 🟡 partial · ⬜ todo

## A. Look & layout (DESIGN.md)
- ✅ Navy `#0b1322` page, cyan `#0ea5e9`/`#38bdf8`, user bubble `#12325a`, Appu turn unboxed
- ✅ Manrope body / Space Grotesk headings
- ✅ Chat-first home: greeting "What shall we learn today?", 4 try-chips, composer pinned bottom
- ✅ ☰ sidebar drawer: New chat, Recent chats, My Learning; My Progress; ▸ Learning missions (+ Explore prompts); Parent Zone; Child Progress Report; ▸ Settings (language, sound, voice, theme, tour, home); Sign in at bottom
- ✅ Light theme (☰ → Settings → Light mode; applied at start-up, app restarts; every colour goes through `tc()`)

## B. Chat
- ✅ Text chat, guest 5 free chats, sign-in / profile / feedback gates (from Sept build)
- ✅ Inline lesson card with study-mode tabs on every answer (lesson, quiz, flashcards, diagram, guide, podcast)
- ✅ Recent chats (history) open/resume
- ✅ Clear all history (Recent chats 🗑) + delete one chat
- ✅ Photo question (camera / gallery, resized, sent as imageBase64)
- ✅ Notes upload (PDF via n8n LqrcpkSkFB72YH4F, Word, text, photo, paste) → notes tutor lesson
- ✅ Quick-reply chips after each answer
- ✅ Share answer (share sheet) + WhatsApp
- ✅ Guest limit card (sign in / register / see plans)

## C. Voice (ElevenLabs only)
- ✅ No device TTS anywhere
- ✅ Mic = always-on voice typing, red on-state, barge-in (lib/liveVoice.ts)
- ✅ Call button → full-screen call (listening/thinking/speaking, tap to interrupt, end), call start/end markers in chat

## D. Learning & progress
- ✅ XP / streak / level / badges (real, v2 rules as website app.js BADGE_RULES) + achievements sheet
- ✅ XP awards: question asked, quiz correct, flashcard mastered, diagram mastered
- ✅ My Learning: save lesson, list, reopen, delete
- ✅ Brain break (Class 5–8, Maths Match / Memory Flip, ElevenLabs voice lines)
- ✅ Learning missions chips + Explore prompts library

## E. Parents
- ✅ Parent Zone (children, personalisation, subscription) — website fonts/colours
- ✅ Child progress report (download, feedback) — website fonts/colours
- ✅ Parental screen-time lock (OTP via WhatsApp; dormant while server `enabled=false`)
- ✅ Study schedule / reminders — website fonts/colours

## F. Account & misc
- ✅ Auth (email, Google) — website fonts/colours
- 🟡 Onboarding tour (app slides; website tour.js steps not ported)
- ✅ Settings + full UI translation en/hi/kn (website dictionary + app strings; legal text stays English like the website)
- ✅ Legal pages
- ✅ Free Beta pill

## G. Release
- 🟡 Prod app id `online.appuai.appu` via app.config.js + eas production profile (AAB); needs Play Console account

## Tests
- `npm test` (in native/): 98 tests, node:test, no device needed — voice/barge-in, lessons, podcast, notes/PDF/Word, progress & badges, saved lessons, en/hi/kn translation, light/dark theme contrast, every button has an action, every menu item wired, routes, release config.
- `npm run typecheck`

## 2026-11-25 fixes after phone test (build 6c1a3ce4)
- ✅ Picture visuals under every answer: comic-strip "See it in steps" + drawn mind map (lessons/DoodleVisual.tsx, port of frontend/doodle-visual.js)
- ✅ Call barge-in: one stop word interrupts; newest words judged; echo stripped; mic+voice mixed audio mode
- ✅ Turn-taking: listening restarts when Appu finishes; error without 'end' restarts; watchdog revives a silent recogniser
- ✅ Keyboard: message bar rises above the keyboard (react-native-keyboard-controller)
- ✅ Kid-friendly home: Appu picture, big colour mission tiles, "Talk to Appu" button, one-row message bar
