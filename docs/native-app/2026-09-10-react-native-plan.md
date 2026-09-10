# APPU Native App — Architecture & Phased Plan (React Native, Android)

Date: 2026-09-10. Owner decisions locked via coordinator Q&A.

## Decisions
- **Stack:** React Native (Android first; iOS possible later on the same codebase).
- **Backend:** Reuse existing as-is — Node API (`api.appuai.online`), Supabase, n8n. No backend rebuild.
- **Independence:** A brand-new app codebase, fully separate from the website (`frontend/`) and the old Capacitor wrapper (`mobile/`). Its own auth, deep-linking, release cycle.
- The **website + current Capacitor app stay live and untouched** while this is built in parallel.

## Framework recommendation
- **Expo (managed) + Dev Client + EAS Build.** Fastest setup, OTA JS updates, config plugins cover every native module we need. Not "bare" RN unless a required module lacks Expo support (none here do).

## Key libraries
| Concern | Choice |
|---|---|
| Navigation | React Navigation (native-stack) |
| State | Zustand (light) |
| Auth (email/pw) | `supabase-js` v2 + AsyncStorage session |
| Auth (Google) | `@react-native-google-signin/google-signin` → ID token → `supabase.auth.signInWithIdToken` (NATIVE, no redirect — fixes the redirect-hijack bug by design) |
| Networking | fetch wrapper porting `appu-backend-client.js` (guest sessions, HMAC where used, error/limit handling) |
| Voice STT | `@react-native-voice/voice` (en/kn/hi locales) |
| Voice TTS | `expo-speech` or `react-native-tts` |
| Animation | `react-native-reanimated` (avatar float/halo), Lottie if an asset warrants |
| i18n | `i18next` + `react-i18next` (reuse existing en/kn/hi strings) |
| Secure storage | `expo-secure-store` for tokens; AsyncStorage for prefs |

## Screens
Splash/loader → Auth (Sign in / Create account + Continue with Google) → Home / Learning Stage (Appu avatar, mission cards, Explore Prompts, language switch) → Chat + Prompt Library → Voice session (hands-free) → Parent Zone (children, personalization, subscription — auth-gated) → Settings (voice/sound/language) → Legal (native or in-app webview).

## Backend integration
- Map endpoints from `appu-backend-client.js`: guest session, chat/agent, prompt library, children + personalization, study schedule, usage/subscription.
- Supabase: same project & anon key (`appu-config.js`). Google via native ID token → `signInWithIdToken` (needs a Google **Android OAuth client** tied to the app signing SHA-1, registered in Supabase — user config, Phase 1).
- Config surface: API base URL, Supabase URL/anon key, Google web+android client IDs.

## Phases (each ends in a device-verifiable checkpoint)
- **Phase 0 — Scaffold:** Expo app, navigation shell, design tokens (dark cyan brand ported), i18n wiring, Supabase client, backend-client skeleton; running Android dev build. ✅ = app launches on a device + hits a backend health/guest endpoint.
- **Phase 1 — Auth:** email/password + native Google Sign-In; session persistence; guest mode. ✅ = sign in/up + Google on device; session survives restart.
- **Phase 2 — Home / Learning Stage:** avatar (image + reanimated float/halo), mission cards, title, Explore Prompts entry, header language switch. ✅ = matches design; language switch works.
- **Phase 3 — Chat + Prompt Library:** text chat with the backend agent (typing/stream), prompt library panel. ✅ = real conversation with backend.
- **Phase 4 — Voice:** STT (mic) + TTS, hands-free session UI, locale handling. ✅ = speak → transcript → reply → TTS in en/kn/hi.
- **Phase 5 — Parent Zone:** children list, add child, full personalization parity, subscription/plan view. ✅ = create/edit persists to backend.
- **Phase 6 — Extras & polish:** settings, study-reminder touchpoints, WhatsApp share/consent, legal, onboarding, empty/error states, i18n polish.
- **Phase 7 — Release:** EAS Build (signed APK/AAB), Play Store internal track. ✅ = installable signed build.

## Repo location
- New top-level dir **`native/`** in this repo (separate from `frontend/` and `mobile/`), splittable into its own repo later. Keeps coordinated dev now while staying architecturally independent.

## User-config items (later phases, I'll walk you through each)
- Google Cloud: Android OAuth client ID (app signing SHA-1) + register in Supabase for `signInWithIdToken` (Phase 1).
- Expo/EAS account for cloud builds (Phase 0/7).

## Current-app bug note
- The website/Capacitor Google-login redirect bug is **solved natively** here. For the *existing* Capacitor app we can still apply the App-Links-narrowing patch if you want it fixed in the meantime — separate small task, or skip since native supersedes it.
