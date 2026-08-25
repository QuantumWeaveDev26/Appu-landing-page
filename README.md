# Appu — AI Learning Companion

An AI-powered learning companion for students in Classes 5 to 12.

* **Production URL**: [https://appuai.online](https://appuai.online)
* **Backend API**: `https://antiquewhite-elk-758047.hostingersite.com`
* **Brand / Operating Entity**: IGR Academy (`Learn with Appu`)
* **Current Cache Release**: `v=20260825-4`

---

## Documentation

* **[Developer Guide & Architecture Reference](docs/DEVELOPER.md)**: Full architecture guide, security invariants, environment setup, database schema, and test suites.
* **[Project Context & Decisions](docs/PROJECT_CONTEXT.md)**: High-level product principles, tenancy boundaries, and system evolution.
* **[Current Task & Roadmap](docs/CURRENT_TASK.md)**: Active work log and task status tracking.
* **[Phase 2 Architecture Specification](docs/PHASE2_ARCHITECTURE.md)**: Deep dive into Supabase Auth, PostgreSQL schema, Razorpay billing, and n8n gateway design.

---

## Repository Structure

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
│   ├── style.css                 # Responsive design system & dark glassmorphic tokens
│   ├── appu-config.js            # Public production environment configuration
│   ├── appu-session.js           # In-memory authentication session manager
│   ├── appu-backend-client.js    # Secure backend gateway HTTP client
│   ├── parent-onboarding-shell.js# Parent auth & Razorpay checkout orchestration
│   ├── parent-setup-ui.js        # Parent Zone modal, pricing cards, and usage meters
│   ├── avatar-stage.js           # Interactive stage & avatar animations
│   ├── voice-contract.js         # Voice data telemetry schema & normalizers
│   ├── voice-engine.js           # Audio playback & speech recording engine
│   ├── chat-agent.js             # Interactive chat drawer and mission handling
│   ├── app.js                    # Main application bootstrap coordinator
│   ├── .htaccess                 # Apache rewrite rules for clean URLs & HTTPS enforcement
│   └── assets/                   # Official IGr logo, 3D avatar cutouts, stage videos
├── backend/                      # Fastify Node.js backend (deployed to Hostinger Node hosting)
├── tests/                        # Frontend, DOM structure, and compliance test suites
├── docs/                         # Architecture guides, developer specs, and runbooks
└── .gitignore                    # Global git ignore configuration
```

---

## Running Tests

```bash
# 1. Frontend Integration & Legal Compliance Tests (81 tests)
node --test tests/*.test.js

# 2. Semantic Page Structure & Accessibility Tests (8 tests)
python tests/page-structure.test.py

# 3. Static Asset Integrity & Secret Scan Audit
node tests/audit-frontend-bundle.cjs

# 4. Canonical Single-Source Duplication Audit
node tests/check-no-duplicates.cjs

# 5. Backend Typecheck, Multi-Tenancy & Concurrency Tests (208 tests)
cd backend
npm run typecheck
npm test
npm run build
```

---

## Frontend Production Deployment Architecture

Production frontend deployments are automated via GitHub Actions:

```text
main branch (monorepo source of truth)
   │
   │  (push to main with changes in frontend/**)
   ▼
GitHub Actions (.github/workflows/deploy-frontend.yml)
   │
   ├── 1. Runs full test suite (Node.js + Python)
   ├── 2. Scans for secret leaks & localhost URL fallbacks
   ├── 3. Validates static asset integrity & zero duplicates
   │
   ▼ (only on test pass)
frontend-production branch
   │  (contains ONLY the root contents of frontend/)
   │
   ▼ (automatic webhook trigger)
Hostinger Git Auto Deployment
   │
   ▼
appuai.online/public_html
```

### Hostinger Configuration Instructions

1. Log in to **Hostinger hPanel** $\rightarrow$ **Websites** $\rightarrow$ **Manage** `appuai.online`.
2. Navigate to **Advanced** $\rightarrow$ **GIT**.
3. Configure the repository deployment:
   - **Repository**: `https://github.com/QuantumWeaveDev26/Appu-landing-page.git`
   - **Branch**: `frontend-production`
   - **Install Directory**: `public_html`
4. Click **Create / Deploy**.
5. Enable **Auto Deployment Webhook** in Hostinger and copy the webhook URL into your GitHub repository under **Settings** $\rightarrow$ **Webhooks** (trigger on push).
