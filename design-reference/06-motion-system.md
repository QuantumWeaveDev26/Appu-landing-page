# 06 — Motion System

Extracted from the Artlist Seedance 2.5 page. This design is **restrained**: motion exists to confirm hierarchy and reduce friction, not to entertain. `MOTION_INTENSITY: 5/10`.

---

## 1. Motion Philosophy

- Every animation answers: **"what does this communicate?"** Hierarchy, feedback, or state change. If it can't, it's cut.
- No autoplaying loops, no scroll-jacking, no parallax-for-parallax.
- Honor `prefers-reduced-motion`: collapse to instant/static.

---

## 2. Easing & Timing Tokens

```css
--ease-out-expo: cubic-bezier(0.16, 1, 0.3, 1);   /* default entrances */
--ease-fluid:    cubic-bezier(0.32, 0.72, 0, 1);  /* panels, accordions */
--dur-fast: 150ms;   /* hovers, color changes */
--dur-base: 300ms;   /* dropdowns, accordions */
--dur-slow: 600ms;   /* hero entrance, section reveals */
--dur-slower: 800ms; /* large image reveals */
```

**Never** use `linear` or default `ease-in-out` for anything user-facing.

---

## 3. Motion Inventory

### Hero entrance (once, on load)
- Sequence: headline `opacity 0 → 1` + `translateY(24px → 0)` (600ms, `--ease-out-expo`), then subtext (delay 100ms), then CTA (delay 200ms), then image (delay 300ms).
- Text blur-in is optional (`blur(8px) → 0`); keep it subtle.

### Scroll reveals (whileInView, once)
- Elements enter as they cross the viewport: `opacity 0→1`, `translateY(32px→0)`, `--ease-out-expo`, 600ms.
- Staggered lists (feature grid): children delay `index * 60ms`.
- Use Motion `whileInView` / IntersectionObserver — **never** `window.addEventListener('scroll')`.

### CTA hover physics
- Icon `translateX(2px)` + button fill lightens, `--dur-fast`.
- `:active` → `scale(0.98)` press.

### Card hover
- Border `--border-hairline → --border-hairline-strong`, `--dur-fast`.
- Image `scale(1.02)` with `transform: scale()`, 500ms `--ease-out-expo`. Transform + opacity only.

### Slider (Why section)
- Scroll-snap horizontal pan, arrows scroll by card width, smooth `scroll-behavior: smooth` (or JS `scrollTo({behavior:'smooth'})`).
- Disabled arrows fade to `--text-muted`.

### Accordion
- Open/close: `grid-template-rows 0fr→1fr` or height animation, 300ms, `--ease-fluid`.
- Chevron `rotate(180deg)`, 150ms.

### Navbar
- Sticky surface blur fades in after scroll > 10px (`background rgba(10,12,18,0.8) + backdrop-blur(16px)`), 200ms.
- Mobile menu: full-screen overlay `backdrop-blur(24px)`, links `translateY(48px→0) opacity 0→1`, stagger 100ms each.

---

## 4. Hard Rules

1. Animate **only `transform` and `opacity`**. Never `top/left/width/height` (except the grid-rows accordion trick).
2. `backdrop-blur` only on fixed/sticky elements (navbar, mobile menu). Never on scrolling content.
3. `prefers-reduced-motion: reduce` → all entrance/reveal/parallax disabled; hover physics reduced to color-only; accordion/slider work instantly.
4. No `requestAnimationFrame` loops touching React state; no scroll-position state in `useState`. Use motion values.
5. `will-change: transform` only on elements actively animating.
6. Grain/noise overlays (if used) live on a `fixed, pointer-events-none` layer only.

---

## 5. Tech Notes

- Recommended: **Motion** (`import { motion } from "motion/react"`), `useScroll`/`useTransform` for scroll-linked values, `whileInView` for reveals.
- GSAP/ScrollTrigger only if a pinned/horizontal section is required (this page doesn't use one — don't add it).
- `useReducedMotion()` from Motion for the reduced-motion path.
