# HILT-Review Deployment Guide

This guide covers deploying HILT-Review using a portable, serverless-friendly stack with generous free tiers.

## Recommended Stack (Option A - Maximum Portability)

| Component | Service | Free Tier | Why |
|-----------|---------|-----------|-----|
| **Frontend** | Vercel | Unlimited sites, 100GB bandwidth | Best React DX |
| **Backend** | Railway or Render | $5/month credit or 750 hrs | Node.js containers |
| **Database** | Neon | 512MB, serverless | Standard Postgres + pg-boss |
| **Auth** | Google OAuth | Free | Standard OAuth 2.0 |
| **Sessions** | Postgres (via Fastify session) | Included | No Redis needed |

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│    Vercel       │     │ Railway/Render  │     │      Neon       │
│   (Frontend)    │────▶│   (Backend)     │────▶│   (Postgres)    │
│  React + Vite   │     │ Node.js/Fastify │     │ + pg-boss queue │
└─────────────────┘     └─────────────────┘     └─────────────────┘
         │                      │
         │                      ▼
         │              ┌─────────────────┐
         └─────────────▶│  Google OAuth   │
                        └─────────────────┘
```

**Tech Stack:**
- Backend: Node.js 20 + Fastify + TypeScript
- Frontend: React + Vite + TypeScript
- Database: PostgreSQL 15 (via Drizzle ORM)
- Queue: pg-boss (Postgres-backed, no Redis needed)

---

## 1. Database Setup (Neon)

### 1.1 Create Neon Project

1. Sign up at [neon.tech](https://neon.tech)
2. Create a new project (e.g., `hilt-review`)
3. Select region closest to your users
4. Copy the connection string:
   ```
   postgresql://user:password@ep-xxx.us-east-1.aws.neon.tech/hilt_review?sslmode=require
   ```

### 1.2 Apply Database Schema

**Option A: Using Drizzle migrations (recommended)**
```bash
cd backend
npm run db:migrate
```

**Option B: Direct SQL**
```bash
# Using psql
psql "$DATABASE_URL" -f db/schema.sql

# Or paste the schema from hilt_review_postgres_schema.md into Neon's SQL Editor
```

### 1.3 Environment Variables

```bash
DATABASE_URL=postgresql://user:password@ep-xxx.aws.neon.tech/hilt_review?sslmode=require
```

**Neon Features:**
- **Branching**: Create DB branches for development/testing
- **Autoscaling**: Scales to zero when idle (saves free tier)
- **Connection pooling**: Built-in, use `?pgbouncer=true` for serverless

---

## 2. Google OAuth Setup

### 2.1 Create Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create new project: `hilt-review`
3. Enable **Google+ API** (for profile info)

### 2.2 Configure OAuth Consent Screen

1. Navigate to **APIs & Services > OAuth consent screen**
2. Choose **External** (or Internal for Workspace)
3. Fill in:
   - App name: `HILT-Review`
   - User support email: your email
   - Authorized domains: `your-domain.com` (add later)
4. Add scopes: `email`, `profile`, `openid`

### 2.3 Create OAuth Credentials

1. Navigate to **APIs & Services > Credentials**
2. Click **Create Credentials > OAuth 2.0 Client IDs**
3. Application type: **Web application**
4. Add authorized redirect URIs:
   ```
   http://localhost:3000/api/v1/auth/google/callback          (development)
   https://api.your-domain.com/api/v1/auth/google/callback    (production)
   ```
5. Copy **Client ID** and **Client Secret**

### 2.4 Environment Variables

```bash
GOOGLE_CLIENT_ID=123456789.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-xxxxxxxxxxxx
OAUTH_REDIRECT_URI=https://api.your-domain.com/api/v1/auth/google/callback

# Optional: Restrict to specific domains
ALLOWED_DOMAINS=["yourcompany.com"]
```

---

## 3. Backend Deployment

### Option 3A: Railway

#### 3A.1 Setup

1. Sign up at [railway.app](https://railway.app)
2. Create new project from GitHub repo
3. Set root directory to `backend/`
4. Railway auto-detects Node.js

#### 3A.2 Configure

Add environment variables in Railway dashboard:

```bash
# Database
DATABASE_URL=postgresql://...@neon.tech/hilt_review?sslmode=require

# Google OAuth
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
OAUTH_REDIRECT_URI=https://your-app.railway.app/api/v1/auth/google/callback

# Session
SESSION_SECRET=<generate-64-byte-hex>

# App
PORT=3000
NODE_ENV=production
```

#### 3A.3 Deploy

```bash
# Railway CLI (optional)
npm install -g @railway/cli
railway login
railway link
railway up
```

Or just push to GitHub - Railway auto-deploys.

#### 3A.4 Custom Domain

1. Go to **Settings > Domains**
2. Add custom domain: `api.your-domain.com`
3. Update DNS with provided CNAME

---

### Option 3B: Render

#### 3B.1 Setup

1. Sign up at [render.com](https://render.com)
2. Create **New Web Service**
3. Connect GitHub repo

#### 3B.2 Configure

| Setting | Value |
|---------|-------|
| Root Directory | `backend` |
| Environment | Node |
| Build Command | `npm ci && npm run build` |
| Start Command | `npm start` |
| Instance Type | Free (750 hours/month) |

Add environment variables (same as Railway).

**Note:** The backend uses Fastify and will listen on the `PORT` environment variable provided by Render.

#### 3B.3 Deploy

Render auto-deploys on git push.

#### 3B.4 Custom Domain

1. Go to **Settings > Custom Domains**
2. Add `api.your-domain.com`
3. Configure DNS per instructions

---

## 4. Frontend Deployment (Vercel)

### 4.1 Setup

1. Sign up at [vercel.com](https://vercel.com)
2. Import project from GitHub
3. Select `frontend/` as root directory (if monorepo)

### 4.2 Configure

Add environment variables:

```bash
# Required: URL of the Render backend (used by vercel.json rewrites to proxy /api/* requests)
BACKEND_URL=https://your-render-app.onrender.com
```

The `vercel.json` at the repo root rewrites `/api/*` requests to `$BACKEND_URL/api/*`, keeping all traffic same-origin. This is required for session cookies to work correctly.

### 4.3 Build Settings

| Setting | Value |
|---------|-------|
| Framework | Vite |
| Build Command | `npm run build` |
| Output Directory | `dist` |

### 4.4 Deploy

```bash
# Vercel CLI (optional)
npm install -g vercel
vercel login
vercel --prod
```

Or push to GitHub - Vercel auto-deploys.

### 4.5 Custom Domain

1. Go to **Settings > Domains**
2. Add `hilt-review.your-domain.com`
3. Configure DNS (A record or CNAME)

---

## 5. Environment Variables Summary

### Backend (.env)

```bash
# Database
DATABASE_URL=postgresql://user:pass@ep-xxx.neon.tech/hilt_review?sslmode=require

# Google OAuth
GOOGLE_CLIENT_ID=123456789.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-xxxxxxxxxxxx
OAUTH_REDIRECT_URI=https://api.hilt-review.com/api/v1/auth/google/callback

# Session
SESSION_SECRET=64-random-hex-characters-here-generate-with-openssl-rand

# Optional: Domain restriction
ALLOWED_DOMAINS=["yourcompany.com"]

# App
PORT=3000
NODE_ENV=production
CORS_ORIGIN=https://hilt-review.com
```

### Frontend (Vercel Environment Variables)

```bash
# Required: Render backend URL for API proxy rewrites (used by vercel.json)
BACKEND_URL=https://api.hilt-review.com
```

### Generate Secrets

```bash
# Generate SESSION_SECRET
openssl rand -hex 32

# Generate API key encryption key
openssl rand -hex 32
```

---

## 6. DNS Configuration

| Record | Type | Name | Value |
|--------|------|------|-------|
| Frontend | CNAME | `hilt-review` | `cname.vercel-dns.com` |
| Backend | CNAME | `api.hilt-review` | `your-app.railway.app` |

---

## 7. Post-Deployment Checklist

### Security

- [ ] Update Google OAuth redirect URIs with production URLs
- [ ] Set `ALLOWED_DOMAINS` if restricting to organization
- [ ] Enable HTTPS (automatic on Vercel/Railway/Render)
- [ ] Set secure cookie flags in production

### Verification

- [ ] Test Google OAuth login flow
- [ ] Create a test source via API
- [ ] Submit a test review task
- [ ] Verify webhook delivery (use webhook.site for testing)

### Monitoring (Optional)

| Service | Free Tier | Purpose |
|---------|-----------|---------|
| [Sentry](https://sentry.io) | 5K errors/month | Error tracking |
| [Logflare](https://logflare.app) | 5M events/month | Logging |
| [Checkly](https://www.checklyhq.com) | 5 checks | Uptime monitoring |

---

## 8. Local Development

### Prerequisites

```bash
node >= 20 LTS
npm >= 10
docker (optional, for local Postgres)
```

### Setup (Monorepo)

```bash
# Clone repo
git clone https://github.com/patjackson52/HILT-review.git
cd HILT-review

# Install all dependencies (uses npm workspaces)
npm install

# Set up environment files
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env.local

# Start local Postgres (if using Docker)
docker-compose up -d postgres

# Run database migrations
npm run db:migrate

# Start all services (backend on :3000, frontend on :5173)
npm run dev
```

### Individual Services

```bash
# Backend only (with hot reload via tsx)
cd backend && npm run dev

# Frontend only (Vite dev server)
cd frontend && npm run dev

# Run tests
npm run test

# Type checking
npm run typecheck
```

### Local Database Options

**Option A: Neon (recommended)**
- Use Neon's branching for dev database
- Same connection string, different branch

**Option B: Docker**
```bash
docker run -d \
  --name hilt-postgres \
  -e POSTGRES_DB=hilt_review \
  -e POSTGRES_USER=hilt \
  -e POSTGRES_PASSWORD=localdev \
  -p 5432:5432 \
  postgres:15

# Connection string
DATABASE_URL=postgresql://hilt:localdev@localhost:5432/hilt_review
```

---

## 9. Cost Estimate

### Free Tier Limits

| Service | Free Tier | Estimated Usage | Cost |
|---------|-----------|-----------------|------|
| Vercel | 100GB bandwidth | ~10GB/month | $0 |
| Railway | $5 credit/month | ~$3-4/month | $0 |
| Neon | 512MB storage | ~100MB | $0 |
| Google OAuth | Unlimited | N/A | $0 |
| **Total** | | | **$0/month** |

### Scaling Beyond Free Tier

| Service | Paid Pricing | When Needed |
|---------|--------------|-------------|
| Vercel Pro | $20/month | >100GB bandwidth |
| Railway | $5+/month | >$5 usage |
| Neon Pro | $19/month | >512MB or high traffic |

---

## 10. Migration Path

This stack is fully portable:

| From | To | Effort |
|------|-----|--------|
| Railway | Render | Low - same container |
| Railway | AWS ECS | Medium - add Dockerfile |
| Neon | AWS RDS | Low - pg_dump/restore |
| Neon | Supabase | Low - pg_dump/restore |
| Vercel | Netlify | Low - same build |
| Vercel | Cloudflare Pages | Low - same build |

### Export Data

```bash
# Export from Neon
pg_dump "$NEON_DATABASE_URL" > backup.sql

# Import to new database
psql "$NEW_DATABASE_URL" < backup.sql
```

---

## 11. CI/CD Pipeline

This section covers automated testing and deployment using GitHub Actions.

### Pipeline Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              GitHub Actions                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Push to feature branch          Push to main              Manual trigger   │
│          │                            │                          │          │
│          ▼                            ▼                          ▼          │
│  ┌───────────────┐           ┌───────────────┐          ┌───────────────┐  │
│  │  CI: Lint +   │           │  CI: Lint +   │          │   Deploy to   │  │
│  │  Test + Build │           │  Test + Build │          │  Production   │  │
│  └───────┬───────┘           └───────┬───────┘          └───────────────┘  │
│          │                            │                                     │
│          ▼                            ▼                                     │
│  ┌───────────────┐           ┌───────────────┐                             │
│  │    Preview    │           │   Deploy to   │                             │
│  │  Deployment   │           │    Staging    │                             │
│  │   (Vercel)    │           │               │                             │
│  └───────────────┘           └───────┬───────┘                             │
│                                      │                                      │
│                                      ▼                                      │
│                              ┌───────────────┐                             │
│                              │   E2E Tests   │                             │
│                              │  on Staging   │                             │
│                              └───────┬───────┘                             │
│                                      │ (on success)                        │
│                                      ▼                                      │
│                              ┌───────────────┐                             │
│                              │   Deploy to   │                             │
│                              │  Production   │                             │
│                              └───────────────┘                             │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 11.1 GitHub Actions Workflows

Create `.github/workflows/` directory with these files:

#### CI Workflow (ci.yml)

```yaml
# .github/workflows/ci.yml
name: CI

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]

env:
  NODE_VERSION: '20'

jobs:
  lint:
    name: Lint
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'
      - run: npm ci
      - run: npm run lint
      - run: npm run typecheck

  unit-tests:
    name: Unit Tests
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'
      - run: npm ci
      - run: npm run test:unit -- --coverage
      - uses: codecov/codecov-action@v4
        with:
          files: ./coverage/lcov.info
          fail_ci_if_error: false

  integration-tests:
    name: Integration Tests
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_DB: hilt_review_test
          POSTGRES_USER: test
          POSTGRES_PASSWORD: test
        ports:
          - 5432:5432
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'
      - run: npm ci
      - run: npm run db:migrate
        env:
          DATABASE_URL: postgresql://test:test@localhost:5432/hilt_review_test
      - run: npm run test:integration
        env:
          DATABASE_URL: postgresql://test:test@localhost:5432/hilt_review_test

  build:
    name: Build
    runs-on: ubuntu-latest
    needs: [lint, unit-tests]
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'
      - run: npm ci
      - run: npm run build
      - uses: actions/upload-artifact@v4
        with:
          name: build-artifacts
          path: |
            backend/dist
            frontend/dist
          retention-days: 7
```

#### Deploy Staging Workflow (deploy-staging.yml)

```yaml
# .github/workflows/deploy-staging.yml
name: Deploy Staging

on:
  push:
    branches: [main]
  workflow_dispatch:

env:
  NODE_VERSION: '20'

jobs:
  ci:
    uses: ./.github/workflows/ci.yml

  deploy-backend-staging:
    name: Deploy Backend to Staging
    needs: ci
    runs-on: ubuntu-latest
    environment:
      name: staging
      url: https://api-staging.hilt-review.com
    steps:
      - uses: actions/checkout@v4

      # Option A: Railway
      - name: Deploy to Railway
        uses: bervProject/railway-deploy@main
        with:
          railway_token: ${{ secrets.RAILWAY_TOKEN }}
          service: hilt-review-backend-staging

      # Option B: Render (alternative)
      # - name: Deploy to Render
      #   run: |
      #     curl -X POST ${{ secrets.RENDER_DEPLOY_HOOK_STAGING }}

  deploy-frontend-staging:
    name: Deploy Frontend to Staging
    needs: ci
    runs-on: ubuntu-latest
    environment:
      name: staging
      url: https://staging.hilt-review.com
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'
      - run: npm ci
      - run: npm run build --workspace=frontend
        env:
          VITE_API_URL: https://api-staging.hilt-review.com
      - uses: amondnet/vercel-action@v25
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
          vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}
          vercel-args: '--prod'
          alias-domains: staging.hilt-review.com

  e2e-tests:
    name: E2E Tests on Staging
    needs: [deploy-backend-staging, deploy-frontend-staging]
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'
      - run: npm ci
      - run: npx playwright install --with-deps
      - run: npm run test:e2e
        env:
          BASE_URL: https://staging.hilt-review.com
          API_URL: https://api-staging.hilt-review.com
      - uses: actions/upload-artifact@v4
        if: failure()
        with:
          name: playwright-report
          path: playwright-report/
          retention-days: 7

  notify-staging-ready:
    name: Notify Staging Ready
    needs: e2e-tests
    runs-on: ubuntu-latest
    steps:
      - name: Slack Notification
        uses: slackapi/slack-github-action@v1
        with:
          payload: |
            {
              "text": "✅ Staging deployment successful",
              "blocks": [
                {
                  "type": "section",
                  "text": {
                    "type": "mrkdwn",
                    "text": "*Staging Ready*\n• Frontend: https://staging.hilt-review.com\n• Backend: https://api-staging.hilt-review.com\n• Commit: ${{ github.sha }}"
                  }
                }
              ]
            }
        env:
          SLACK_WEBHOOK_URL: ${{ secrets.SLACK_WEBHOOK_URL }}
        continue-on-error: true
```

#### Deploy Production Workflow (deploy-production.yml)

```yaml
# .github/workflows/deploy-production.yml
name: Deploy Production

on:
  workflow_dispatch:
    inputs:
      confirm:
        description: 'Type "deploy" to confirm production deployment'
        required: true
      skip_staging_check:
        description: 'Skip staging E2E check (emergency only)'
        type: boolean
        default: false

env:
  NODE_VERSION: '20'

jobs:
  validate:
    name: Validate Deployment
    runs-on: ubuntu-latest
    steps:
      - name: Confirm deployment
        if: ${{ github.event.inputs.confirm != 'deploy' }}
        run: |
          echo "❌ Deployment not confirmed. Please type 'deploy' to confirm."
          exit 1

      - name: Check staging E2E status
        if: ${{ !github.event.inputs.skip_staging_check }}
        run: |
          # Check that staging E2E passed for this commit
          gh run list --workflow=deploy-staging.yml --json conclusion,headSha \
            | jq -e '.[] | select(.headSha == "${{ github.sha }}" and .conclusion == "success")' \
            || (echo "❌ Staging E2E must pass before production deploy" && exit 1)
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}

  deploy-backend-production:
    name: Deploy Backend to Production
    needs: validate
    runs-on: ubuntu-latest
    environment:
      name: production
      url: https://api.hilt-review.com
    steps:
      - uses: actions/checkout@v4

      - name: Deploy to Railway
        uses: bervProject/railway-deploy@main
        with:
          railway_token: ${{ secrets.RAILWAY_TOKEN }}
          service: hilt-review-backend-production

  deploy-frontend-production:
    name: Deploy Frontend to Production
    needs: validate
    runs-on: ubuntu-latest
    environment:
      name: production
      url: https://hilt-review.com
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'
      - run: npm ci
      - run: npm run build --workspace=frontend
        env:
          VITE_API_URL: https://api.hilt-review.com
      - uses: amondnet/vercel-action@v25
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
          vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}
          vercel-args: '--prod'
          alias-domains: hilt-review.com

  run-db-migrations:
    name: Run Database Migrations
    needs: [deploy-backend-production]
    runs-on: ubuntu-latest
    environment: production
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'
      - run: npm ci --workspace=backend
      - run: npm run db:migrate --workspace=backend
        env:
          DATABASE_URL: ${{ secrets.DATABASE_URL }}

  smoke-tests:
    name: Production Smoke Tests
    needs: [deploy-backend-production, deploy-frontend-production]
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Health check - Backend
        run: |
          for i in {1..5}; do
            curl -f https://api.hilt-review.com/health && exit 0
            sleep 10
          done
          exit 1
      - name: Health check - Frontend
        run: curl -f https://hilt-review.com
      - name: API sanity check
        run: |
          curl -f https://api.hilt-review.com/health/db

  notify-production:
    name: Notify Production Deploy
    needs: smoke-tests
    runs-on: ubuntu-latest
    steps:
      - name: Slack Notification
        uses: slackapi/slack-github-action@v1
        with:
          payload: |
            {
              "text": "🚀 Production deployment successful",
              "blocks": [
                {
                  "type": "section",
                  "text": {
                    "type": "mrkdwn",
                    "text": "*Production Deployed*\n• Frontend: https://hilt-review.com\n• Backend: https://api.hilt-review.com\n• Commit: ${{ github.sha }}\n• Deployed by: ${{ github.actor }}"
                  }
                }
              ]
            }
        env:
          SLACK_WEBHOOK_URL: ${{ secrets.SLACK_WEBHOOK_URL }}
        continue-on-error: true
```

#### Preview Deployments (preview.yml)

```yaml
# .github/workflows/preview.yml
name: Preview Deployment

on:
  pull_request:
    types: [opened, synchronize, reopened]

env:
  NODE_VERSION: '20'

jobs:
  preview:
    name: Deploy Preview
    runs-on: ubuntu-latest
    permissions:
      pull-requests: write
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'
      - run: npm ci
      - run: npm run build --workspace=frontend
        env:
          VITE_API_URL: https://api-staging.hilt-review.com

      - name: Deploy to Vercel Preview
        id: vercel
        uses: amondnet/vercel-action@v25
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
          vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}

      - name: Comment PR
        uses: actions/github-script@v7
        with:
          script: |
            github.rest.issues.createComment({
              issue_number: context.issue.number,
              owner: context.repo.owner,
              repo: context.repo.repo,
              body: `## 🔍 Preview Deployment Ready

              | Environment | URL |
              |-------------|-----|
              | Frontend Preview | ${{ steps.vercel.outputs.preview-url }} |
              | Backend (Staging) | https://api-staging.hilt-review.com |

              > Preview uses staging backend. Test data only.`
            })
```

### 11.2 Environment Configuration

#### GitHub Environments

Set up these environments in **Settings > Environments**:

| Environment | Protection Rules | Secrets |
|-------------|-----------------|---------|
| `staging` | None | All deploy secrets |
| `production` | Required reviewers, wait timer | All deploy secrets |

#### Required Secrets

```bash
# Vercel
VERCEL_TOKEN=xxx
VERCEL_ORG_ID=xxx
VERCEL_PROJECT_ID=xxx

# Railway (or Render)
RAILWAY_TOKEN=xxx
# RENDER_DEPLOY_HOOK_STAGING=https://api.render.com/deploy/...
# RENDER_DEPLOY_HOOK_PRODUCTION=https://api.render.com/deploy/...

# Database (for migrations)
DATABASE_URL=postgresql://...

# Notifications (optional)
SLACK_WEBHOOK_URL=https://hooks.slack.com/...
```

### 11.3 Database Migrations in CI/CD

#### Migration Safety

```yaml
# Migrations run AFTER backend deploy but BEFORE traffic switches
# This ensures backward-compatible migrations

# Migration checklist:
# ✅ New columns must have defaults or be nullable
# ✅ Dropping columns: remove code first, drop column next release
# ✅ Renaming: add new column, migrate data, remove old column
```

#### Migration Script

```json
// package.json
{
  "scripts": {
    "db:migrate": "drizzle-kit push:pg",
    "db:migrate:check": "drizzle-kit check:pg",
    "db:generate": "drizzle-kit generate:pg"
  }
}
```

### 11.4 Rollback Procedures

#### Automatic Rollback (Railway)

Railway keeps previous deployments. To rollback:

1. Go to Railway dashboard
2. Select the service
3. Go to **Deployments**
4. Click **Rollback** on a previous deployment

#### Manual Rollback Workflow

```yaml
# .github/workflows/rollback.yml
name: Rollback

on:
  workflow_dispatch:
    inputs:
      environment:
        description: 'Environment to rollback'
        required: true
        type: choice
        options:
          - staging
          - production
      commit_sha:
        description: 'Commit SHA to rollback to'
        required: true

jobs:
  rollback:
    runs-on: ubuntu-latest
    environment: ${{ github.event.inputs.environment }}
    steps:
      - uses: actions/checkout@v4
        with:
          ref: ${{ github.event.inputs.commit_sha }}

      - name: Deploy rollback
        run: |
          echo "Rolling back ${{ github.event.inputs.environment }} to ${{ github.event.inputs.commit_sha }}"
          # Trigger deployment with specific commit
```

#### Database Rollback

```bash
# Drizzle doesn't have automatic rollback
# For emergencies, restore from backup:

# 1. Get backup from Neon (point-in-time recovery)
neonctl branches create --name rollback-$(date +%s) --parent main --point-in-time "2024-01-15T10:00:00Z"

# 2. Update DATABASE_URL to point to rollback branch

# 3. Test and verify

# 4. If good, promote rollback branch to main
```

### 11.5 Deployment Checklist

#### Pre-Production Deploy

- [ ] All CI checks passing
- [ ] E2E tests passed on staging
- [ ] Database migrations are backward-compatible
- [ ] Feature flags configured (if applicable)
- [ ] Monitoring alerts configured

#### Post-Production Deploy

- [ ] Smoke tests passing
- [ ] Check error rates in monitoring
- [ ] Verify key user flows work
- [ ] Check database performance metrics
- [ ] Update status page (if applicable)

### 11.6 Vercel + Railway Integration

Both services support automatic deployments from GitHub, but for coordinated deploys:

```
┌─────────────────────────────────────────────────────────────┐
│                    Deployment Flow                          │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  1. GitHub Actions runs CI                                  │
│          │                                                  │
│          ▼                                                  │
│  2. Deploy Backend (Railway)                                │
│     - Railway webhook or CLI                                │
│     - Wait for health check                                 │
│          │                                                  │
│          ▼                                                  │
│  3. Run Database Migrations                                 │
│     - drizzle-kit push                                      │
│     - Backward-compatible only                              │
│          │                                                  │
│          ▼                                                  │
│  4. Deploy Frontend (Vercel)                                │
│     - Vercel CLI or Action                                  │
│     - Atomic deploy (no downtime)                           │
│          │                                                  │
│          ▼                                                  │
│  5. Smoke Tests                                             │
│     - Health endpoints                                      │
│     - Critical path tests                                   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 11.7 Monitoring Deployments

#### Health Endpoints

```typescript
// backend/src/routes/health.ts
app.get('/health', async () => {
  return { status: 'ok', version: process.env.GIT_SHA };
});

app.get('/health/db', async () => {
  const result = await db.execute(sql`SELECT 1`);
  return { status: 'ok', db: 'connected' };
});

app.get('/health/ready', async () => {
  // Check all dependencies
  const checks = await Promise.all([
    checkDatabase(),
    checkPgBoss(),
  ]);

  const healthy = checks.every(c => c.ok);
  return {
    status: healthy ? 'ok' : 'degraded',
    checks
  };
});
```

#### Deployment Tracking

```typescript
// Log deployment info on startup
console.log(JSON.stringify({
  event: 'deployment_started',
  version: process.env.GIT_SHA,
  environment: process.env.NODE_ENV,
  timestamp: new Date().toISOString(),
}));
```

---

## Troubleshooting

### Common Issues

| Issue | Solution |
|-------|----------|
| OAuth redirect mismatch | Verify redirect URI matches exactly in Google Console |
| Database connection timeout | Use connection pooling (`?pgbouncer=true` for Neon) |
| CORS errors | Add frontend domain to `CORS_ORIGIN` |
| Session not persisting | Check `SESSION_SECRET` is set, cookies are secure |

### Health Check Endpoints

```bash
# Backend health
curl https://api.hilt-review.com/health

# Database connectivity
curl https://api.hilt-review.com/health/db
```
