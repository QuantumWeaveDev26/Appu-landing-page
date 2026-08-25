# APPU AI — Developer Guide & Architecture Reference

Last Updated: 2026-08-25  
Active Cache Release: `v=20260825-4`  
Production Frontend: `https://appuai.online`  
Hosted Backend API: `https://antiquewhite-elk-758047.hostingersite.com`  

---

## 1. System Overview

APPU AI is an interactive AI-powered learning companion for students in Classes 5 to 12. 

### Technology Stack
* **Frontend**: Vanilla JavaScript (ES modules / browser-native JS), Vanilla CSS (design tokens & dark glassmorphism system), Semantic HTML5. Zero build step for frontend assets.
* **Backend**: Node.js 20+ with Fastify, TypeScript, PostgreSQL (pg / pg-pool), Zod validation.
* **Authentication**: Supabase Auth (JWT Bearer tokens verified server-side with `SupabaseAuthVerifier`).
* **Payments**: Razorpay Subscriptions & Standard Checkout with server-side HMAC-SHA256 signature verification.
* **AI Orchestration**: Backend gateway $\rightarrow$ n8n AI workflow with HMAC-SHA256 request signing and ElevenLabs voice generation.

---

## 2. Repository Structure

```text
Appu-landing-page/
├── frontend/                     # Canonical frontend static web application (Hostinger public_html)
│   ├── index.html                # Main application interactive shell & APPU 3D stage
│   ├── pricing.html              # Public Razorpay-compliant pricing & plan comparison
│   ├── privacy-policy.html       # Minor learner privacy policy & parent supervision terms
│   ├── terms-and-conditions.html # SaaS terms of service & parent obligations
│   ├── cancellation-refund-policy.html # Digital subscription cancellation & refund policy
│   ├── shipping-delivery-policy.html   # Instant digital SaaS fulfillment statement
│   ├── contact-us.html           # IGR Academy support contact details
│   ├── style.css                 # Unified responsive design system & dark theme tokens
│   ├── appu-config.js            # Public client constants (Supabase public key, backend API URL)
│   ├── appu-session.js           # In-memory authentication session & learner profile manager
│   ├── appu-backend-client.js    # Secure backend gateway HTTP client (replaces direct n8n calls)
│   ├── parent-onboarding-shell.js# Parent auth, household onboarding & checkout coordinator
│   ├── parent-setup-ui.js        # Parent Zone modal, plan selector, learner setup & usage meters
│   ├── avatar-stage.js           # Interactive 3D avatar stage & ambient cursor choreography
│   ├── voice-contract.js         # Voice telemetry schema, payload normalizers & base64 parser
│   ├── voice-engine.js           # Browser speech recognition & audio playback engine
│   ├── chat-agent.js             # Conversational chat drawer & interactive action cards
│   ├── app.js                    # Application lifecycle orchestrator & event coordinator
│   ├── .htaccess                 # Apache rewrite rules for clean URLs & HTTPS enforcement
│   └── assets/                   # Static assets (igr-logo.png, appu_cutout_new.png, videos)
├── backend/                      # Node.js + TypeScript Fastify backend API
│   ├── src/
│   │   ├── app.ts                # Fastify instance builder, CORS, and security hooks
│   │   ├── server.ts             # Server entry point & graceful shutdown listeners
│   │   ├── config/               # Environment variable schema & validation (env.ts)
│   │   ├── db/                   # PostgreSQL client pool & schema migration runner
│   │   ├── domain/               # Domain services, repositories & business logic
│   │   │   ├── appu-request/     # Atomic quota reservation & idempotency engine
│   │   │   ├── gateway/          # HMAC signing, audio duration parsing & n8n client
│   │   │   ├── guest/            # Cryptographic 3-turn guest session management
│   │   │   ├── mentor-context/   # Authoritative server-side learner context synthesizer
│   │   │   ├── personalisation/  # Child learning preferences repository & schemas
│   │   │   ├── subscription/     # Plan catalogue, Razorpay webhook & event handling
│   │   │   ├── tenancy/          # Household authorization & multi-tenant isolation
│   │   │   └── usage/            # Append-only usage ledger & monthly voice/session meters
│   │   ├── errors/               # Standardized application error classes & Fastify handler
│   │   ├── middleware/           # Bearer token auth preHandler hook
│   │   └── routes/               # API route handlers (gateway, auth, household, billing)
│   ├── migrations/               # PostgreSQL schema migrations (001 to 004)
│   └── tests/                    # Backend unit, integration & concurrency test suites
├── tests/                        # Frontend integration, DOM structure & compliance tests
├── docs/                         # Architecture documentation & operational runbooks
└── README.md                     # Project overview and deployment guide
```

---

## 3. Core Security & Architectural Invariants

1. **Zero Browser Secret Exposure**:
   * The browser client contains **zero** private keys, database URLs, Razorpay key secrets, or n8n webhook URLs.
   * `frontend/appu-config.js` contains only public client constants (`sb_publishable_...` and API base URL).
2. **Authoritative Backend Gateway**:
   * Browser communicates exclusively with the Fastify backend (`POST /api/appu/message`), never directly with n8n.
   * Backend signs all outgoing requests to n8n with `v1=` HMAC-SHA256 digests over `timestamp.rawBody`.
3. **Multi-Tenant Household Isolation**:
   * Every learner profile and personalisation record is scoped strictly by `household_id`.
   * Cross-tenant access is blocked at the database query level (`TenancyRepository.getChildProfile(db, household.id, childId)`).
4. **Authoritative MentorContext**:
   * `MentorContextBuilder` constructs learning context (grade band, preferred language, learning style, goals) strictly from database records after child ownership is confirmed.
5. **Enforced Guest Limits**:
   * Unauthenticated visitors are capped at **3 AI turns** maximum via cryptographically signed tokens (`GuestSessionService`). Turn #4 is rejected with HTTP 403 `GUEST_LIMIT_REACHED`.
6. **Usage Metering & Idempotency**:
   * Atomic quota reservation occurs in PostgreSQL using transactional advisory locks (`pg_advisory_xact_lock`) before upstream AI generation.
   * Replayed `Idempotency-Key` headers return cached responses without consuming extra sessions.
7. **Input Validation & SQL Injection Defense**:
   * 100% of database queries use PostgreSQL parameterized bindings (`$1, $2, ...`).
   * 100% of route payloads are validated with Zod schemas.
8. **XSS Protection**:
   * Chat message bubbles use `textContent` (immune to HTML injection).
   * Dynamic learner names and emails in modal dialogs are escaped with `escapeHtml()`.

---

## 4. Local Development Setup

### Prerequisites
* Node.js 20+
* PostgreSQL 15+ (or Supabase local/remote instance)
* Python 3.9+ (for structural tests)

### Backend Environment Configuration
Create `backend/.env` based on `backend/.env.example`:

```env
PORT=3000
HOST=0.0.0.0
NODE_ENV=development
LOG_LEVEL=info
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/appu_dev
CORS_ALLOWED_ORIGINS=http://localhost:5500,http://127.0.0.1:5500,https://appuai.online
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key
RAZORPAY_KEY_ID=rzp_test_your_key_id
RAZORPAY_KEY_SECRET=your_razorpay_secret
RAZORPAY_WEBHOOK_SECRET=your_webhook_secret
N8N_APPU_WEBHOOK_URL=https://n8n.yourdomain.com/webhook/appu-mentor
N8N_REQUEST_HMAC_SECRET=your-secure-hmac-secret-min-32-chars
N8N_CALLBACK_HMAC_SECRET=your-secure-callback-secret-min-32-chars
GUEST_SESSION_JWT_SECRET=your-secure-guest-jwt-secret-min-32-chars
```

### Running Locally
```bash
# 1. Install backend dependencies & run database migrations
cd backend
npm install
npm run migrate

# 2. Start backend dev server (auto-reloading with tsx)
npm run dev

# 3. Serve frontend static files (from repository root)
# Using Python:
python -m http.server 5500 -d frontend
# Or using Node http-server:
npx http-server frontend -p 5500 -c-1
```

---

## 5. Testing & Quality Assurance

Run the complete test suite before any commit:

```bash
# 1. Run all frontend integration & compliance tests (81 tests)
node --test tests/*.test.js

# 2. Run page structure and accessibility tests (8 tests)
python tests/page-structure.test.py

# 3. Run static asset bundle and secret scan audit (0 errors)
node tests/audit-frontend-bundle.cjs

# 4. Run canonical single-source duplication audit (0 duplicates)
node tests/check-no-duplicates.cjs

# 5. Run backend TypeScript typecheck, unit, and concurrency tests (208 tests)
cd backend
npm run typecheck
npm test
npm run build

# 6. Check Git whitespace & line endings
git diff --check
```

---

## 6. Cache-Busting Versioning Protocol

All first-party CSS and JavaScript references in canonical HTML files (`frontend/*.html`) MUST include the unified deterministic cache query string:

```html
<link rel="stylesheet" href="style.css?v=20260825-4">
<script src="app.js?v=20260825-4"></script>
```

Whenever any first-party frontend CSS or JS file is modified:
1. Increment the version marker across all 7 HTML files (e.g., `v=20260825-4` $\rightarrow$ `v=20260825-5`).
2. Verify with `tests/public-policy-pages.test.js` that no stale version markers remain.
3. Never modify third-party CDN script URLs (`cdnjs`, `jsdelivr`, `razorpay`).

---

## 7. Production Deployment Pipeline

```text
main branch (monorepo source of truth)
   │
   │  (push to main modifying frontend/**)
   ▼
GitHub Actions (.github/workflows/deploy-frontend.yml)
   │
   ├── 1. Runs full test suite (Node.js + Python)
   ├── 2. Scans for secret leaks & localhost URL fallbacks
   ├── 3. Validates static asset integrity & zero duplicates
   │
   ▼ (only on 100% test pass)
frontend-production branch
   │  (contains ONLY the clean root contents of frontend/)
   │
   ▼ (automatic webhook trigger)
Hostinger Git Auto Deployment
   │
   ▼
appuai.online/public_html
```
