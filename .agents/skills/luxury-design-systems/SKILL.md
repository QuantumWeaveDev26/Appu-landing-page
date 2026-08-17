---
name: luxury-design-systems
description: Principles and design tokens for building high-end, luxury dark-mode web experiences. Covers OKLCH color palettes, typography scales, frosted glassmorphism layers, volumetric lighting, and spatial hierarchy.
---

# Luxury Design Systems (Linear × Stripe × Apple Keynote)

This skill provides the architectural foundation for building luxury, state-of-the-art web interfaces that look premium, cinematic, and authoritative.

## 1. Deep Space & Obsidian Color Ramps (OKLCH / HSL)
Avoid flat grey or generic `#111827`. Use rich, nuanced undertones:
- **Lacquer Void Ground**: `oklch(8% 0.015 260)` / `#050811` (Deep cosmic obsidian)
- **Elevated Carbon Surface**: `oklch(14% 0.025 255)` / `#0c1322`
- **Frosted Glass Sheet**: `rgba(15, 23, 42, 0.65)` with `backdrop-filter: blur(28px) saturate(190%)`
- **Electric Cyan Primary Glow**: `oklch(84% 0.18 200)` / `#00f2fe`
- **Kinpaku Radiant Gold Accent**: `oklch(85% 0.19 82)` / `#ffd200`
- **Emerald Pulse**: `oklch(76% 0.17 160)` / `#10b981`

## 2. Dynamic Volumetric Lighting
- **Top Conical Spotlight**: Linear gradient with soft Gaussian blur simulating high-end studio illumination.
- **Radial Aura**: Multi-stop radial gradients layered behind focal elements (`drop-shadow` + `box-shadow` depth).
- **Hairline Glass Borders**: `1px solid rgba(255, 255, 255, 0.1)` with a brightened top-edge reflection (`rgba(255, 255, 255, 0.25)`).

## 3. Typographic Hierarchy & Tracking
- **Display Headings (`Outfit` / `Plus Jakarta Sans`)**: Tight negative letter-spacing (`-0.03em`), line-height `1.1`, bold/black weights (`700-900`).
- **Body & Captions**: Natural tracking (`0`), line-height `1.55`, muted silver tones (`#94a3b8` / `#cbd5e1`).
- **Monospace Metadata (`JetBrains Mono`)**: Uppercase, tracked out (`0.12em`), small size (`0.7rem`), glowing status indicators.

## 4. Multi-Layer Depth Stacking
1. Layer 0: Canvas Particle / Grid Nebula (`z-index: 1`)
2. Layer 1: Holographic Stage / Ground Rings (`z-index: 5`)
3. Layer 2: Hero Avatar Figure (`z-index: 15`)
4. Layer 3: Floating 3D Spatial Cards & Chips (`z-index: 25`)
5. Layer 4: Glassmorphic Voice & Navigation HUD (`z-index: 40`)
6. Layer 5: Slide-out Glass Drawer / Booking Modals (`z-index: 100`)
