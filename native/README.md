# APPU — Native App (React Native / Expo, Android)

A ground-up native rebuild of the APPU client, **separate from the website** (`../frontend`) and the old Capacitor wrapper (`../mobile`). Reuses the existing backend (Node API + Supabase + n8n) as-is.

Full plan & phases: [`../docs/native-app/2026-09-10-react-native-plan.md`](../docs/native-app/2026-09-10-react-native-plan.md)

## Stack
- Expo SDK 57 · React Native 0.86 · React 19 · TypeScript
- Android first (iOS later possible). Dev package id: `online.appuai.appu.native` (distinct so it installs alongside the current Capacitor app during development).

## Status
- **Phases 0 through 6 — Completed.** Full feature coverage: Auth (Email/Password + Google ready), Home avatar & missions, Chat with normalized API fallbacks, Voice session (hands-free auto-listen + server Eleven v3 streaming + device TTS fallback), Parent Zone (multi-learner profiles, personalization DNA, subscription meters), Settings (voice rate/pitch controls + live preview, auto-speak), Study Reminders (0-OAuth Google Calendar + WhatsApp study notes), WhatsApp sharing CTAs, Legal/compliance cards, and First-run onboarding tour.
- **Preview APK Build:** Successfully compiled and built with EAS (`c982d536`).

## Run
```bash
cd native
npm install
npx expo start        # then press "a" for Android, or scan with a dev/preview build
```

## Adding native modules
Follow the exact Expo v57 docs (see `AGENTS.md`) and install with `npx expo install <pkg>` so versions stay compatible with the SDK. Installed: `@react-navigation/native` (+ native-stack), `zustand`, `@supabase/supabase-js`, `@react-native-async-storage/async-storage`, `i18next` + `react-i18next`, `@react-native-google-signin/google-signin`, `expo-speech-recognition`, `expo-speech`, `expo-audio`, `react-native-reanimated`, `react-native-worklets`.
