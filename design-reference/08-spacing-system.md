# 08 — Spacing System

Extracted from the Artlist Seedance 2.5 page. The page breathes: generous section gaps, tight intra-card padding, hairline separators instead of boxes.

---

## 1. Scale

Base unit: **8px** (CSS spacing scale).

| Token | Value | Used for |
|---|---|---|
| `--space-1` | 4px | Icon gaps, tiny offsets |
| `--space-2` | 8px | Icon-to-text gaps |
| `--space-3` | 12px | Badge/pill padding-y |
| `--space-4` | 16px | Body padding-x on mobile, small gaps |
| `--space-5` | 20px | Button padding-x, form gaps |
| `--space-6` | 24px | Card padding, grid gaps |
| `--space-8` | 32px | Card padding-lg, H3→body gap |
| `--space-10` | 40px | H2→body gap, section inner spacing |
| `--space-12` | 48px | Section header → content gap |
| `--space-16` | 64px | Section padding-y (compact) |
| `--space-20` | 80px | Section padding-y (default) |
| `--space-24` | 96px | Section padding-y (major breaks) |
| `--space-32` | 128px | Hero padding, final CTA padding |

---

## 2. Section Rhythm Rules

1. **Default section spacing:** `padding-block: 80px` (`py-20`); major breaks (hero→first section, last section→footer) `96–128px`.
2. **Never** two sections touch with less than 64px between content blocks.
3. Section header (H2) → first content: 48px. H2 → body text: 40px. H3 → card body: 8px→12px.
4. **Hero top padding cap:** `pt-24` max. Never push hero content past the middle of the first viewport.
5. Grid gaps: feature grid `24px`; footer columns `24–32px`; steps list `40px` vertical.

---

## 3. Density Rules

- `VISUAL_DENSITY: 4` — airy, editorial. One idea per section, cards are not crammed.
- Body copy never exceeds 65ch. Card body ≤ 2 sentences.
- **Cards use hairline borders + whitespace, not shadows**, so spacing does the separation work.
- When a section needs separation from a neighbor: alternate `--bg-page` / `--bg-raised`, don't add borders around whole sections.
- No 20-row lists, no packed spec tables — anything > 5 items becomes a slider, grid, or accordion.

---

## 4. Breakpoint Adjustments

| Breakpoint | Change |
|---|---|
| `≥1024px` | Full spacing scale; `py-20/24` sections |
| `768–1023px` | `py-16/20`; grid gaps 20px |
| `<768px` | `py-12/16`; gutters `px-4`; card padding 20px; steps/numerals scale down via `clamp()` |