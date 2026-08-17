---
name: conversational-voice-hud
description: Conversational user interface design for voice-first digital agents. Covers real-time subtitle typography, dynamic audio spectrum visualizers, n8n streaming orchestration, and frictionless lead scheduling.
---

# Conversational Voice & AI HUD Design

This skill provides patterns for building voice-driven web agents that feel intuitive and engaging.

## 1. Hero Microphone (Voice Portal)
- High-contrast radiant center button with glowing neon aura and concentric pulsing radar rings during listening state.
- Continuous audio amplitude reactive visualizer ring.

## 2. Dynamic Subtitle Typography
- Live streaming typewriter effect with variable character delays (`15ms - 40ms`).
- High-contrast frosted glass container with gradient border and live speaker identity badge.
- Integrated audio equalizer bars directly synced to speech utterance events.

## 3. Seamless n8n Webhook & WebSocket Streaming
- Immediate visual state switch to `thinking` (purple pulse) when input is submitted.
- Live WebSocket listener (`wss://.../chat`) to stream the AI response chunks directly.
- Smart fallback handling with graceful degradation and auto-recovery.
