# Acceptance checks

Use the corresponding F-number in REPORT.md for reproduction details and evidence. These checks are acceptance targets for the repair; they are not claims that the current deployment passes.

| Finding | Required verification |
|---|---|
| F01 | Menu → My Learning → Study Lesson displays an interactive lesson without a lingering blur/backdrop. Repeat through reports and parent setup, including close/Escape/back transitions. Visual, ARIA and focus state agree. |
| F02 | Every precise curriculum source is verified against class, subject, chapter and edition. A learner-adapted explanation does not relabel its source grade. Supporting references are usable; unverified sources are omitted or explicitly qualified. |
| F03 | Sent question precedes its answer before and after refresh/resume. Verify same-second messages, image questions, repeated turns and stable server ordering. Preserve existing history. |
| F04 | Pricing, signup, onboarding and usage counters agree with the authoritative registered beta entitlement. Guest allowance remains separately defined. Verify with a non-admin test account. |
| F05 | Visible XP/level, accessible names, progress values and next-level calculation agree at level boundaries and after refresh. Rewards are awarded once per eligible event. |
| F06 | Tab and Shift+Tab stay in the active modal; background is inert. Initial focus, Escape, close and focus restoration work, including nested/stacked UI. |
| F07 | Contact → Schedule Call reaches a real booking flow, or clearly requests authentication and resumes the booking intent afterward. A verified fallback contact path works for signed-out users. Do not invent contact details. |
| F08 | Phone requirement and messaging consent match the intended policy and existing product decision. Optional consent is not preselected or required for unrelated learning access. Test withdrawal in a suitable test environment. |
| F09 | Simulated timeout/retry/failure produces clear status and a working cancel/retry path. Inputs are preserved, retries are bounded, and duplicate lessons/messages/rewards are not created. Verify normal PDF success too. |
| F10 | Empty/whitespace input has actionable validation. The agreed 16,000-character budget is consistently enforced or explicitly handled at 15,999/16,000/16,001 and 17,000 characters on client and server. Test Unicode length semantics. Supported PDF/TXT/Markdown succeed; unsupported type and >10 MB fail clearly. |
| F11 | Apply the confirmed product decision about feedback gating. Optional prompts do not interrupt submission or trap the learner. Test report generation/export separately; never create a fake rating to unlock it. |
| F12 | At 390×844, study tabs are fully visible with adequate touch targets, no 16 px toolbar collapse, and discoverable working horizontal access to all tabs. Test each study mode, document status, composer, keyboard focus and real touch where available. Recheck 768×1024 and desktop. |
| F13 | Sign Up Free consistently opens Create Account; Sign in consistently opens Sign In, regardless of previously opened mode. |
| F14 | Guest explanations render as readable paragraphs/true sections rather than arbitrary sentence-fragment headings. Verify ordinary prose and actual structured model output. |
| F15 | One footer is shown. English/Hindi/Kannada static labels, dialogs and accessibility strings follow the selected language. Native-speaker educational review is recorded separately from functional language switching. |
| F16 | Podcast play/pause accessible names match state; keyboard activation, chapter seek and time/progress controls work. Playback-state checks do not substitute for listening or microphone testing. |
| F17 | Subscription action has a meaningful result appropriate to the account and beta state. Billing remains paused if intended. Recheck admin and ordinary-parent test accounts without making purchases. |
| F18 | The recorded five-question scenario produces the score dictated by the actual accepted answers, without inventing an error. Verify correct, incorrect, corrected and skipped answers; interrupted/unlocked sessions; refresh/resume; and exactly-once scoring/rewards. Keep structured quiz state as the authority. |
| F19 | Each scored multiple-choice question has one defensible answer under stated conditions. Ambiguous questions are rejected/reworded rather than unfairly scored. Verify the photosynthesis limiting-factor example against its source. |

## Preserve the working journeys

- Public landing, language/theme controls, six information pages and signup/sign-in entry points.
- Five guest questions, blocking the sixth, and quota persistence after refresh.
- User login, signed-in session persistence, sign-out and signed-out route gating.
- Contextual text explanations, hint-only homework, exam feedback and independent homework image reading.
- Pasted/document teaching, lesson save → refresh → reopen, study guide, mind map, quiz, flashcards, diagram matching and podcast playback.
- Audio preference persistence and the study-time limit/unlock journey.

## Closure record

Create `FIX_STATUS.md` alongside these files with one row for every finding: status, reproduced root cause, changed files, regression tests, evidence, and remaining decision/limitation. Record current commit/build and test date so the 24 October QA baseline is not mistaken for a current retest.
