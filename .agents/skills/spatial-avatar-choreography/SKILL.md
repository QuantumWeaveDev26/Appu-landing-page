---
name: spatial-avatar-choreography
description: Directing 3D digital human avatars, holographic podium environments, interactive parallax physics, audio-reactive state transitions, and stage lighting.
---

# Spatial Avatar Choreography

This skill covers the principles and implementations needed to make 2.5D and 3D digital humans feel alive, majestic, and responsive on the web.

## 1. Physical Stage Anatomy
- **Holographic Ring Podium**: Triple concentric rings with differential rotation speeds (outer: 40s, mid: 25s, inner: 15s) in 3D perspective (`rotateX(75deg)`).
- **Stage Floor Grid**: Subtle perspective grid radiating outward into infinity with depth fade.
- **Volumetric Beam**: Translucent cone of light projecting from the ground upwards.

## 2. Micro-Movements & Idle Animation
- **Breathing Oscillation**: Vertical translation of `4-8px` combined with `0.8%` scale over a `4.5s` sinusoidal curve.
- **Mouse & Gyroscope Parallax**: 3D rotation (`rotateY`, `rotateX`, `translateZ`) with critically damped spring interpolation (`lerp factor 0.08`).

## 3. Audio-Reactive State Transitions
- **Idle State**: Calming cyan/blue particulate glow.
- **Listening State**: Voice ring expansion with glowing emerald pulses matching microphone amplitude.
- **Thinking State**: Swirling purple vortex of neural particles around avatar's head and chest.
- **Speaking State**: Electric amber waveform equalizer beam synchronized with synthetic speech frequencies.
- **Celebration/Success State**: Golden particle explosion upon conversion/booking.

## 4. Holographic Spatial Widgets
Floating 3D glass cards surrounding the digital human that tilt and float with offset sine waves, displaying real-time metrics:
- ⚡ 0-Click Booking confirmation badge
- 🎙️ Live Voice synthesis status
- 🎓 AI Career curriculum milestone
