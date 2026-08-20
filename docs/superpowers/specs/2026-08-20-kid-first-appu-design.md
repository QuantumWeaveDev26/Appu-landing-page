# Kid-First Appu Single-Screen Design

## Goal

Turn the current corporate keynote-style Appu page into a single-screen learning mission interface for CBSE students in Classes 5–12 while preserving Appu, English/Kannada controls, voice, chat, and a parent booking path.

## Audience and tone

- Students in Classes 5–12 are the primary audience.
- Parents and guardians are the secondary audience and own the booking/contact flow.
- The visual tone is premium adventure-tech: energetic and warm for younger students without feeling juvenile to Classes 11–12.
- Appu is presented as an AI learning companion, not the real Dr. Puneeth Rajkumar.

## Single-screen composition

- A compact header contains the IGR Academy brand, language switcher, sound control, and a subdued Parent Zone action.
- The center contains one visible H1, a short promise, the Appu avatar, and four learning missions: Explain My Topic, Play a Quick Quiz, Help With Homework, and Exam Practice.
- The primary action is the voice portal labelled Ask Appu. Type Instead is secondary. Booking never competes with learning.
- A compact response card shows Appu's state and latest answer. Chat remains a slide-in overlay rather than another landing-page section.
- The background is a lightweight, code-driven learning-lab atmosphere using the existing stage image, gradients, subject glyphs, and restrained motion. No new section or forced intro video is added.

## Voice architecture

- The existing n8n chat-trigger webhook remains the only AI/voice generation endpoint.
- The browser posts the learner prompt and receives text plus `audio_base64`, `audioBase64`, or an audio URL.
- Browser code may perform speech recognition and audio playback, but must not contain an ElevenLabs credential or call ElevenLabs directly.
- If n8n returns text without audio, the UI displays the answer and returns to idle with a friendly silent-response notice; it does not synthesize speech locally.

## Child safety and privacy

- Booking is labelled Parent Zone / Parent Call and the form states that a parent or guardian should complete it.
- Student-facing copy does not ask children to submit phone numbers or email addresses.
- Backend/vendor terminology such as n8n, webhook, and cloned voice is removed from visible child-facing UI.

## Accessibility

- The page has a logical H1 and landmarks.
- Zoom is not disabled.
- Interactive targets are at least 44px for the student-facing mobile experience.
- All buttons have accessible names and visible focus styles.
- Chat and modal overlays use dialog semantics, move focus inside on open, trap focus, close with Escape, and restore focus.
- Motion is disabled or reduced under `prefers-reduced-motion`.

## Source-of-truth and scope

- Root `index.html`, `style.css`, `app.js`, `chat-agent.js`, `voice-engine.js`, and supporting assets are the source of truth.
- `deploy/` is treated as an old snapshot and will be synchronized only after the root implementation passes verification.
- Existing ZIP archives are not edited.

## Acceptance criteria

- The landing page remains one section at desktop and mobile breakpoints.
- The four learning missions are fully readable without ellipsis.
- Ask Appu is the dominant CTA; Parent Zone is visually secondary.
- A synthetic webhook request returns text and backend audio that the client can normalize and play.
- No client-side TTS API key or direct ElevenLabs request remains.
- Clear chat and drawer microphone controls work.
- Automated tests pass and browser verification finds no console errors at 1440x900, 768x1024, 390x844, and 390x667.

