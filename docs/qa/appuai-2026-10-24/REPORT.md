# AppuAI end-to-end QA report

**Site:** https://appuai.online/?view=landing  
**Date:** 24 October 2026 (IST)  
**Method:** interactive browser testing of the deployed website, visible DOM/accessibility inspection, screenshots, and bounded browser-console review. No application source or backend/database access was used.

**Assessment:** Core tutoring works, including text, contextual follow-ups, homework images, uploaded notes, structured quizzes, diagrams, flashcards and podcast playback. **Do not treat this build as ready for a broad rollout yet:** the conversational quiz misgrades correct answers, a saved-lesson navigation overlay can block the screen, mobile study tabs are vertically clipped, and curriculum sources can be attributed to the wrong class. Chat ordering, inconsistent offers/progress labels and accessibility also need attention. This is functional QA, not a security certification or proof that every device/account/payment combination works.

**19 findings:** 4 high-priority fixes (F01, F02, F12, F18), plus functional/UX/accessibility issues and recommendations. P1 means fix before a broad rollout; P2 means address in the next stable beta; P3 means polish/accessibility follow-through. Findings describe observed behaviour, not source-code root causes.

The signed-in account was **Admin Unlimited Access**, with one existing Grade 8 learner. A separate clean visitor browser was used to verify the five-question guest allowance. Desktop Edge, a second Chromium browser context, and emulated 390×844 and 768×1024 viewports were exercised; no physical Android/iPhone or Safari/Firefox testing was performed.

## Findings to fix

### F01 — P1 — Opening a saved lesson can strand an invisible menu overlay

**Reproduce:** Open menu → My Learning → Study Lesson. The lesson loads, but the whole page stays blurred with no menu visible. This occurred again on a second saved-lesson opening.

**Evidence:** [Blurred stage](evidence/saved-lesson-overlay.png). DOM inspection showed the navigation drawer still had `aria-hidden="false"` while positioned at x = −320, outside the viewport. Toggling the menu restored access. Escape also recovered the screen but dismissed the lesson.

**Expected/fix:** Close the originating drawer and its backdrop before opening another panel or lesson. Keep visual position, open state, focus and ARIA state synchronized. Verify menu → saved lesson, menu → report, and menu → profile transitions on desktop and mobile.

### F02 — P1 — Generated curriculum sources can be incorrectly attributed

A Class 8 photosynthesis follow-up displayed **“Source: NCERT Class 8 Science - Photosynthesis in Higher Plants.”** The official [ePathshala listing](https://epathshala.nic.in/topicc.php?id=11080CH13) places *Photosynthesis in Higher Plants* in **Class 11 Biology**. The source badge was plain text rather than a link to the supporting passage.

**Expected/fix:** Resolve curriculum references from a verified catalogue, including edition, class, chapter and supporting section. Distinguish an explanation adapted for a Class 8 learner from its actual source. Omit an unverified source claim rather than inventing a precise NCERT attribution.

### F03 — P2 — Restored chat can put the answer before the question

**Reproduce:** Send the QA_IMAGE_924 homework image question, receive the answer, refresh, then reopen chat. The assistant answer appears above the user question; both display 05:36 pm. The conversation and answer do persist.

**Evidence:** [Order after refresh](evidence/history-order-after-refresh.png).

**Expected/fix:** Preserve a stable server-side sequence/order for messages and use it consistently on write and reload. Test messages sent within the same second and image/text combinations. Do not rely on coarse timestamps or arbitrary identifier ordering.

### F04 — P2 — Signup offers disagree

The pricing page offers **30 complimentary personalised chats** after signup. The signup/authentication modal offers **5 free personalised chats**. The five guest questions are a separate allowance and worked correctly in a clean session.

**Evidence:** [Signup dialog](evidence/sign-in-handoff.png); [pricing page](https://appuai.online/pricing.html).

**Expected/fix:** Use one entitlement source for pricing, signup, onboarding and usage displays. Clearly distinguish guest allowance from registered-account allowance. The supplied admin account cannot validate normal registered-user quota enforcement.

### F05 — P2 — Progress labels disagree with actual progress

The visible header updated from 270 XP/Level 3 to 385 XP/Level 4 during testing, but its accessible name stayed **“XP Stars: 120”**, and its level description stayed **“Level 2: Curious Explorer.”** The Learning Quest modal showed **Level 4: Star Student** with **“Next: Level 3”** and **85/200 XP**.

**Evidence:** [Progress inconsistency](evidence/progress-inconsistency.png).

**Expected/fix:** Derive every visible label, accessible name, progress maximum/value and next-level calculation from the same current progress model. Quiz score calculation itself passed: two correct answers out of three produced 67% and +40 XP.

### F06 — P2 — Parent setup modal does not reliably contain keyboard focus

**Reproduce:** Open parent setup/sign-in, focus Close parent setup, then Shift+Tab. Focus moved to the underlying composer send button instead of wrapping within the modal. Escape correctly closes the modal and returns focus to its trigger.

**Expected/fix:** Make background content inert while a modal is open, trap Tab/Shift+Tab within the active dialog, focus its first relevant control on open, and restore focus on close. Test stacked dialogs and drawers as well.

### F07 — P2 — Support scheduling link returns to the landing page

**Reproduce:** Contact Us → Open Schedule Call. Its destination is `/index.html#discovery`, but the app rewrites to `/index.html?view=landing` and displays the landing page. No booking UI or explicit sign-in-to-book explanation appears.

The public support page also lacks a directly visible email/phone contact or issue-submission form; its principal routes point back into the application.

**Expected/fix:** Preserve the booking intent through authentication, or show a clear access requirement and continue to booking afterward. Provide a usable fallback support channel, including when users cannot sign in.

### F08 — P2 — Personalisation marks WhatsApp REQUIRED despite optional policy

Basic Profile shows **“Connect your WhatsApp — REQUIRED.”** The privacy policy describes a parent phone number as optional and requiring explicit consent. The number and consent inputs had no native required attribute; consent was unchecked in the inspected profile.

**Expected/fix:** Align product wording and actual validation with the intended optional/required behaviour. Keep learning access and optional messaging consent distinct. No real number or consent was changed during this test.

### F09 — P2 — Document teaching can take a long time with unclear retry feedback

The small valid PDF extracted **285 characters** promptly. Teaching eventually returned the correct 7 m × 4 m example, but console diagnostics showed `[NotesTutor] Request failed or timed out (attempt 1): Timeout` before recovery. Openverse image lookups also logged timeouts. The learner primarily sees “Working it out” or a generating illustration state.

**Expected/fix:** Show a clear pending/retrying state, give the learner a cancel/retry path, preserve the document and typed question, and bound retries. Measure backend timing separately; the interactive observations here are not a controlled latency benchmark.

### F10 — P2 — Whitespace notes have no useful validation message

In Paste Text, three spaces leave **Teach Me From This** enabled. Clicking it leaves the form open with no visible explanation. The field also accepted **17,000 characters**, displayed **17,000 / 16,000 characters**, and left submission enabled. This oversized text was cleared without submitting it; backend acceptance/truncation was not tested.

**Evidence:** [Over-limit input](evidence/notes-over-character-limit.png).

**Expected/fix:** Validate trimmed text, show an actionable inline error, disable submission until usable content exists, and enforce/document the same length limit at UI and backend boundaries. Do not infer a server validation bypass from the missing HTML attribute alone.

### F11 — P2 — Reports are gated behind feedback and can interrupt learning

Child Progress Report requires a star rating and feedback before a report can be generated. Empty submission correctly says **“Please pick a star rating first.”** An automatic feedback/report prompt also appeared after a run of learning interactions and interrupted the next mission attempt. “Maybe later” dismisses it.

**Evidence:** [Feedback gate](evidence/report-feedback-gate.png).

**Recommendation:** Allow parents to access learning progress independently of giving a product rating. Make feedback optional and display it at a natural stopping point. No rating or feedback was fabricated/submitted in this test; actual report generation, contents and report export remain unverified.

### F12 — P1 — Mobile study toolbar clips 44 px tabs into a 16 px strip

At 390×844, both the loading view and a completed saved lesson showed study tabs with their tops and bottoms cut off. DOM geometry confirmed the toolbar had **16 px height**, while individual tabs had **44 px height**. The toolbar's horizontal content was 1,083 px wide inside a 290 px viewport; an attempted horizontal wheel scroll did not move it (`scrollLeft` stayed 0). Horizontal overflow is configured, but it does not fix the vertical clipping. The document-loading panel was also crowded by the active-document banner.

**Evidence:** [Completed mobile lesson](evidence/mobile-completed-lesson.png), [loading state](evidence/mobile-study-tabs.png).

**Expected/fix:** Reserve at least a full touch-target height plus padding for the toolbar, prevent inappropriate flex shrinking, make horizontal navigation discoverable, and reserve vertical space for document status and the composer. Retest actual touch swipes, keyboard focus and every study tab on a real phone. The separate mobile chat drawer fit the viewport at about 390×844 without document overflow.

### F13 — P3 — Signup CTA opens Sign In

The **Try Beta — Sign Up Free** banner button opened the modal with **Sign In to Parent Zone** as the submit action, requiring a manual switch to Create Account.

**Evidence:** [CTA destination](evidence/signup-cta-opens-login.png).

**Expected/fix:** Route signup CTAs to Create Account and sign-in CTAs to Sign In. Reset the appropriate mode each time, rather than inheriting the last mode.

### F14 — P3 — Guest answer renderer breaks prose into arbitrary headings

Guest explanations were split into headings such as **“That beautiful reddish”**, **“Imagine sunlight as”** and **“Want to picture”**, followed by the rest of the sentence as a list item. This hurts readability and heading navigation despite the answer's basic meaning being understandable.

**Evidence:** [First guest answer](evidence/guest-first-answer.png).

**Expected/fix:** Render normal prose as paragraphs and only create headings from actual semantic sections. Do not use the first few words of each sentence as a heading.

### F15 — P3 — Duplicate footer and partial localisation

The landing page has two sets of copyright/policy links. The extra footer stays English in Hindi/Kannada mode. Signed-in learning content and many main controls translate, but labels including “THINK OF IT LIKE THIS,” “STEP BY STEP,” “QUICK CHECK,” “Tap step to explore,” some accessibility labels, and upload/report flows remain English.

**Expected/fix:** Use one footer and cover all static strings through the same localisation system. Obtain native-speaker review of Kannada grammar and educational clarity; simply receiving text in Kannada is not a fluency/accuracy certification.

### F16 — P3 — Podcast play/pause accessible name is stale

Podcast audio loads, starts, advances, seeks to a selected chapter and pauses. While playing, the visible button changes to **Pause**, but its accessible name remains **Play Appu Audio Lesson**.

**Expected/fix:** Change the accessible name along with playback state, and expose time/progress controls to keyboard and screen-reader users. Physical audio quality, accent and live speech recognition were not assessed from playback state alone.

### F17 — P3 — Subscription button has no visible outcome in the supplied admin view

The learner-selection modal showed Admin Unlimited Access/₹0. Clicking **Manage Subscription Plans** produced no visible route, dialog, message or new tab. Pricing states that paid plans are on hold during beta.

**Expected/fix:** Explain that billing is paused, show current entitlement, or disable the action with a clear reason. Recheck with a normal parent account before concluding this applies to every account type.

### F18 — P1 — Conversational quiz invents a wrong answer and miscalculates the score

**Reproduce:** Play a Quick Quiz → Class 8 Science/photosynthesis → answer all five questions. Submitted answers were **chlorophyll, carbon dioxide, chloroplast, oxygen, light intensity**, matching the offered correct choices. After question 4's oxygen answer, Appu explicitly said **“Exactly”** and moved to question 5. The final result then said **4 out of 5**, claiming the learner missed question 4 by choosing carbon dioxide. That is contradicted by the recorded question-4 answer.

**Evidence:** [Full quiz transcript](evidence/conversational-quiz.txt), [incorrect final score](evidence/conversational-quiz-wrong-score.png).

**Expected/fix:** Store each quiz question, accepted answer and evaluated user response as structured state. Calculate the score deterministically from those records; let the model explain the result rather than reconstructing answers and scores from prose. Run correct, incorrect, corrected-answer, interruption/unlock and resumed-session cases. The separate three-question lesson quiz scored correctly; this failure is in the conversational five-question mission.

### F19 — P2 — Generated multiple-choice question has an ambiguous single best answer

Question 5 asked which factor affects photosynthesis **“the most”**, offering light intensity, soil type and amount of water, without specifying environmental conditions. Appu treated light intensity as unconditionally correct. Several conditions affect photosynthesis; the limiting factor depends on which condition is suboptimal, as explained in [NCERT Biology, section 11.10](https://ncert.nic.in/textbook/pdf/kebo111.pdf).

**Expected/fix:** Ask a precise question with one defensible answer. For example, specify a shaded plant with adequate water/CO₂ before asking about increasing light. Validate generated distractors and answer explanations before scoring a learner.

## What worked

| Flow | Observed result |
|---|---|
| Public landing and media | Loads; visible mentor/brand images load. |
| Public languages | English, Hindi and Kannada main landing content switches. |
| Public theme | Light/dark toggle changes state; original dark state restored. |
| Information pages | Privacy, terms, refunds, delivery, pricing and contact all open. |
| Guest onboarding | Class and favourite-subject selection proceed; nickname can be skipped. |
| Guest allowance | Five answers delivered; count decreases 4 → 3 → 2 → 1 → used; sixth blocked. |
| Guest quota persistence | Refresh does not grant another answer; next attempt still gates sign-in. |
| Guest safety sample | Advises against sharing home address with an online stranger and to tell a trusted adult. This is one sample, not exhaustive safety testing. |
| Email validation | Empty and malformed email produce browser validation. |
| Invalid login | Synthetic reserved example.com account returns Invalid login credentials and re-enables submit. |
| Real sign-in | User signed in successfully; active learner and admin entitlement displayed. |
| Session persistence | Refresh keeps the authenticated learner session. |
| Sign-out and route gating | Sign-out returns to landing. Visiting the previously used `?app=1` route afterward also returns to landing; the learner badge/history are no longer visible. This verifies UI routing, not backend authorization independently. |
| Science explanation | Photosynthesis explanation and word equation broadly correct. |
| Contextual follow-up | Correctly identifies water as the source of released oxygen. |
| Homework Helper | Asks for a problem; hint-only algebra prompt does not reveal the final answer. |
| Exam Practice | Asks for class/subject/chapter/date; gives 2x + 7 = 15; rejects x = 11 and prompts substitution/checking. |
| Homework image | Independently reads 9 m × 3 m and computes 27 m² and 24 m correctly. |
| Image history | Text conversation persists; original image becomes a Photo attached placeholder after refresh, consistent with the stated image-retention approach. Message order has F03. |
| Pasted notes | Uses supplied 7 m × 4 m example; correct area 28 m² and perimeter 22 m. |
| Valid PDF | Extracts 285 characters and produces a grounded rectangle lesson after retry. |
| Oversized file | 11 MB text file rejected with the advertised 10 MB limit message; teaching disabled. |
| File type and TXT extraction | Unsupported CSV rejected with a specific type message. Valid TXT extracts 272 characters and reaches Ready. |
| Paste upper boundary | 17,000 characters accepted against displayed 16,000 limit; submission remains enabled. F10. |
| Saved lesson opening | Content loads; navigation overlay defect F01 needs fixing. |
| New lesson save | Water Cycle save changes to Saved and My Learning increases from 3 to 4. The new item survives refresh and reopens with the saved lesson content. |
| Lesson quiz | Wrong-answer explanation, correct-answer reward, Next, final results all work. 2/3 = 67%, +40 XP. |
| Conversational five-question quiz | All five questions and answers completed; final score incorrectly 4/5, with fabricated question-4 error. F18. Question 5 wording also has F19. |
| Flashcards | Flips; Got It advances and increments known count; Review Later increments review count; previous/next controls present. |
| Study guide | Displays summary, definitions and exam takeaways. |
| Mind map | Renders the saved lesson's concept branches. |
| Diagram exploration | Selecting Plants updates the explanation to part 3 of 5. |
| Diagram practice | Incorrect match rejected; all five correct matches produce Diagram Mastered and +20 XP. Tap matching exercised; actual drag gesture was not exercised. |
| Podcast | Loaded duration ~78 seconds; play, time advancement, chapter seek and pause verified. |
| Prompt library | Loads personalised prompts; Homework Hints filter restricts the list appropriately. Some wording is awkward. |
| Guided tour | All seven steps and Let's go complete. |
| Voice preference | Turning Play answers aloud off and saving persists after refresh. Original on-state restored, saved and verified after a second refresh. Speed 0.93 and sound-effects on preserved. |
| Timer persistence | Brief default 30m on reload subsequently resolves to real remaining time; not treated as a timer-reset defect. |
| Study-time lock | Actual 30-minute limit displays locked session with parent WhatsApp unlock requirement. User performed the unlock; session resumed with 30m. |
| Report form validation | Blank feedback submission requests a star rating. No feedback submitted. |

## Boundaries and account changes

- This was a live functional test, not load testing, source review, penetration testing, a full WCAG audit, or independent proof of the “100% kid-safe” marketing claim.
- Registration/email verification/Google OAuth were not newly completed; the user performed the real login. Parent age/consent controls were inspected, not tested by creating an underage or fake real account.
- The supplied account is admin-unlimited. Ordinary parent signup credits, quota depletion, multi-child isolation and paid-plan entitlements need a separate normal test account.
- Payments are held during beta. No purchases, subscriptions, refunds, actual support bookings or account deletion were performed.
- No WhatsApp study note/report/OTP was sent by the agent. The user handled the study-time unlock. Delivery logs, consent enforcement and report generation were not independently verified.
- Live microphone capture/transcription and physical audio quality were not verified. No unexpected mic/camera permission was granted.
- Profiles and advanced preferences were inspected. No existing learner DOB, phone, messaging consent or household profile was changed.
- Tests added synthetic questions and one Water Cycle saved lesson. Quiz/flashcard/diagram actions increased XP from 270 to 385. One initial QA-only thread was cleared during history-controls testing; the four pre-existing conversations remained listed. No Clear all history or original-conversation deletion was executed.
- Screenshots and test fixtures are in this folder. Viewport overrides were reset; English, guest dark theme and original audio preference restored. The final authentication test intentionally ended **signed out**. No application source or production configuration was changed.

## Suggested release checks after fixes

1. Verify public → signup → email verification → non-admin learner setup → first lesson → save → refresh → reopen → continue conversation with a new normal parent account.
2. Verify guest five-question exhaustion and authenticated beta entitlement against the same documented offer.
3. Verify stable history ordering for same-second messages and image/text messages.
4. Verify modal focus/overlay cleanup across all menu destinations, including Escape and narrow screens.
5. Verify every curriculum badge against the actual class/chapter/source passage; use working source links.
6. Verify the study timer, user-assisted unlock, optional WhatsApp consent, and report access without requiring a product rating.
7. Verify conversational quiz grading from structured answer records, including interruption by the study timer and a user-assisted unlock. Validate question wording before scoring.
