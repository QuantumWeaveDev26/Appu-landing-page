# 09 — Implementation Guide

Step-by-step recipe to rebuild a page with the same design architecture as the Artlist Seedance 2.5 page. Designed to be handed to any frontend model or developer.

---

## 1. Recommended Stack

- **Framework:** Next.js (App Router) or Vite + React. Server Components for static sections; `"use client"` isolated leaves for anything interactive (slider, accordion, mobile menu).
- **Styling:** Tailwind CSS v4 with the tokens from `02-color-system.md` and `08-spacing-system.md` as CSS variables / `@theme` tokens.
- **Animation:** Motion (`motion/react`) — `whileInView` for reveals, hover physics. No GSAP needed.
- **Fonts:** `next/font` with a geometric grotesk (Space Grotesk / Sora / Plus Jakarta Sans) + optional JetBrains Mono for metadata.
- **Icons:** `@phosphor-icons/react` (light weight) or `hugeicons-react` — one family, consistent stroke. Arrow = `ArrowRight`.

---

## 2. Build Order (verify each step)

1. **Setup tokens** → verify: colors, fonts, spacing render in a test page
2. **Global shell** → navbar (≤80px, blur surface, hamburger + overlay menu) + breadcrumb
3. **Hero** → verify: fits first viewport, H1 ≤ 2 lines, CTA visible, entrance animation runs once
4. **What-Is** → editorial split: H2 + paragraph + CTA + 16:9 metaphor image
5. **Why slider** → 5 cards, scroll-snap, arrow controls, mobile swipe
6. **How-To steps** → 4 numbered rows (01–04), numerals as hero element
7. **Capabilities grid** → 8 cards, 4×2 → 2×4 → 1-col, staggered reveal
8. **Spotlight banner** → single color-block moment, product images
9. **FAQ accordion** → 8 items, aria-expanded, one open at a time, grid-rows transition
10. **Final CTA** → strongest value prop + primary CTA
11. **Footer** → mission block + 5 columns + social icons + legal line
12. **Motion audit** → reduced-motion path, transform/opacity only, no scroll listeners
13. **Perf & a11y audit** → LCP < 2.5s (hero image preloaded), INP < 200ms, CLS < 0.1, WCAG AA contrast, full keyboard nav
14. **Responsive audit** → 1280px / 1024px / 768px / 375px, no horizontal overflow, nav single-line at 1024px

---

## 3. Section Templates (skeleton)

### Hero
```html
<section class="relative min-h-[100dvh] flex items-center justify-center px-4 pt-24">
  <div class="max-w-3xl text-center">
    <h1 class="text-5xl md:text-6xl lg:text-7xl font-bold tracking-tighter leading-[1.05]">
      Seedance 2.5: 30 seconds of AI video
    </h1>
    <p class="mx-auto mt-6 max-w-[520px] text-base md:text-lg text-secondary leading-relaxed">
      One pass. Fifty references. Audio in sync.
    </p>
    <div class="mt-10">
      <a href="#" class="btn-primary">Explore Seedance 2.5 →</a>
    </div>
  </div>
  <div class="mt-16 max-w-4xl">
    <img src="hero-editorial.jpg" alt="..." class="rounded-2xl" />
  </div>
</section>
```

### Feature grid card
```html
<article class="group rounded-2xl border border-hairline bg-raised p-6 transition-colors duration-150 hover:border-hairline-strong">
  <img src="metaphor.jpg" alt="..." class="mb-6 aspect-[4/3] w-full rounded-xl object-cover transition-transform duration-500 group-hover:scale-[1.02]" />
  <div class="flex items-start justify-between">
    <h3 class="text-lg font-semibold">Multi-shot generation</h3>
    <ArrowRight class="h-4 w-4 text-accent transition-transform duration-150 group-hover:translate-x-0.5" />
  </div>
  <p class="mt-2 text-sm text-secondary leading-relaxed">Describe several shots in one prompt…</p>
</article>
```

### Accordion item
```html
<div class="border-t border-hairline">
  <button class="flex w-full items-center justify-between py-6 text-left" aria-expanded="false" aria-controls="faq-1">
    <h3 class="text-base md:text-lg font-semibold">What is Seedance 2.5?</h3>
    <ChevronDown class="h-5 w-5 text-muted transition-transform duration-150 [aria-expanded="true"]:rotate-180" />
  </button>
  <div id="faq-1" class="grid grid-rows-[0fr] transition-[grid-template-rows] duration-300 ease-fluid [aria-expanded="true"]:grid-rows-[1fr]">
    <div class="overflow-hidden">
      <p class="max-w-[65ch] pb-6 text-sm text-secondary">…</p>
    </div>
  </div>
</div>
```

---

## 4. Content Strategy (if you're adapting this for your own product)

1. **Hero:** `[Product] [version]: [one headline benefit]` + subtext naming the 2–3 biggest changes + 1 CTA.
2. **What-Is:** plain-language definition + one editorial metaphor image.
3. **Why:** 3–5 benefit cards, each a *story* ("Create a beginning, middle, and end"), each with its own metaphor image.
4. **How-To:** 4 numbered steps. Numerals are design objects.
5. **Capabilities:** 6–8 feature cards, one sentence each, metaphor image per card.
6. **Spotlight:** one promo moment — new capability + discount if real.
7. **FAQ:** 8 questions answering every objection (pricing, inclusion, limits, languages). End with support link.
8. **Final CTA:** restate the strongest value prop, one CTA.
9. **Footer:** mission statement + full site map + socials + legal.

---

## 5. Copy Rules (from the source page)

- Headlines = benefits: "Sound that lands finished", "Fewer takes before the keeper"
- Numbers are concrete and real (30s, 50 references, 30/10/10, 4–30s, 11 languages, 20% adherence)
- FAQ answers are 2–3 sentences, direct, no hedging
- CTA labels: verb-first, short — `Explore`, `Start Creating`, `Try It Here`, `Start Free Now`

---

## 6. Acceptance Checklist

- [ ] One accent color locked across the whole page
- [ ] No pure black/white; hairlines not shadows
- [ ] Every section has exactly one H2 and one job
- [ ] 4+ different layout families used; none repeated
- [ ] Hero fits first viewport; CTA visible without scroll
- [ ] Max 1 eyebrow per 3 sections
- [ ] All images are metaphor-art-directed, uniform grade, fixed frames
- [ ] Motion: transform/opacity only, reduced-motion honored, no scroll listeners
- [ ] Nav single-line at 1024px, ≤80px
- [ ] WCAG AA contrast on all text & CTAs
- [ ] Responsive: no overflow at 375px; sliders swipe; grids collapse to 1-col