# Design

Mode: **Operate** (the signed-in learning app), with the public landing page following the same pattern later.
Pinned reference: the Claude.ai home screen (manager, 2026-10-26). Owner decision: keep Appu's full stage.

## Direction contract (Phase 1: app home)

- **THESIS:** One obvious action. The home screen is Appu on stage, one line of greeting, and one big ask box, like Claude's home screen. It refuses the dashboard arrangement the app shipped before (a crowded top bar, mission cards around the stage, and a separate "Type instead" step).
- **OWN-WORLD:** The incumbent Appu world is kept: deep navy stage, cyan accent `--cyan #0ea5e9` / `--cyan-bright #38bdf8`, Manrope body text, Space Grotesk display, Appu's photo avatar on the auditorium stage. The ask box is a single rounded surface (radius 24px, 1px cyan-tinted border, no glow) holding the text, **+**, the mic and send.
- **STORY:** A child opens Appu, sees Appu and "What shall we learn today?", and types or speaks. Everything else (history, saved lessons, parent controls, settings, language) is one tap away in the sidebar.
- **FIRST VIEWPORT:**
  - **Phone (390 px):** a slim top bar (menu, logo, streak/XP/timer). The stage fills the middle, with the greeting over its top. At the bottom, pinned: the "Appu says" line, the try-chips, and the ask box.
  - **Desktop (1100 px and up):** a persistent 280 px sidebar on the left. In the main column, the stage, with the greeting and ask box centred below Appu (max 720 px).
- **FORM:** A Claude-style home: sidebar, greeting, composer. Pinned by the brief; no seed was rolled.

## Durable rules

- **One primary input on screen.** The home ask box is the composer. The chat drawer remains for the conversation history view.
- **Top bar:** only the menu, brand, streak, XP, level, study timer, and sign-in (guests only). Everything else lives in the sidebar.
- **Sidebar order:** New chat, Recent chats, My Learning, learning missions (as a list), Explore prompts, Parent Zone, Child Progress Report, then settings (language, sound, voice settings, theme, tour, home). Legal links go at the bottom.
- **Mission shortcuts:** small pill chips (min 44 px tall), never cards.
- **Touch targets:** at least 44 px. Text: at least 16 px in inputs (avoids iOS zoom), at least 14 px for labels.
- **No marquee or scrolling banners;** the beta notice is a static, dismiss-free pill.
- **Depth:** declared once. Composer: border only. Popups: shadow only.
- **Motion:** the composer's send button fades from disabled to active, and the sidebar slides in on phones. Reduced-motion is respected.
- **Languages:** en / kn / hi copy for every new string. Kannada and Hindi need native review.
