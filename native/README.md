# APPU — Native App (React Native / Expo, Android)

A ground-up native rebuild of the APPU client, **separate from the website** (`../frontend`) and the old Capacitor wrapper (`../mobile`). Reuses the existing backend (Node API + Supabase + n8n) as-is.

Full plan & phases: [`../docs/native-app/2026-09-10-react-native-plan.md`](../docs/native-app/2026-09-10-react-native-plan.md)

## Stack
- Expo SDK 57 · React Native 0.86 · React 19 · TypeScript
- Android first (iOS later possible). Dev package id: `online.appuai.appu.native` (distinct so it installs alongside the current Capacitor app during development).

## Status
- **Phase 0 (scaffold) — in progress.** Done: Expo base, brand theme (`src/theme.ts`), branded shell (`App.tsx`), app config. Remaining: install deps, navigation shell, i18n wiring, Supabase + backend client skeletons, first Android dev build.

## Run (once deps are installed)
```bash
cd native
npm install
npx expo start        # then press "a" for Android, or scan with Expo Go / a dev build
```
> A first **on-device build** needs an Expo/EAS account (see plan). The coordinator will provide step-by-step setup when we reach that point.

## Adding native modules
Follow the exact Expo v57 docs (see `AGENTS.md`) and install with `npx expo install <pkg>` so versions stay compatible with the SDK. Planned: `@react-navigation/native` (+ native-stack), `zustand`, `@supabase/supabase-js`, `@react-native-async-storage/async-storage`, `i18next` + `react-i18next`, `@react-native-google-signin/google-signin`, `@react-native-voice/voice`, `expo-speech`, `react-native-reanimated`.
