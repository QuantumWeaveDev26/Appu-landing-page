# 02 — Color System

Extracted from the Artlist Seedance 2.5 page. Note: exact hex values below are Artlist's observed brand palette; where a value is approximate it is marked `~`. The architecture (roles, contrast logic, usage rules) is what matters for replication.

---

## 1. Palette Architecture

The page runs on **one dark neutral base + one warm accent**, with strict role separation. No more than two "voices" per page.

### Base — Obsidian Family (page background & surfaces)

| Token | Value (approx.) | Role |
|---|---|---|
| `--bg-page` | `#0a0c12` (~) | Page background — near-black with blue undertone, never pure `#000` |
| `--bg-raised` | `#10141d` (~) | Card / panel surface |
| `--bg-sunken` | `#07080d` (~) | Section alternation, spotlight banner |
| `--border-hairline` | `rgba(255,255,255,0.08)` | All 1px dividers & card borders |
| `--border-hairline-strong` | `rgba(255,255,255,0.16)` | Hover borders, active states |

### Accent — Artlist Red / Coral (single accent, <1% of pixels)

| Token | Value (approx.) | Role |
|---|---|---|
| `--accent` | `#ff4d3d` ~ `#ff3d2e` (~) | Primary CTA fill, links, active states, arrows |
| `--accent-hover` | lighten 8% | CTA hover |
| `--accent-soft` | `rgba(255,77,61,0.12)` | CTA ghost / badge backgrounds |
| `--accent-text-on` | `#ffffff` | Text on accent fills |

### Text Hierarchy (on dark base)

| Token | Value (approx.) | Role |
|---|---|---|
| `--text-primary` | `#f5f6f8` (~) | Headlines, CTAs |
| `--text-secondary` | `#a7adbb` (~) | Body copy |
| `--text-muted` | `#6b7280` (~) | Breadcrumbs, captions, footer, step numerals |
| `--text-inverse` | `#0a0c12` | Text on light/white panels (rarely used) |

---

## 2. Usage Rules

1. **One accent, locked.** Red appears on: primary CTAs, links, hover arrows, the "→" affordances. Never anywhere else. No green success, no blue links.
2. **No pure black, no pure white.** Base is `#0a0c12`-ish, text is `#f5f6f8`-ish. Pure values kill depth.
3. **Hairlines over shadows.** Cards are separated by `1px rgba(255,255,255,0.08)` borders, not drop shadows. Depth comes from surface stacking, not blur.
4. **Contrast ratios:** body ≥ 4.5:1, headlines ≥ 7:1, muted text ≥ 4.5:1 against its surface.
5. **Accent contrast:** white text on accent fill ≥ 3:1 (large text). Verified before shipping.
6. **The one color-block moment:** the Spotlight Banner (section 08) may use a tinted panel (`--bg-sunken` + accent-soft radial glow at top). One such moment per page, max.
7. **Never** gradient text on headlines; **never** neon glows; **never** purple/blue AI gradients.

---

## 3. Light Mode Variant (if required)

This page is dark-first. If a light twin is needed:

| Token | Value |
|---|---|
| `--bg-page` | `#fafafa` |
| `--bg-raised` | `#ffffff` |
| `--text-primary` | `#0d0f14` |
| `--text-secondary` | `#525a68` |
| `--border-hairline` | `rgba(0,0,0,0.08)` |
| `--accent` | unchanged `#ff3d2e` |

Keep hierarchy parity: what pops in dark must pop in light.

---

## 4. CSS Variables (ready to paste)

```css
:root {
  --bg-page: #0a0c12;
  --bg-raised: #10141d;
  --bg-sunken: #07080d;
  --border-hairline: rgba(255, 255, 255, 0.08);
  --border-hairline-strong: rgba(255, 255, 255, 0.16);

  --accent: #ff3d2e;
  --accent-hover: #ff6b5e;
  --accent-soft: rgba(255, 77, 61, 0.12);
  --accent-text-on: #ffffff;

  --text-primary: #f5f6f8;
  --text-secondary: #a7adbb;
  --text-muted: #6b7280;
  --text-inverse: #0a0c12;
}
```
