# 03 — Typography System

Extracted from the Artlist Seedance 2.5 page. The type system is editorial: large display headlines, small muted metadata, and numbers that act as design objects.

---

## 1. Font Stack (observed character: modern grotesque with tight display settings)

Artlist's site reads as a **geometric/neo-grotesque sans** with tight tracking on display sizes. Recommended stack for replication:

| Role | Font | Fallback |
|---|---|---|
| Display / H1 / H2 | `Space Grotesk` or `Sora` or `Plus Jakarta Sans` | `system-ui, sans-serif` |
| Body | same family at regular weight | `system-ui, sans-serif` |
| Numerals (steps 01–04) | same display family, heavy weight | — |
| Mono metadata (optional, breadcrumbs/eyebrows) | `JetBrains Mono` or `IBM Plex Mono` | `monospace` |

Load via `next/font` or `@font-face` with `font-display: swap`. Never hotlink Google Fonts in production.

---

## 2. Type Scale (desktop)

| Token | Size / Line-height / Weight | Tracking | Used for |
|---|---|---|---|
| `--text-hero` | `clamp(2.5rem, 5vw, 4rem)` / 1.05 / 700 | `-0.03em` | H1 hero |
| `--text-h2` | `clamp(1.75rem, 3vw, 2.5rem)` / 1.1 / 700 | `-0.02em` | Section headlines |
| `--text-h3` | `1.125rem` / 1.3 / 600 | `0` | Card titles |
| `--text-body` | `1rem` / 1.6 / 400 | `0` | Paragraphs |
| `--text-small` | `0.875rem` / 1.5 / 400 | `0` | Secondary copy |
| `--text-caption` | `0.75rem` / 1.4 / 400 | `0` | Breadcrumb, captions |
| `--text-step` | `clamp(3rem, 6vw, 5rem)` / 1 / 700 | `-0.02em` | Step numerals 01–04 |
| `--text-cta` | `0.9375rem` / 1 / 600 | `0` | Buttons |
| `--text-overline` | `0.6875rem` / 1 / 500 | `0.12em` | Eyebrows (use sparingly — max 1 per 3 sections) |

---

## 3. Hierarchy Rules

1. **Headline-to-body contrast is the design.** H2s are 2–3× body size. Body is small enough that headlines dominate the viewport.
2. **Headline line limits:** H1 ≤ 2 lines desktop, H2 ≤ 2 lines, H3 ≤ 2 lines. If copy wraps further, cut copy — never shrink to fit.
3. **Body width cap:** `max-width: 65ch` (approx. `max-w-[520px]`) for paragraphs.
4. **Step numerals are the loudest text element** in the How-To section — bigger than the section H2. This is intentional; the numbers carry the narrative.
5. **Muted does the quiet work:** breadcrumbs, captions, footer links use `--text-muted` and smaller sizes. Hierarchy is 90% size/color, 10% weight.
6. **Emphasis rule:** to emphasize a word in a headline, use italic or bold of the SAME family. Never inject a serif into a sans headline.
7. **Serif discipline:** this design uses no serif display. Do not add one.
8. **No all-caps walls.** Only tiny overlines/captions may be uppercase with wide tracking. Max 1 eyebrow per 3 sections.

---

## 4. Copy Style (voice)

- Headlines = benefits, not features: "Sound that lands finished", "Create a beginning, middle, and end"
- Subtext ≤ 3 lines, ≤ 25 words
- Body copy = 1–2 sentences per card, concrete, no filler
- No fake-precise numbers (e.g. "92% better") unless real
- One register: confident, practical, creator-empowering. No hype words ("unleash", "revolutionize", "seamless")
- CTAs are short & verb-first: `Explore Seedance 2.5`, `Start Creating`, `Try It Here`, `Start Free Now`
