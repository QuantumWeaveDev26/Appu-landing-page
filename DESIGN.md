# Design

Mode: **Operate** (the signed-in learning app), with the public landing page following the same pattern later.
Pinned reference: the Claude.ai / Claude Code chat (manager, 2026-10-26). Second manager review the same day: no stage background, no mascot, no separate answer container, so the conversation is the page.

## Direction contract (Phase 1: app home)

- **THESIS:** The conversation is the page. Empty, it is one greeting and one ask box; in use, questions and Appu's answers flow down a plain column with the ask box pinned to the bottom, like Claude. It refuses the stage + popup + "Appu says" card arrangement shipped before.
- **OWN-WORLD:** Plain navy page `#0b1322` (no glows, no stage, no mascot); cyan accent `#0ea5e9` / `#38bdf8`; Manrope body, Space Grotesk headings. User turns: a rounded `#12325a` bubble on the right. Appu turns: no box; the lesson card with its study-mode tabs is inline.
- **STORY:** A child sees "What shall we learn today?", types or speaks, and reads the answer right there, switching to quiz, flashcards or mind map on the answer itself. History, saved lessons, parent controls, settings and language sit in the sidebar.
- **FIRST VIEWPORT:**
  - **Phone:** a slim top bar (menu, streak, XP, timer), the greeting in the upper third, and the try-chips and ask box pinned to the bottom.
  - **Desktop:** a permanent 280 px sidebar on the left. The greeting, chips and ask box are centred together; once chatting, the ask box pins to the bottom of a 760 px column.
- **FORM:** A Claude-style chat (sidebar, greeting, composer, transcript). Pinned by the brief; no seed was rolled.

## Durable rules

- **One primary input on screen.** The home ask box is the only composer. The former chat drawer is the main column (`body.chat-first`); the stage, the voice popup and the "Appu says" card are hidden. Answers carry their own study-mode tabs.
- **Main window = conversation only.** No top bar on desktop; on phones only the ☰ menu button. Streak, stars, level and the study timer sit in the sidebar's "My Progress"; Sign in sits at the bottom of the sidebar.
- **Sidebar order (fits without scrolling):** New chat, Recent chats, My Learning; My Progress (streak, stars, level, timer); ▸ Learning missions (collapsible, incl. Explore prompts); Parent Zone; Child Progress Report; ▸ Settings (collapsible: language, sound, voice settings, theme, tour, home); Sign in at the bottom. No policy links in the app sidebar (they stay on the public landing page). Progress pills show icon + number only.
- **Mission shortcuts:** small pill chips (min 44 px tall), never cards.
- **Touch targets:** at least 44 px (composer buttons 40 px, matching Claude's compact bar). Text: at least 16 px in inputs (avoids iOS zoom), at least 14 px for labels.
- **No marquee or scrolling banners;** the beta notice is a static, dismiss-free pill.
- **Depth:** declared once. Composer: border only. Popups: shadow only.
- **Motion:** the composer's send button fades from disabled to active, and the sidebar slides in on phones. Reduced-motion is respected.
- **Languages:** en / kn / hi copy for every new string. Kannada and Hindi need native review.
- **Adaptive to every screen:** under 1100 px the phone/tablet layout (☰ drawer, composer pinned to the bottom); from 1100 px a permanent 280 px sidebar, with the app filling the rest and the conversation column centred, `clamp(720px, 54vw, 1000px)` wide. 2K and 4K screens scale the whole page (app ×1.25/×1.6, landing ×1.35/×1.85 at 2200/3000 px) so text never looks tiny. Checked at 390, 768, 1024, 1280, 1440, 1920, 2560 and 3840 px wide.
