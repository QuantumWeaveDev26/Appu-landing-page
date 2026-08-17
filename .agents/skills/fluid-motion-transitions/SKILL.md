---
name: fluid-motion-transitions
description: Motion choreography based on Apple and Linear design systems. Covers spring physics, velocity handoff, interruptible gesture dynamics, cubic-bezier curves, and tactile microinteractions.
---

# Fluid Motion & Transitions

This skill covers the implementation of buttery smooth, 60fps web transitions that feel direct and natural.

## 1. Core Motion Primitives
- **Press Feedback**: Instant scale reduction (`scale(0.96)`) on pointerdown, not waiting for click release.
- **Drawer Slide**: Transform-only hardware accelerated slide with cubic-bezier easing (`cubic-bezier(0.16, 1, 0.3, 1)`).
- **Fade + Rise**: Opacity `0 -> 1` and `translateY(16px -> 0)` for incoming cards and dialogs.
- **Glass Sheet Materialization**: Animate blur radius (`0 -> 30px`), border opacity, and scale together on entry.

## 2. Spring Physics Parameters
- **Damping Ratio**: `1.0` for critically damped UI (smooth settle, zero bounce).
- **Response**: `0.3s - 0.4s` for snappy feel.
- **Momentum Damping**: `0.8` for interactive card throws or drag releases.

## 3. Tactile Audio Feedback
Synthesize harmonic tones using Web Audio API on the exact same frame as visual transitions:
- Tap: Soft sine click (`520Hz`, `0.08s`)
- Listening Start: Rising arpeggio (`520Hz -> 880Hz`)
- Success: Major chord fanfare (`523Hz -> 659Hz -> 783Hz -> 1046Hz`)
