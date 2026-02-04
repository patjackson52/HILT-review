# HILT-Review Deployment Guide

This guide covers deploying HILT-Review using a portable, serverless-friendly stack with generous free tiers.

## Recommended Stack (Option A - Maximum Portability)

| Component | Service | Free Tier | Why |
|-----------|---------|-----------|-----|
| **Frontend** | Vercel | Unlimited sites, 100GB bandwidth | Best React/Next.js DX |
| **Backend** | Railway or Render | $5/month credit or 750 hrs | Standard containers, no lock-in |
| **Database** | Neon | 512MB, serverless | Standard Postgres, branching |
| **Auth** | Google OAuth | Free | Standard OAuth 2.0 |
| **Sessions** | Neon (table) or Upstash Redis | Free tier | Stateless JWT alternative |

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│    Vercel       │     │ Railway/Render  │     │      Neon       │
│   (Frontend)    │────▶│   (Backend)     │────▶│   (Postgres)    │
│   React SPA     │     │  Node/Python    │     │                 │
└─────────────────┘     └─────────────────┘     └─────────────────┘
         │                      │
         │                      ▼
         │              ┌─────────────────┐
         └─────────────▶│  Google OAuth   │
                        └─────────────────┘
```

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

```bash
# Install psql or use Neon's SQL Editor
psql "$DATABASE_URL" -f db/schema.sql
```

Or paste the schema from `hilt_review_postgres_schema.md` into Neon's SQL Editor.

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
   http://localhost:3000/auth/callback          (development)
   https://api.your-domain.com/auth/callback    (production)
   ```
5. Copy **Client ID** and **Client Secret**

### 2.4 Environment Variables

```bash
GOOGLE_CLIENT_ID=123456789.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-xxxxxxxxxxxx
OAUTH_REDIRECT_URI=https://api.your-domain.com/auth/callback

# Optional: Restrict to specific domains
ALLOWED_DOMAINS=["yourcompany.com"]
```

---

## 3. Backend Deployment

### Option 3A: Railway

#### 3A.1 Setup

1. Sign up at [railway.app](https://railway.app)
2. Create new project from GitHub repo
3. Railway auto-detects Node.js/Python

#### 3A.2 Configure

Add environment variables in Railway dashboard:

```bash
# Database
DATABASE_URL=postgresql://...@neon.tech/hilt_review?sslmode=require

# Google OAuth
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
OAUTH_REDIRECT_URI=https://your-app.railway.app/auth/callback

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
| Environment | Node / Python |
| Build Command | `npm install && npm run build` |
| Start Command | `npm start` |
| Instance Type | Free (750 hours/month) |

Add environment variables (same as Railway).

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
NEXT_PUBLIC_API_URL=https://api.your-domain.com
NEXT_PUBLIC_GOOGLE_CLIENT_ID=123456789.apps.googleusercontent.com
```

### 4.3 Build Settings

| Setting | Value |
|---------|-------|
| Framework | Next.js (or Create React App) |
| Build Command | `npm run build` |
| Output Directory | `.next` (or `build`) |

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
OAUTH_REDIRECT_URI=https://api.hilt-review.com/auth/callback

# Session
SESSION_SECRET=64-random-hex-characters-here-generate-with-openssl-rand

# Optional: Domain restriction
ALLOWED_DOMAINS=["yourcompany.com"]

# App
PORT=3000
NODE_ENV=production
CORS_ORIGIN=https://hilt-review.com
```

### Frontend (.env.local)

```bash
NEXT_PUBLIC_API_URL=https://api.hilt-review.com
NEXT_PUBLIC_GOOGLE_CLIENT_ID=123456789.apps.googleusercontent.com
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
node >= 18
npm >= 9
docker (optional, for local Postgres)
```

### Setup

```bash
# Clone repo
git clone https://github.com/patjackson52/HILT-review.git
cd HILT-review

# Backend
cd backend
cp .env.example .env
npm install
npm run dev

# Frontend (new terminal)
cd frontend
cp .env.example .env.local
npm install
npm run dev
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
