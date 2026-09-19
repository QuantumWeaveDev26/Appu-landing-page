# APPU "Next Level" — Playful Visual Learning (Milestone 1 plan)

Owner of this doc: Atlas. Built on `develop` only. **Production must stay untouched** until the user explicitly says "flip it on."

## The vision (3 pillars)
1. **APPU is a character, not a chatbox.** The blue robot lives on screen — listens, thinks, explains, celebrates.
2. **Answers are mini-lessons, not paragraphs.** Each reply is a structured "lesson card" — hook → diagram → steps → analogy → check — rendered as rich, animated components.
3. **This is the moat.** No Indian edtech makes an AI tutor feel *alive and visual per-answer*.

## Locked decisions (user, 2026-09-19)
- **Visuals:** structured diagrams (Mermaid/SVG the AI writes) + a curated pack for top concepts. **No** per-answer AI image-gen for v1 (slow/costly/accuracy risk). AI images deferred to a later "special moment" layer.
- **Tone:** adapts by grade — big playful energy for class 5–7, cleaner "study-buddy" tone for class 11–12. Use the DOB/grade already collected.
- **First build:** lesson-card answers **and** reactive mascot together = one complete "magic moment."
- **Mascot art:** none exists. Build APPU as a **code-drawn animated SVG character** (blue fluffy robot, `>=` terminal face) with a CSS/JS mood state-machine. Swap in pro art later without rewiring.

## CRITICAL — production safety (the shared brain)
The n8n "APPU Mentor" workflow and the backend API are **single shared services** — the same brain answers the live website, WhatsApp, AND the dev site. Changing its default output format would break production.

**Rule: rich output is opt-in.** The dev frontend sends `presentationMode: "rich"` in the chat request envelope. The brain emits the lesson-card JSON **only** when it sees that flag; every other caller keeps getting today's plain text. Production is 100% unaffected until we choose to flip the flag on.

## The contract — Lesson Card schema (frontend ↔ brain)
When `presentationMode: "rich"`, APPU returns (inside its normal response payload) a JSON object:

```json
{
  "mood": "explaining",
  "gradeTone": "junior",
  "blocks": [
    { "type": "hook",    "text": "Ever wonder how a plant eats without a mouth? 🌱" },
    { "type": "diagram", "kind": "mermaid", "spec": "flowchart LR; Sun-->Leaf; Water-->Leaf; CO2-->Leaf; Leaf-->Sugar; Leaf-->Oxygen" },
    { "type": "steps",   "items": ["Leaves catch sunlight", "Roots drink water", "Leaf mixes them into sugar", "Plant breathes out oxygen"] },
    { "type": "analogy", "text": "A leaf is like a tiny solar-powered kitchen." },
    { "type": "check",   "q": "What gas does the plant breathe out?", "a": "Oxygen" }
  ],
  "plainText": "full plain-text fallback of the same answer"
}
```

**Rules for the schema**
- `mood` ∈ `idle | listening | thinking | explaining | celebrating` (drives the mascot).
- `gradeTone` ∈ `junior` (cl 5–7) | `middle` (cl 8–10) | `senior` (cl 11–12) — derived from grade/DOB; controls emoji density, vocabulary, playfulness in copy.
- `blocks` is ordered; renderer draws them top-to-bottom, revealing `steps` one at a time.
- Block types for v1: `hook`, `diagram` (kind `mermaid` for now; `svg` later), `steps`, `analogy`, `check`. Unknown types are ignored gracefully.
- `plainText` is **mandatory** — the renderer falls back to it if `blocks` is missing/malformed, and it's what voice narration reads. This guarantees no blank/broken answer ever reaches a child.
- Keep diagrams simple: Mermaid flowchart/mindmap/timeline only, ≤ ~8 nodes, no external assets.

## Mascot spec (code-drawn SVG)
- One SVG of APPU (body, arms, screen-face `>=`), styled to match the existing brand cyan/gold.
- A tiny JS "mood state machine" toggling CSS classes → animations:
  - `idle`: gentle float + slow blink.
  - `listening`: leans in, face becomes `>o` / soundwave near it (mic on).
  - `thinking`: face `>~`, small spinner/dots (awaiting reply).
  - `explaining`: subtle bob while a card streams in.
  - `celebrating`: bounce + sparkles (quiz correct / session milestone).
- Placement: replaces/augments the current response-card hero area; must not fight the existing tappable card or mic CTA. Sits well on phone **and** TV (reuse the TV breakpoints already added).
- No heavy libs. Pure SVG + CSS keyframes + a ~40-line state controller. Respects `prefers-reduced-motion`.

## Milestone 1 — task split
**Apollo (frontend, on `develop`):**
1. `presentationMode: "rich"` flag in the chat request from the dev frontend only.
2. Lesson-card **renderer**: component per block type; step-by-step reveal; Mermaid rendered inline (Mermaid loads from CDN — confirm CSP/offline behavior, degrade to `plainText` if it can't render).
3. **Mascot** SVG + mood state-machine, wired to app state (mic→listening, awaiting→thinking, streaming→explaining, check-correct→celebrating).
4. Graceful fallback everywhere to `plainText`. Keep CI green (bundle audit, no-duplicates, page-structure version pin, node tests). Bump `?v=` in `frontend/index.html` **and** the pin in `tests/page-structure.test.py`.
5. Deploy to dev site; verify live `?v=` on phone + TV.

**Atlas (n8n brain — I own this, Apollo has no n8n access):**
1. Teach "APPU Mentor" to emit the lesson-card JSON **only** when `presentationMode === "rich"`, else unchanged plain text.
2. Grade-aware tone via `gradeTone`.
3. Always include `plainText`; validate JSON before returning; on any doubt, return plain text (never break a child's answer).
4. Publish workflow; test with a rich-mode request and a normal request (prove prod path unchanged).

## Verification / done criteria
- Normal (non-rich) callers — website prod path + WhatsApp — get byte-identical behavior to today. **(prod-safety gate)**
- Dev site: ask "how does photosynthesis work?" → mascot thinks → card builds with hook/diagram/steps/analogy/check → mascot explains → steps reveal one by one → voice reads `plainText`.
- Malformed card → clean fallback to `plainText`, no blank screen.
- Works on phone width and TV; `prefers-reduced-motion` calms animations.

## Later milestones (not now)
2. Curated animation pack for ~50 top concepts. 3. Quiz/"try-it" interactivity + celebration loop. 4. AI-image "special moment" layer. 5. Promote to production behind the flag once reviewed on real screens.
