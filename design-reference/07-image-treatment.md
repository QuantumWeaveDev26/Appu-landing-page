# 07 — Image Treatment

Extracted from the Artlist Seedance 2.5 page. The image system is the page's secret weapon: **one consistent cinematic metaphor world**, art-directed per feature.

---

## 1. The Core Concept: Cinematic Metaphor System

Every image on the page is a *metaphor rendered as a film-industry object* that explains the feature at a glance. Examples from the page:

| Feature | Metaphor image |
|---|---|
| 30s single-pass generation + synced audio | Photos & audio reels converging into one unbroken 35mm filmstrip with a soundtrack |
| 30-second narrative holds | Single unbroken take shifting from dawn to dusk light |
| 50 multi-references | Photos, video stills, tagged tape reels pinned on a corkboard |
| Synced sound | Footstep striking gravel in sync with the same footstep on screen |
| Better prompt adherence | Clapperboard beside a single unused film reel on a sunlit set |
| Adaptive aspect ratio | Director's viewfinder adjusting its frame from wide to square |
| Multi-shot generation | Miniature interconnected film sets on a turntable, one dolly track |
| Scoped editing | Single filmstrip frame swapped on a light table, neighbors untouched |
| Extension both directions | Accordion-folded print strips unfurling both directions |
| Seamless bridge | Two film strips joined by leader with continuous motion-blur streaks |
| First/last frame | Two framed photos linked by a taut strand of film |
| Smart Duration | Editor's scissors resting at a natural scene-change point on a measured filmstrip |
| Audio-only references | Single reel of magnetic tape alone on a mixing console |
| 11 languages | Ring of microphones with tally lights around one central mic |

**Rule:** if a feature is hard to photograph literally, find the film-craft object that stands for it. Never fall back to generic stock.

---

## 2. Image Style & Grade

- **Tone:** cinematic, warm-diffused natural light or controlled studio light; shallow depth of field; tactile film objects.
- **Grade:** warm highlights, deep shadows, slight film grain, muted saturation — matches the dark UI base.
- **No** neon, no lens flares spam, no "AI render" look. Objects feel real and physical.

## 3. Ratios & Sizes

| Placement | Ratio | Notes |
|---|---|---|
| Hero / What-Is editorial image | 16:9 or 3:2 | Large, full container width or slightly inset |
| Why-slider cards | 4:3 or 3:2 | Uniform per card |
| Capability grid cards | 4:3 | Uniform across all 8 cards |
| Spotlight product images | 1:1 or 3:4 | Branded model cards (like "SD 2.5 1080p") |

- **Fixed media frames:** every image sits in a clearly bounded container with consistent radius (top corners of cards rounded with the card, or all corners 16–20px). No random floating images.
- **Alt text is descriptive** and explains the metaphor: e.g. `"A single unbroken take shifting from dawn to dusk light, representing Seedance 2.5's 30-second single-pass video generation"`. This is a documented SEO pattern on the page.

## 4. Implementation Checklist

- Every section has at least one real image — no div-based fake screenshots.
- Hero has a real visual: editorial image or video preview, not a gradient blob.
- Image priorities: LCP image preloaded; others lazy-loaded with explicit width/height to avoid CLS.
- If generating assets: one image per metaphor, same grade/tone across all — they must look like one photoshoot.
- Compression via `auto=format,compress`-style CDN params; AVIF/WebP.
