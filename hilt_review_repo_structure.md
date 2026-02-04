# HILT-Review — Repository Structure

This document defines the implementation-ready repository layout for HILT-Review using the chosen tech stack:

| Layer | Technology |
|-------|------------|
| **Backend** | Node.js 20 + Fastify + TypeScript |
| **Frontend** | React + TypeScript |
| **Database** | PostgreSQL 15+ with Drizzle ORM |
| **Queue** | pg-boss (Postgres-backed) |

---

## Top-Level Layout

```
hilt-review/
├── README.md
├── LICENSE
├── package.json                    # Workspace root (npm workspaces)
├── turbo.json                      # Turborepo config (optional)
│
├── docs/
│   ├── PRD.md
│   ├── Frontend-Spec.md
│   ├── Upstream-Agent-Integration.md
│   ├── Downstream-Executor-Integration.md
│   ├── backend-spec.md
│   └── deployment-guide.md
│
├── openapi/
│   └── hilt-review-openapi.yaml
│
├── packages/
│   └── shared/                     # Shared types between frontend/backend
│       ├── src/
│       │   └── types.ts
│       ├── package.json
│       └── tsconfig.json
│
├── backend/
│   ├── src/
│   │   ├── index.ts               # Entry point
│   │   ├── app.ts                 # Fastify app setup
│   │   ├── config/
│   │   │   └── index.ts           # Environment config (Zod validated)
│   │   ├── routes/
│   │   │   ├── index.ts           # Route registration
│   │   │   ├── sources.ts
│   │   │   ├── review-tasks.ts
│   │   │   ├── decision-events.ts
│   │   │   └── auth.ts
│   │   ├── services/
│   │   │   ├── review-task.service.ts
│   │   │   ├── source.service.ts
│   │   │   ├── decision.service.ts
│   │   │   ├── diff.service.ts
│   │   │   └── webhook.service.ts
│   │   ├── domain/
│   │   │   ├── types.ts           # Core domain types
│   │   │   ├── errors.ts          # Custom error classes
│   │   │   └── schemas.ts         # Zod schemas
│   │   ├── db/
│   │   │   ├── index.ts           # Drizzle connection
│   │   │   ├── schema.ts          # Drizzle table definitions
│   │   │   └── queries/
│   │   │       ├── review-tasks.ts
│   │   │       ├── sources.ts
│   │   │       └── decision-events.ts
│   │   ├── workers/
│   │   │   ├── index.ts           # pg-boss setup
│   │   │   ├── decision-dispatcher.ts
│   │   │   └── archiver.ts
│   │   ├── middleware/
│   │   │   ├── auth.ts            # API key & session auth
│   │   │   ├── rate-limit.ts
│   │   │   └── error-handler.ts
│   │   └── utils/
│   │       ├── crypto.ts          # HMAC, hashing
│   │       ├── idempotency.ts
│   │       └── pagination.ts
│   ├── drizzle/
│   │   └── migrations/            # SQL migrations
│   ├── tests/
│   │   ├── unit/
│   │   ├── integration/
│   │   └── fixtures/
│   ├── package.json
│   ├── tsconfig.json
│   ├── drizzle.config.ts
│   └── Dockerfile
│
├── frontend/
│   ├── src/
│   │   ├── main.tsx               # React entry
│   │   ├── App.tsx
│   │   ├── pages/
│   │   │   ├── ReviewQueue.tsx
│   │   │   ├── ReviewTask.tsx
│   │   │   └── Archive.tsx
│   │   ├── components/
│   │   │   ├── ArtifactBlockRenderer.tsx
│   │   │   ├── MarkdownEditor.tsx
│   │   │   ├── JsonEditor.tsx
│   │   │   ├── DiffViewer.tsx
│   │   │   └── DecisionControls.tsx
│   │   ├── hooks/
│   │   │   ├── useReviewTasks.ts
│   │   │   └── useAuth.ts
│   │   ├── api/
│   │   │   └── client.ts          # API client (fetch wrapper)
│   │   └── utils/
│   ├── tests/
│   ├── public/
│   ├── index.html
│   ├── package.json
│   ├── tsconfig.json
│   ├── vite.config.ts
│   └── Dockerfile
│
├── scripts/
│   ├── dev-up.sh                  # Start all services
│   ├── dev-down.sh                # Stop all services
│   ├── db-migrate.sh              # Run migrations
│   ├── db-seed.sh                 # Seed dev data
│   └── generate-types.sh          # OpenAPI → TypeScript
│
└── docker-compose.yml             # Local dev environment
```

---

## File Mapping to Existing Artifacts

| Artifact | Repo Location |
|--------|---------------|
| PRD | `docs/PRD.md` |
| Frontend Spec | `docs/Frontend-Spec.md` |
| Upstream Guide | `docs/Upstream-Agent-Integration.md` |
| Downstream Guide | `docs/Downstream-Executor-Integration.md` |
| OpenAPI Spec | `openapi/hilt-review-openapi.yaml` |
| Postgres Schema | `db/schema.sql` |

---

## Key Design Notes

### Backend (Node.js + Fastify + TypeScript)

| Directory | Purpose |
|-----------|---------|
| `routes/` | HTTP route handlers (thin, delegate to services) |
| `services/` | Business logic (diffing, validation, state transitions) |
| `domain/` | Core types, Zod schemas, custom errors |
| `db/` | Drizzle schema and type-safe queries |
| `workers/` | pg-boss background jobs (webhook dispatch, archiver) |
| `middleware/` | Auth, rate limiting, error handling |

**Key Patterns:**
- Routes are thin — validate input, call service, return response
- Services contain business logic — no HTTP concerns
- Drizzle provides type-safe SQL queries aligned with OpenAPI types
- pg-boss uses the same Postgres instance — no separate Redis

### Frontend (React + TypeScript)

| Directory | Purpose |
|-----------|---------|
| `pages/` | Route-level components (ReviewQueue, ReviewTask, Archive) |
| `components/` | Reusable UI (editors, diff viewer, decision controls) |
| `hooks/` | Custom hooks for data fetching and state |
| `api/` | API client wrapping fetch with types |

**Key Patterns:**
- Components are presentational — hooks manage data
- API types generated from OpenAPI spec
- Vite for fast development and optimized builds

### Shared Types

The `packages/shared/` directory contains types used by both frontend and backend:
- Generated from OpenAPI spec using `openapi-typescript`
- Ensures type alignment across the stack

---

## Docker Compose (Local Development)

```yaml
# docker-compose.yml
version: '3.8'

services:
  postgres:
    image: postgres:15
    environment:
      POSTGRES_DB: hilt_review
      POSTGRES_USER: hilt
      POSTGRES_PASSWORD: localdev
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

  backend:
    build: ./backend
    ports:
      - "3000:3000"
    environment:
      DATABASE_URL: postgresql://hilt:localdev@postgres:5432/hilt_review
      SESSION_SECRET: dev-session-secret-min-32-chars-long
      GOOGLE_CLIENT_ID: ${GOOGLE_CLIENT_ID}
      GOOGLE_CLIENT_SECRET: ${GOOGLE_CLIENT_SECRET}
      OAUTH_REDIRECT_URI: http://localhost:3000/auth/callback
    depends_on:
      - postgres

  frontend:
    build: ./frontend
    ports:
      - "5173:5173"
    environment:
      VITE_API_URL: http://localhost:3000

volumes:
  postgres_data:
```

---

## NPM Workspaces Setup

```json
// package.json (root)
{
  "name": "hilt-review",
  "private": true,
  "workspaces": [
    "packages/*",
    "backend",
    "frontend"
  ],
  "scripts": {
    "dev": "turbo run dev",
    "build": "turbo run build",
    "test": "turbo run test",
    "lint": "turbo run lint",
    "db:migrate": "npm run db:migrate --workspace=backend",
    "generate:types": "./scripts/generate-types.sh"
  },
  "devDependencies": {
    "turbo": "^1.10.0"
  }
}
```

---

## Scripts

### scripts/dev-up.sh

```bash
#!/bin/bash
docker-compose up -d postgres
npm run db:migrate
npm run dev
```

### scripts/generate-types.sh

```bash
#!/bin/bash
npx openapi-typescript openapi/hilt-review-openapi.yaml \
  -o packages/shared/src/generated/api-types.ts
```

---

## Implementation Order

1. **Set up monorepo structure** (package.json workspaces)
2. **Backend foundation**
   - Fastify app with config
   - Drizzle schema + migrations
   - Health check endpoint
3. **Auth endpoints** (`/auth/login`, `/auth/callback`, `/auth/me`)
4. **Source CRUD** (`/sources`)
5. **Review task lifecycle** (`/review-tasks`, `/review-tasks/:id/decision`)
6. **Background workers** (decision dispatcher, archiver)
7. **Frontend foundation** (Vite + React Router)
8. **Review queue page**
9. **Review task detail page** (editors, diff viewer)
10. **Integration testing**

---

## Future Extensions (Optional)

- `audit/` for immutable decision logs
- `policies/` for auto-approval rules
- `schemas/` for per-source block validation
- `notifications/` for Slack/email alerts

---

## Success Criteria

- New engineers understand the system in <15 minutes
- `npm run dev` starts the full stack locally
- OpenAPI spec is the source of truth for types
- All tests pass before merge

