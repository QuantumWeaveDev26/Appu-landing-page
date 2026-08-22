# Appu Platform — Production Deployment Runbook

This runbook defines the authoritative procedure for deploying the Appu Phase 2 full-stack application (Vanilla Frontend + Node.js/Fastify Backend + PostgreSQL + Supabase Auth + Razorpay Subscriptions + n8n AI Gateway) to production hosting environments (e.g., Hostinger VPS/Node.js, AWS, Railway, Render).

---

## 1. System Architecture Topology

```
┌──────────────────────────────────────────────────────────────────────────────────────────┐
│                                   CLIENT LAYER (Browser)                                 │
│  - Static Assets (HTML5 / Vanilla CSS / Vanilla ES6+ JS)                                 │
│  - AppuSession In-Memory Token Vault (Zero Bearer Tokens in LocalStorage)                │
│  - Supabase Auth Client SDK (Session Persistence & OAuth/Magic-Link)                     │
│  - Environment Resolver (appu-config.js via window.__APPU_API_BASE_URL__)                │
└───────────────────────────────┬───────────────────────────────┬──────────────────────────┘
                                │                               │
             HTTPS API Requests │            Upstream Auth      │
      (Authorization + CORS +   │            Verification       │
       Idempotency-Key Headers) │                               │
                                ▼                               ▼
┌───────────────────────────────────────────────┐     ┌────────────────────────────────────┐
│         BACKEND APPLICATION LAYER             │     │      SUPABASE AUTH SERVICE         │
│  - Fastify Node.js LTS Runtime                │────▶│  - JWT Verification & JWKS         │
│  - Strict Origin CORS & Structured Errors     │     │  - Auth User Identity              │
│  - Tenant-Scoped Security Boundary            │     └────────────────────────────────────┘
│  - AI & Voice Duration Quota Ledger           │
│  - Webhook HMAC-SHA256 Signature Verifier     │
└───────────────┬───────────────────────────────┘
                │
                ├───────────────────────────────────────────────┐
                ▼                                               ▼
┌───────────────────────────────────────────────┐     ┌────────────────────────────────────┐
│        DATABASE LAYER (PostgreSQL 15+)        │     │     THIRD-PARTY SECURE INTEGRATIONS│
│  - schema_migrations (SHA-256 Checksums)      │     │  - Razorpay Billing API & Webhooks │
│  - Multi-Tenant Row & Composite FK Invariants │     │  - Upstream n8n AI Workflow        │
│  - Advisory Locks & Atomic Ledgers            │     │  - ElevenLabs Voice Synthesis      │
└───────────────────────────────────────────────┘     └────────────────────────────────────┘
```

---

## 2. Prerequisites & Minimum Requirements

- **Node.js**: `v20.x` or `v22.x` LTS.
- **Package Manager**: `npm` `v10.x+`.
- **Database**: PostgreSQL `15+` with `gen_random_uuid()` / `pgcrypto` support and SSL enabled (`sslmode=require` or `sslmode=verify-full`).
- **Domain & SSL**: Valid FQDN for both frontend (e.g. `appu.example.com`) and backend (e.g. `api.example.com`) with valid TLS certificates (HTTPS).

---

## 3. Backend Deployment Settings (Hostinger / Managed Node.js)

When deploying to Hostinger Node.js or similar containerized hosting:

| Setting Key | Production Value | Purpose |
| :--- | :--- | :--- |
| **Application Directory / Root** | `backend` | Working directory for the Fastify server |
| **Node.js Version** | `20.x LTS` or `22.x LTS` | Execution runtime |
| **Install Command** | `npm install` | Installs dependencies |
| **Build Command** | `npm run build` | Compiles TypeScript (`src/` $\rightarrow$ `dist/`) |
| **Migration Command** | `npm run migrate` | Executes pending migrations with SHA-256 validation |
| **Start Command** | `npm start` | Launches compiled server (`node dist/server.js`) |

> [!IMPORTANT]
> Never use `npm run dev` or `tsx` in production. Always run the compiled artifact via `npm start`.

---

## 4. Environment-Variable Checklist

All environment variables must be configured in the host environment (or a securely mounted `.env` file).

### A. Deployment & Runtime Configuration

| Variable | Classification | Description & Example |
| :--- | :--- | :--- |
| `NODE_ENV` | **DEPLOYMENT CONFIG** | Must be set to `production`. Disables development routes like `/checkout-test.html`. |
| `PORT` | **DEPLOYMENT CONFIG** | Server port to bind to (e.g. `3000` or host-assigned `$PORT`). |
| `HOST` | **DEPLOYMENT CONFIG** | Must be `0.0.0.0` for hosted container/VM ingress. |
| `LOG_LEVEL` | **DEPLOYMENT CONFIG** | `info` or `warn`. (Do not use `debug` or `trace` in production). |
| `CORS_ALLOWED_ORIGINS` | **DEPLOYMENT CONFIG** | Comma-separated allowed frontend origins (e.g. `https://appu.example.com,https://www.appu.example.com`). |

### B. Database Configuration (Server Secrets)

| Variable | Classification | Description & Example |
| :--- | :--- | :--- |
| `DATABASE_URL` | **SERVER SECRET** | PostgreSQL connection string. Format: `postgresql://<user>:<password>@<host>:5432/<dbname>?sslmode=require`. |

### C. Supabase Authentication (Client-Safe Values)

| Variable | Classification | Description & Example |
| :--- | :--- | :--- |
| `SUPABASE_URL` | **PUBLIC / CLIENT SAFE** | Supabase project URL (e.g. `https://your-project-id.supabase.co`). |
| `SUPABASE_PUBLISHABLE_KEY` | **PUBLIC / CLIENT SAFE** | Supabase publishable/anon key used for server-side token validation. |

### D. Razorpay Subscriptions & Webhooks (Server Secrets)

| Variable | Classification | Description & Example |
| :--- | :--- | :--- |
| `RAZORPAY_KEY_ID` | **SERVER SECRET** | Razorpay Key ID (`rzp_test_*` or `rzp_live_*`). |
| `RAZORPAY_KEY_SECRET` | **SERVER SECRET** | Razorpay API Secret Key. |
| `RAZORPAY_WEBHOOK_SECRET` | **SERVER SECRET** | Secret configured in Razorpay Dashboard for webhook signature verification. |
| `RAZORPAY_PLAN_MAPPINGS` | **DEPLOYMENT CONFIG** | JSON string or key-value list mapping active plan codes to Razorpay provider plan IDs. Example: `{"starter":"plan_TSJanTDIfN52bS","growth":"plan_TSJc5uCxRAq20i","family":"plan_TSJcfr0znIDSHH"}`. |
| `RAZORPAY_PLAN_STARTER_ID`| **DEPLOYMENT CONFIG** | (Optional legacy fallback) Dashboard Plan ID for Starter tier. |
| `RAZORPAY_PLAN_GROWTH_ID` | **DEPLOYMENT CONFIG** | (Optional legacy fallback) Dashboard Plan ID for Growth tier. |
| `RAZORPAY_PLAN_FAMILY_ID` | **DEPLOYMENT CONFIG** | (Optional legacy fallback) Dashboard Plan ID for Family tier. |

### E. Upstream AI Secure Gateway (Server Secrets)

| Variable | Classification | Description & Example |
| :--- | :--- | :--- |
| `N8N_APPU_WEBHOOK_URL` | **SERVER SECRET** | Protected webhook URL to the upstream n8n AI workflow. |

---

## 5. Database Migration Procedure

The database uses transactional migrations with platform-normalized SHA-256 checksum tracking:

1. **Pre-Deployment Execution:**
   Before launching the new server version, run the migration runner:
   ```bash
   cd backend
   npm run migrate
   ```
2. **Safety & Invariants Enforced by Migrator:**
   - Acquires PostgreSQL session advisory lock `1095782485` to prevent concurrent migration race conditions.
   - Verifies that all historical migrations (`001` through `008`) match their stored SHA-256 checksums in `schema_migrations`.
   - If any past migration file has been tampered with, the runner aborts with `MigrationChecksumMismatchError` and applies zero changes.
   - Pending migrations execute in strict order inside individual atomic transactions.
3. **Plan Synchronization (Optional):**
   ```bash
   cd backend
   npm run plans:sync
   ```
   Synchronizes dashboard plan IDs to the `plans` table with verified idempotency.

---

## 6. Frontend Production API Configuration

The frontend [`appu-config.js`](file:///d:/office/Appu-landing-page/appu-config.js) dynamically resolves the backend API origin:

1. **Option A (HTML Header Injection - Recommended):**
   In `index.html` before scripts are loaded:
   ```html
   <script>
     window.__APPU_API_BASE_URL__ = 'https://api.yourdomain.com';
   </script>
   ```
2. **Option B (Static Placeholder Replacement):**
   Edit `appu-config.js` and set the fallback placeholder:
   ```javascript
   return 'https://api.yourdomain.com';
   ```
3. **Zero Secrets Invariant:**
   `appu-config.js` only exposes the public backend URL and public Supabase publishable key. No database passwords, webhook secrets, or Razorpay secret keys are present in frontend bundles.

---

## 7. CORS Configuration

Production uses strict origin validation:
- In `backend/.env`, set `CORS_ALLOWED_ORIGINS=https://appu.yourdomain.com,https://www.appu.yourdomain.com`.
- The Fastify backend validates incoming `Origin` headers against this whitelist.
- Preflight `OPTIONS` requests from unauthorized origins return `403 Forbidden`.
- Approved origins receive `Access-Control-Allow-Origin: <origin>` and `Vary: Origin`.
- Wildcard `Access-Control-Allow-Origin: *` is **never** emitted in production for authenticated endpoints.

---

## 8. Razorpay Webhook Cutover (Eliminating zrok)

In local development, `zrok` was used to tunnel local port 3000. In production:

1. Log in to the [Razorpay Dashboard](https://dashboard.razorpay.com/).
2. Navigate to **Settings** $\rightarrow$ **Webhooks** $\rightarrow$ **Add New Webhook**.
3. **Webhook URL**: `https://api.yourdomain.com/api/webhooks/razorpay`
4. **Secret**: Enter the exact secret string assigned to `RAZORPAY_WEBHOOK_SECRET`.
5. **Alert Email**: Enter system admin notification email.
6. **Active Events**:
   - `subscription.activated`
   - `subscription.charged`
   - `subscription.pending`
   - `subscription.halted`
   - `subscription.cancelled`
   - `subscription.completed`
7. Save the webhook.

---

## 9. Post-Deployment Smoke Tests

Execute these verification checks immediately following deployment:

### Test 1: Health & Readiness
```bash
curl -i https://api.yourdomain.com/health
# Expected: HTTP 200 OK -> {"status":"ok","timestamp":"..."}

curl -i https://api.yourdomain.com/ready
# Expected: HTTP 200 OK -> {"status":"ready","checks":{"database":"up"},"timestamp":"..."}
```

### Test 2: Development Route Suppression
```bash
curl -i https://api.yourdomain.com/checkout-test.html
# Expected: HTTP 404 Not Found -> {"error":{"code":"not_found","message":"Route not found"}}
```

### Test 3: CORS Preflight Verification
```bash
curl -i -X OPTIONS https://api.yourdomain.com/api/plans \
  -H "Origin: https://appu.yourdomain.com" \
  -H "Access-Control-Request-Method: GET"
# Expected: HTTP 204 No Content -> Access-Control-Allow-Origin: https://appu.yourdomain.com
```

### Test 4: Plans Listing
```bash
curl -i https://api.yourdomain.com/api/plans
# Expected: HTTP 200 OK -> List of Starter, Growth, Family plans
```

### Test 5: End-to-End Parent Flow (Browser)
1. Open `https://appu.yourdomain.com` in a browser.
2. Sign in via Parent Zone using Supabase Authentication.
3. Verify subscription plan details, learner list, and quota meters (`AI Sessions` and `Voice Minutes`).
4. Launch a child companion session and send a message.
5. Verify response delivers text and audio synthesis.

---

## 10. Rollback Procedure

If unexpected errors occur post-deployment:

1. **Application Rollback:**
   Revert the deployment artifact / container to the previous stable release commit and run `npm start`.
2. **Database Rollback Policy:**
   - All migrations are designed to be additive and non-destructive.
   - Do not drop tables or columns manually.
   - Restore database from snapshot if required, or apply a forward-fixing migration.
3. **Frontend Rollback:**
   Point CDN / static web host to the previous static asset bundle.

---

## 11. Test Mode $\rightarrow$ Live Payment Mode Cutover Checklist

> [!IMPORTANT]
> **BUSINESS NOTICE: CURRENT STARTER / GROWTH / FAMILY PRICES ARE TEST FIXTURES.**
> The current plan names (Starter, Growth, Family) and prices (₹299, ₹599, ₹999) are development test fixtures. Before LIVE launch, the approved HR plan catalogue must provide:
> 1. **Plan Code** (e.g. `starter`, `individual`, `school_pack`, etc.)
> 2. **Display Name** (e.g. `Starter Plan`, `Family Explorer Plan`)
> 3. **Price & Amount** in paise (e.g. ₹299 $\rightarrow$ `29900`)
> 4. **Currency** (e.g. `INR`)
> 5. **Billing Interval** (`monthly` or `yearly`)
> 6. **Learner Allowance** (`max_children`: 1, 2, 5, etc.)
> 7. **AI-Session Allowance** (`monthly_ai_sessions`: 100, 500, etc.)
> 8. **Voice Allowance** (`monthly_voice_minutes`: 30, 120, etc.)
> 9. **Feature Entitlements** (`multilingual`, `advanced_personalisation`, `parent_reports`, etc.)
> 10. **Public Description** for marketing & parent setup UI
> 11. **Razorpay Live Provider Plan ID** (`plan_live_*` created in Razorpay Live Dashboard)

> [!WARNING]
> DO NOT switch to Live Mode until all TEST Mode smoke tests are 100% successful.

When ready to accept real payments:
- [ ] In Razorpay Dashboard, generate **Live API Keys** (`rzp_live_*`).
- [ ] In Razorpay Dashboard, create Live Subscription Plans corresponding to the final HR catalogue.
- [ ] In `backend/.env`, update:
  - `RAZORPAY_KEY_ID=rzp_live_...`
  - `RAZORPAY_KEY_SECRET=...`
  - `RAZORPAY_WEBHOOK_SECRET=...`
  - `RAZORPAY_PLAN_MAPPINGS={"code1":"plan_live_1","code2":"plan_live_2",...}`
- [ ] Run `npm run plans:sync` to synchronize live plan IDs with the database.
- [ ] Create Live Webhook in Razorpay Dashboard pointing to `https://api.yourdomain.com/api/webhooks/razorpay`.
- [ ] Execute a live payment verification and confirm automated activation via webhook.

---

## 12. Legacy Fallback Removal Condition

The codebase currently contains a fallback mode: `LEGACY_PHASE1_DIRECT_N8N`.

**Condition for Removal:**
`LEGACY_PHASE1_DIRECT_N8N` must ONLY be removed after:
1. The production backend is live and answering `POST /api/appu/message` successfully.
2. The production frontend has been live for at least 7 days with zero auth gateway fallback events.
3. All registered learners are verified to route exclusively through the secure authenticated backend gateway.
