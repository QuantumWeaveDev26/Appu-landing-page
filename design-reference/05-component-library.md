# 05 — Component Library

Every reusable component observed on the Artlist Seedance 2.5 page, with anatomy, states, and implementation notes.

---

## 1. Primary Button (CTA)

```html
<a href="#" class="btn-primary">
  Explore Seedance 2.5
  <span class="btn-icon">→</span>
</a>
```

- **Anatomy:** pill (`border-radius: 999px`), `padding: 12px 24px`, fill `var(--accent)`, text `var(--accent-text-on)` 15px/600, trailing arrow icon.
- **States:**
  - `:hover` — accent lightens, icon translates `+2px` right (`group-hover:translate-x-0.5`)
  - `:active` — `scale(0.98)` physical press
  - focus-visible — 2px white ring offset 2px
- **Rules:** text fits one line; label ≤ 3 words; only one primary per section.

## 2. Secondary / Ghost Button

- **Anatomy:** pill, `1px var(--border-hairline-strong)` border, transparent fill, `var(--text-primary)` text.
- **States:** hover → background `rgba(255,255,255,0.06)`; active → `scale(0.98)`.
- Used for: `Sign In`, secondary actions.

## 3. Navbar

- **Anatomy:** sticky top, `max-width` container, height ≤80px. Left: logo. Center/left: nav links (AI Video, AI Image, AI Voiceover, AI Music + dropdowns: AI Toolkit, Stock Catalog, Studio). Right: ghost `Sign In` + primary `Start Free Now`.
- **Surface:** `backdrop-filter: blur(16px)` with `rgba(10,12,18,0.8)` + hairline bottom border. Blur only on fixed elements.
- **Mobile:** hamburger → full-screen overlay menu, links stagger in (`translate-y-12 opacity-0` → visible, 100ms stagger).

## 4. Breadcrumb

- **Anatomy:** `Home / Artlist AI / Models / Seedance 2.5` — small (`0.75rem`), `--text-muted`, `/` separators, current page in `--text-primary`.
- Semantic `<nav aria-label="Breadcrumb">` with `<ol>`.

## 5. Feature Card (capabilities grid & slider cards)

- **Anatomy:**
  ```
  ┌─────────────────────┐
  │ [art-directed image] │  ← 4:3 or 3:2, radius-top
  ├─────────────────────┤
  │ →                   │  ← arrow affordance, top-right
  │ H3 title            │
  │ body (1–2 sentences)│
  └─────────────────────┘
  ```
- **Surface:** `--bg-raised`, `1px var(--border-hairline)`, radius `16–20px` (one radius scale page-wide), padding `24px`.
- **States:** hover → border strengthens to `--border-hairline-strong`, image scales 1.02 (transform only).
- **Sizes:** slider cards (Why section) larger + horizontal; grid cards (Capabilities) uniform.

## 6. Step Card (How-To)

- **Anatomy:** huge numeral (`clamp(3rem,6vw,5rem)`, weight 700, `--text-muted` or accent-soft) + H3 + body. No box needed — hairline divider or whitespace separates steps.
- **Numerals are the hero element**, not the title.

## 7. Slider / Horizontal Scroller (Why section)

- **Behavior:** `overflow-x: auto` + `scroll-snap-type: x mandatory`; each card `scroll-snap-align: start`. Arrow buttons scroll by card width. Touch swipe on mobile. Hide native scrollbar.
- **Reduced motion:** snap still works; no autoplay.

## 8. Accordion (FAQ)

- **Anatomy:** list of items, each = button row (H3 question + chevron) + collapsible answer. Hairline `border-top` between items, `border-bottom` on the list.
- **States:** chevron `rotate(180deg)` on open; content `grid-template-rows: 0fr → 1fr` transition (or height auto with `ease-[cubic-bezier(0.32,0.72,0,1)]`, 300–400ms).
- **Accessibility:** full `<button aria-expanded aria-controls>`, one open at a time.
- **Footer note:** last item → support link ("Still have questions? We're here to help").

## 9. Spotlight Banner

- **Anatomy:** full-width panel on `--bg-sunken` (or accent-soft tint), top radial glow `rgba(255,77,61,0.08)`. Inside: short H2 + 1-line body + primary CTA + product images (branded model cards).
- **This is the page's single color-block moment.** Use once.

## 10. Footer

- **Anatomy:** mission statement (H3 + 1 paragraph) at top, then link columns (AI Products & Tools, Stock Catalog, Company, Enterprise Solutions, Join Us, Help & Resources & Legal) — 5 columns desktop, 2–3 tablet, 1 mobile.
- Link style: `0.875rem`, `--text-secondary`, hover `--text-primary`. Column titles: `0.75rem`, weight 600, `--text-muted`.
- **Social row:** 7 icon buttons (YouTube, Instagram, Facebook, TikTok, X, Spotify, LinkedIn) — stroke icons, hairline circle or text links.
- **Legal line:** `© / accessibility / AI model disclosure` at very bottom.

## 11. Section Header (shared)

- **Anatomy:** optional eyebrow (tiny uppercase, wide tracking — max 1 per 3 sections) → H2 (`clamp(1.75rem,3vw,2.5rem)`, 700, `-0.02em`) → optional body ≤ 25 words, `max-width: 65ch`.
- Stacked vertically, left-aligned or centered by section.

---

## 12. Global Component Rules

- **One corner-radius scale per page.** Suggested: cards 16–20px, buttons 999px, inputs 10px. Documented and consistent.
- **All interactive elements have all 4 states:** default, hover, focus-visible, active (and loading/empty/error where relevant).
- **No duplicate CTA intent:** one label per intent per page (e.g. "Explore Seedance 2.5" used once in hero + once in What-Is as the same action).
- **Buttons contrast-checked:** text vs. fill ≥ 3:1 (large) / 4.5:1 (body). Ghost buttons over images need a scrim.
