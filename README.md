# Appu — AI Learning Companion

An AI-powered learning companion for students in classes 5 to 12.

## Repository Structure

```text
Appu-landing-page/
├── frontend/                 # Canonical frontend static web application (Hostinger public_html)
│   ├── index.html            # Main application HTML shell
│   ├── style.css             # Responsive design system & Parent Zone layouts
│   ├── appu-config.js        # Public production environment configuration
│   ├── appu-session.js       # In-memory authentication session manager
│   ├── appu-backend-client.js# Secure gateway HTTP client
│   ├── parent-onboarding-shell.js # Parent auth & Razorpay checkout orchestration
│   ├── parent-setup-ui.js    # Parent Zone modal, pricing cards, and usage meters
│   ├── avatar-stage.js       # Interactive stage & avatar animations
│   ├── voice-contract.js     # Voice data telemetry schema & normalizers
│   ├── voice-engine.js       # Audio playback & speech recording engine
│   ├── chat-agent.js         # Interactive chat drawer and mission handling
│   ├── app.js                # Main application bootstrap coordinator
│   └── assets/               # Production images, videos, and stage backgrounds
├── backend/                  # Fastify Node.js backend (deployed to Hostinger Node hosting)
├── tests/                    # Frontend and integration test suites
├── docs/                     # Architecture and product specifications
└── .gitignore                # Global git ignore configuration
```

## Running Tests

```bash
# Frontend Tests
node --test tests/*.test.js
python tests/page-structure.test.py
node tests/audit-frontend-bundle.cjs
node tests/check-no-duplicates.cjs

# Backend Tests
cd backend
npm run typecheck
npm test
npm run build
```

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
