# 04 — Layout System

Extracted from the Artlist Seedance 2.5 page: grid, section rhythm, and per-section layout families.

---

## 1. Grid

- **12-column CSS Grid** on desktop (`lg+`), page container `max-width: 1200–1280px`, centered with `mx-auto`, side gutters `px-4` → `px-6` → `px-8` by breakpoint.
- **Never** flexbox percentage math. Use `grid-template-columns` with `fr` units.
- Mobile collapse: every multi-column layout declares a `<768px` single-column fallback in the same component.

---

## 2. Section Rhythm (vertical)

- Section spacing: `py-20` → `py-32` (80–128px). The page breathes; sections never touch.
- Section header pattern: **stacked** — H2 on top, optional body below (max 65ch). No split-header (left headline / right paragraph) unless the right column holds a real visual.
- Alternating backgrounds: base `--bg-page` ↔ raised `--bg-raised` only where it adds structure (max ~2 alternations on the page). One "color-block" spotlight banner max.

---

## 3. Layout Families Used (and where)

| # | Layout family | Where | Anatomy |
|---|---|---|---|
| 1 | Full-width editorial | Hero, What-Is, Final CTA | Centered or left-aligned H1 + body + CTA; single large image below/behind |
| 2 | Horizontal card slider | Why section (5 cards) | Snap-scroll row: card = image + H3 + body + `→`; arrow buttons flank it |
| 3 | Numbered vertical steps | How-To (4 steps) | Large `01`–`04` numerals + H3 + body; list or 2×2 grid |
| 4 | Feature card grid | Capabilities (8 cards) | 4×2 grid on desktop, 2×4 tablet, 1-col mobile; uniform cards |
| 5 | Banner panel | Spotlight | Tinted full-width panel: short headline + CTA + product images |
| 6 | Accordion | FAQ (8 items) | Single column, max-width ~720px, hairline dividers |
| 7 | Link maze | Footer | Mission block + 5 columns + social row |

**Rule:** each family appears at most once. Never two card grids with the same anatomy on one page.

---

## 4. Layout Rules

1. **Hero must fit the first viewport.** Headline ≤ 2 lines, subtext ≤ 3 lines, CTA visible without scroll. Top padding ≤ `pt-24`. Use `min-h-[100dvh]` for full-height sections, never `h-screen`.
2. **Hero stack = max 4 text elements:** eyebrow (optional) + H1 + subtext + CTAs (1 primary + max 1 secondary). No taglines, no trust-strips, no avatar rows inside the hero.
3. **Cards use hairline borders, not shadows.** Card = `1px var(--border-hairline)` + `--bg-raised` + radius.
4. **Bento/card grids must have rhythm:** vary one or two cells (image-led, tinted) — no 8 identical text-only tiles.
5. **Zigzag ban:** no more than 2 consecutive text/image split sections.
6. **Nav ≤ 80px, single line on desktop.** If items don't fit at 1024px, condense or hamburger.
7. **Section header rhythm:** one section = one H2 = one job. No data-dump sections (no 20-row tables).

---

## 5. Responsive Behavior

| Breakpoint | Behavior |
|---|---|
| `≥1024px` | Full 12-col grid, horizontal slider, 4-col feature grid, 5-col footer |
| `768–1023px` | 2-col feature grid, 2-col steps, footer collapses to 2–3 columns |
| `<768px` | Everything single-column (`w-full`, `px-4`); slider becomes touch swipe; nav → hamburger; hero type scales down |
