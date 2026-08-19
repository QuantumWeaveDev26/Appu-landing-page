# 01 — Design Architecture

Extracted from the Artlist Seedance 2.5 model page. This is the full page blueprint: section order, each section's job, content anatomy, and the design principles that govern the whole page.

---

## 1. Design Read (one line)

**A premium cinematic SaaS landing page for professional video creators — dark editorial base, film-industry art direction, numbered storytelling, card-driven feature grids, trust-first tone.**

Dial settings this design operates at:

- `DESIGN_VARIANCE`: 7 — asymmetric editorial sections, not strict grid symmetry
- `MOTION_INTENSITY`: 5 — restrained: hover states, card sliders, scroll reveals. No gimmicks
- `VISUAL_DENSITY`: 4 — generous whitespace, one idea per section

---

## 2. Page Architecture (top → bottom)

```
┌─────────────────────────────────────────────────────┐
│ 01 NAVBAR        — sticky, product links + CTA       │
│ 02 BREADCRUMB    — Home / Artlist AI / Models / Seedance 2.5 │
│ 03 HERO          — H1 + subtext + primary CTA        │
│ 04 WHAT-IS       — definition block + editorial image │
│ 05 WHY SECTION   — 5-card slider ("Why creators choose") │
│ 06 HOW-TO        — 4 numbered steps (01–04)          │
│ 07 CAPABILITIES  — 8-card feature grid ("What it can do") │
│ 08 BANNER/SPOTLIGHT — promo: 1080p / 10-bit + CTA    │
│ 09 FAQ           — accordion, 8 questions            │
│ 10 FINAL CTA     — closing value prop + CTA          │
│ 11 FOOTER        — 5-column link maze + social icons │
└─────────────────────────────────────────────────────┘
```

---

## 3. Section-by-Section Blueprint

### 01 — Navbar
- **Job:** Wayfinding + conversion. Always visible.
- **Anatomy:** Logo (left) → primary nav: AI Video, AI Image, AI Voiceover, AI Music + drop-downs (AI Toolkit, Stock Catalog, Studio) → right side: Business, Pricing, Sign In (ghost) + "Start Free Now" (primary pill CTA).
- **Structure:** Single-line, ≤80px tall. Mobile collapses to hamburger.

### 02 — Breadcrumb
- **Job:** Confirm location inside the site hierarchy.
- **Anatomy:** `Home / Artlist AI / Models / Seedance 2.5` — small, muted, separated by slashes, last item emphasized.
- **Key detail:** SEO + UX in one. Small but present.

### 03 — Hero
- **Job:** State what the product is + what changed, in one screen.
- **Anatomy:**
  - H1: `Seedance 2.5: 30 seconds of AI video on Artlist` (headline = product name + one big benefit)
  - Subtext (≤3 lines): what's new — 30s one-pass generation, 50 references, synced dialogue/music/effects
  - Primary CTA: `Explore Seedance 2.5` (arrow icon, pill)
- **Rules:** CTA visible without scroll. Headline ≤2 lines on desktop.

### 04 — What Is (definition block)
- **Job:** Explain the product in plain language.
- **Anatomy:** H2 `What is Seedance 2.5?` + 1 paragraph + CTA link + one large editorial image (35mm filmstrip metaphor).
- **Key detail:** Every concept is explained with a cinematic metaphor image (filmstrip, reels, clapperboard) — not generic stock.

### 05 — Why Creators Choose (card slider)
- **Job:** Benefits, sequenced as a story.
- **Anatomy:** H2 `Why creators choose Seedance 2.5` + horizontally scrollable/slider cards. Each card:
  - Arrow affordance (`→`)
  - H3 title (e.g., "Create a beginning, middle, and end")
  - Body copy (2–3 sentences)
  - Art-directed image (dawn-to-dusk take, corkboard refs, footstep sync…)
- **Count:** 5 cards. Horizontal scroll-snap with arrows on desktop, swipe on mobile.

### 06 — How To (numbered steps)
- **Job:** Reduce friction — show the workflow is 4 steps.
- **Anatomy:** H2 `How to create with Seedance 2.5?` + 4 steps, each:
  - Large numeral (`01`, `02`, `03`, `04`) — the strongest typographic element
  - H3 title + 2-sentence body
- **Layout:** Vertical list or 2×2 grid with generous gutters. Numerals drive the rhythm.

### 07 — Capabilities (feature grid)
- **Job:** Exhaustive feature list without a wall of text.
- **Anatomy:** H2 `What Seedance 2.5 can do` + 8 cards, each:
  - `→` affordance
  - H3 (e.g., "Multi-shot generation", "Reference-driven editing")
  - 1–2 sentence body
  - Art-directed icon image (miniature film sets, light table, scissors on filmstrip…)
- **Layout:** 4×2 grid on desktop → 2×4 → 1-col mobile.

### 08 — Spotlight Banner
- **Job:** Promo moment (1080p + 10-bit color launch, 25% off).
- **Anatomy:** Bold short headline + 1-line body + CTA `Try It Here`. Backed by two product images (branded model cards).
- **Key detail:** Distinct background treatment (tinted/dark panel) to break section rhythm — the one "color block" moment on the page.

### 09 — FAQ (accordion)
- **Job:** Remove objections (pricing, resolution, languages, inclusion).
- **Anatomy:** H2 `Frequently asked questions` + 8 expandable items. Q = H3, A = body. Last item ends with support link (`Still have questions? We're here to help`).
- **Behavior:** One open at a time, chevron rotates, content expands smoothly.

### 10 — Final CTA
- **Job:** Close with the strongest value proposition.
- **Anatomy:** H2 `Start creating with Seedance 2.5` + 2-line body (one subscription, one license, every model in one tab) + `Start Creating` primary CTA.

### 11 — Footer
- **Job:** Full site map + trust.
- **Anatomy:** Mission statement block + 5 link columns (AI Products & Tools, Stock Catalog, Company, Enterprise Solutions, Join Us, Help/Resources/License & Terms) + social icon row (YouTube, Instagram, Facebook, TikTok, X, Spotify, LinkedIn) + legal line.
- **Key detail:** Mission text above links — the page ends on the brand story, not just links.

---

## 4. Design Principles (what makes it feel premium)

1. **Cinematic metaphor system** — every feature is illustrated with a film-industry object (filmstrip, clapperboard, viewfinder, light table, tape reels). One consistent visual world, never generic stock.
2. **Numbered storytelling** — workflows are always steps (01–04). Numbers are typographic heroes, not decorations.
3. **One message per section** — every section has exactly one H2 and one job. No data dumps.
4. **Benefit-first copy** — headlines are benefits ("Sound that lands finished"), not features ("audio generation").
5. **Contrast of scales** — huge display headlines vs. small muted body. The hierarchy does the work, not borders.
6. **Card slider over long lists** — 5 cards scroll horizontally instead of a 5-row list.
7. **Trust architecture** — breadcrumb, FAQ, license links, help center — every objection has an exit.
8. **Restrained motion** — hover physics on CTAs, smooth slider, accordion easing. Nothing auto-plays or chases attention.

---

## 5. What NOT to do (anti-patterns this page avoids)

- No purple "AI gradient" slop
- No autoplaying video loops in hero
- No centered-everything layout — editorial asymmetry instead
- No 20-row spec tables
- No generic stock photography — art direction is metaphor-driven
- No marquee walls of fake logos
