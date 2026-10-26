# Task for the coding assistant

Inspect the existing AppuAI project and fix the findings in this handoff. Read `REPORT.md`, `ACCEPTANCE.md` and the relevant files in `evidence/` before editing. The observations are from 24 October 2026; check the current code/deployment and identify findings already resolved since then.

1. Reproduce each relevant finding and map it to the actual frontend, API, database or workflow implementation. Separate verified root causes from hypotheses. Do not redesign or rewrite the application to address small defects.
2. Prioritize F18 (conversational quiz grading), F01 (stuck navigation overlay), F12 (mobile toolbar clipping), and F02 (curriculum attribution), followed by F03 (restored message order). Then address the remaining findings in small, reviewable groups.
3. For conversational quizzes, persist structured question/answer/evaluation state and calculate scores deterministically. The recorded quiz accepted oxygen for question 4, then falsely reported that answer as carbon dioxide and scored 4/5. Handle interruption, parent unlock, refresh and resume without changing answers or double-awarding rewards.
4. Synchronize drawer/modal/backdrop/focus state. Restore stable conversation ordering across save/reload. Make mobile study controls fully readable and usable at 390×844, then recheck tablet and desktop. Do not fix source badges by simply replacing one hardcoded grade with another: use verified references or clearly omit unverified attribution.
5. Preserve existing learner data, authentication, saved lessons, working teaching features and intended beta restrictions. Use reversible, compatibility-safe migrations only when a verified cause requires one. Never reset production data to make a test pass.
6. Derive offer, consent, report-gating and billing behaviour from existing authoritative configuration/product decisions. If these conflict, implement independent fixes first and ask one concise question listing the unresolved decisions. Do not invent a support email, phone number, booking endpoint, quota, source catalogue or payment policy.
7. Add focused regression tests for the actual failure cases and run the existing relevant checks. Use synthetic fixtures and test accounts. Do not send real WhatsApp messages, fabricate feedback, charge payments, delete real accounts, or alter live credentials as part of an automated test. Keep credentials out of commits and logs.
8. Verify the implemented changes against `ACCEPTANCE.md`. Test in a local/preview/staging environment using this project's normal workflow. Produce reviewable code changes and verification evidence before any production release step; this handoff alone does not request production deployment.

Deliver:

- A finding-by-finding status for F01–F19: fixed, already fixed, decision required, or not verified, with supporting evidence.
- Changed file paths, root causes and concise explanations of each change.
- Tests executed, results, browser/device sizes, account roles and any remaining coverage gaps.
- Any migrations/configuration/workflow updates, rollout steps and rollback instructions if applicable.
- Screenshots/transcripts demonstrating the repaired high-priority flows, including a correctly graded five-question quiz and readable mobile study tabs.

Do not mark a finding fixed merely because a UI label changed or a build passed. Show that its original reproduction and regression checks now succeed. Do not claim that untested payments, WhatsApp delivery, live microphone recognition or normal-parent entitlements have been validated.
