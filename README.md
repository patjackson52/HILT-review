# HILT-Review

**Human-in-the-Loop Review System** — A gatekeeper between autonomous AI agents and downstream execution systems.

## Overview

HILT-Review enables safe, asynchronous human approval of AI-proposed actions before execution. AI agents propose actions, humans review and edit them, and only after approval does execution proceed downstream.

**Core Principle:** *Agents propose. Humans decide. Executors execute.*

```
┌─────────────┐      ┌──────────────┐      ┌────────────────┐
│  AI Agent   │ ───▶ │ HILT-Review  │ ───▶ │   Executor     │
│  (proposes) │      │ (human gate) │      │   (executes)   │
└─────────────┘      └──────────────┘      └────────────────┘
```

## Key Features

- **Gatekeeper Model** — Nothing executes until a human approves
- **Async-First** — Agents and humans fully decoupled in time
- **Editable by Default** — All AI-generated content is editable before approval
- **Markdown-First** — Rich text editing with safe rendering
- **Deterministic Output** — Every decision includes original, diff, and final content
- **At-Least-Once Delivery** — Reliable webhook and pull-based delivery to executors

## Documentation

| Document | Description |
|----------|-------------|
| [Product Requirements](./hilt_review_prd.md) | MVP goals, lifecycle, core concepts |
| [OpenAPI Specification](./openapi/hilt-review-openapi.yaml) | Complete API contract |
| [Frontend Spec](./hilt_review_frontend_spec.md) | UI components and UX flows |
| [UI Detailed Spec](./docs/ui-detailed-spec.md) | Wireframes, components, state management |
| [Database Schema](./hilt_review_postgres_schema.md) | PostgreSQL tables, indexes, triggers |
| [Upstream Integration](./hilt_review_upstream_agent_integration.md) | Guide for AI agents submitting tasks |
| [Downstream Integration](./hilt_review_downstream_executor_integration.md) | Guide for executors receiving decisions |
| [Repository Structure](./hilt_review_repo_structure.md) | Recommended project layout |
| [Authentication](./hilt_review_authentication.md) | OAuth, API keys, and security |
| [Backend Spec](./docs/backend-spec.md) | Node.js + Fastify + TypeScript architecture |
| [Deployment Guide](./docs/deployment-guide.md) | Deploy to Vercel + Railway + Neon (free tier) |
| [Testing Strategy](./docs/testing-strategy.md) | Unit tests, integration tests, test data, dev workflows |
| [MCP Integration](./docs/mcp-integration.md) | Model Context Protocol for AI agent integration |

## Architecture

### Review Task Lifecycle

```
PENDING → APPROVED/DENIED → DISPATCHED → ARCHIVED (7 days)
```

### Three-Party System

1. **Upstream Agents** — Submit review tasks via REST API with API key auth
2. **HILT-Review** — Human reviewers authenticate via Google OAuth, review/edit/decide
3. **Downstream Executors** — Receive decisions via webhook or pull API

### Data Model

- **Source** — Integration configuration (webhook URL, delivery mode, API credentials)
- **Review Task** — AI-proposed action with artifact blocks awaiting human decision
- **Artifact Block** — Editable content unit (markdown, plaintext, or JSON)
- **Decision Event** — Immutable output delivered to downstream executors

## Quick Start

### Prerequisites

- Node.js 20+ with npm
- Docker Desktop (for PostgreSQL)

### Setup

```bash
# Clone the repository
git clone https://github.com/patjackson52/HILT-review.git
cd HILT-review

# Install dependencies
npm install

# Start PostgreSQL via Docker
docker compose up -d

# Run database migrations
npm run db:migrate

# Start development servers (backend + frontend)
npm run dev
```

The app will be available at:
- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:3001

### Create Test Data

```bash
# Create a source (AI agent integration)
curl -X POST http://localhost:3001/api/v1/sources \
  -H "Content-Type: application/json" \
  -d '{
    "name": "My AI Agent",
    "description": "Demo agent integration",
    "delivery": {
      "mode": "PULL_ONLY",
      "webhook": {"enabled": false}
    }
  }'

# Generate an API key for the source (replace SOURCE_ID)
cd backend && DATABASE_URL=postgresql://hilt:localdev@localhost:5433/hilt_review \
  npx tsx scripts/create-api-key.ts YOUR_SOURCE_ID "My API Key"
```

### Submit a Review Task

```bash
curl -X POST http://localhost:3001/api/v1/review-tasks \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -d '{
    "source_id": "YOUR_SOURCE_ID",
    "title": "Send welcome email",
    "service": {"id": "email", "name": "Email Service"},
    "action": {"type": "send", "verb": "Send Email"},
    "risk_level": "low",
    "blocks": [
      {"id": "subject", "label": "Subject", "type": "plaintext", "content": "Welcome!", "editable": true},
      {"id": "body", "label": "Body", "type": "markdown", "content": "Hello and welcome!", "editable": true}
    ]
  }'
```

### Review and Approve

1. Open http://localhost:5173 in your browser
2. Click on a pending task to view details
3. Edit content if needed
4. Click **Approve** or **Deny**

### Poll for Decisions

```bash
# Get decisions for your source (replace SOURCE_ID)
curl "http://localhost:3001/api/v1/decision-events?source_id=YOUR_SOURCE_ID" \
  -H "Authorization: Bearer YOUR_API_KEY"

# Acknowledge receipt
curl -X POST http://localhost:3001/api/v1/decision-events/ack \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -d '{"event_ids": ["EVENT_ID_1", "EVENT_ID_2"]}'
```

## Environment Variables

Create a `.env` file in the `backend` directory:

```bash
# Required
DATABASE_URL=postgresql://hilt:localdev@localhost:5433/hilt_review

# Optional - defaults shown
PORT=3001
LOG_LEVEL=info

# OAuth (optional for development - dev mode auto-authenticates)
# GOOGLE_CLIENT_ID=...
# GOOGLE_CLIENT_SECRET=...
# OAUTH_REDIRECT_URI=http://localhost:3001/api/v1/auth/google/callback
# SESSION_SECRET=your-32-char-minimum-secret
```

## Tech Stack

| Layer | Technology | Why |
|-------|------------|-----|
| **Backend** | Node.js + Fastify + TypeScript | Fast, type-safe, excellent ecosystem |
| **Frontend** | React + Vite + TypeScript | Component-based, fast dev experience |
| **Database** | PostgreSQL 15+ | JSONB support, reliable, portable |
| **ORM** | Drizzle | Type-safe, SQL-first, lightweight |
| **Auth** | Google OAuth 2.0 + API Keys | Standard OAuth for reviewers, keys for machines |
| **Queue** | pg-boss (Postgres-backed) | No Redis needed, transactional guarantees |
| **Styling** | CSS Modules | Scoped styles, no runtime overhead |

See [Backend Spec](./docs/backend-spec.md) for detailed architecture and patterns.

## API Overview

All API endpoints are prefixed with `/api/v1`.

### Sources (Integration Management)

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/sources` | POST | None | Create a new source |
| `/sources` | GET | None | List all sources |
| `/sources/:id` | GET | None | Get source by ID |
| `/sources/:id` | PATCH | None | Update source config |
| `/sources/:id` | DELETE | None | Delete source |

### Review Tasks

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/review-tasks` | POST | API Key | Create a review task |
| `/review-tasks` | GET | Session | List tasks (with filters) |
| `/review-tasks/:id` | GET | Session | Get task details |
| `/review-tasks/:id/blocks` | PATCH | Session | Update working content |
| `/review-tasks/:id/decision` | POST | Session | Submit approve/deny |

### Decision Events (Downstream Delivery)

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/decision-events` | GET | API Key | Poll for decisions |
| `/decision-events/ack` | POST | API Key | Acknowledge receipt |
| `/decision-events/:id` | GET | API Key | Get single event |

### Health

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/health` | GET | None | Health check |

See the [OpenAPI spec](./openapi/hilt-review-openapi.yaml) for complete API documentation.

## Development

### Project Structure

```
hilt-review/
├── packages/
│   └── shared/          # Shared TypeScript types
├── backend/
│   ├── src/
│   │   ├── routes/      # Fastify route handlers
│   │   ├── services/    # Business logic
│   │   ├── workers/     # Background jobs (pg-boss)
│   │   └── db/          # Drizzle schema & migrations
│   └── scripts/         # CLI utilities
├── frontend/
│   ├── src/
│   │   ├── pages/       # Route components
│   │   ├── components/  # Reusable UI components
│   │   ├── contexts/    # React contexts (auth)
│   │   └── api/         # API client
│   └── public/
└── docs/                # Detailed specifications
```

### Commands

```bash
# Start everything (postgres + backend + frontend)
npm run dev

# Run just backend
npm run dev --workspace=backend

# Run just frontend
npm run dev --workspace=frontend

# Build all packages
npm run build

# Run database migrations
npm run db:migrate

# Generate new migration
npm run db:generate

# Run tests
npm test
```

### Key Development Patterns

1. **Dev Mode Auth**: In development, the frontend automatically authenticates with a mock user - no OAuth setup required.

2. **API Key Creation**: Use the CLI script to generate API keys:
   ```bash
   cd backend && DATABASE_URL=... npx tsx scripts/create-api-key.ts <source_id> "Key Name"
   ```

3. **Block Editing**: Editable blocks can be modified before approval. The diff is calculated and included in the decision event.

4. **Decision Events**: Events follow an outbox pattern - they're reliably delivered via webhook or pull API.

## Security

- **Reviewer Auth**: Google OAuth 2.0 with domain restriction support
- **API Auth**: Per-source API keys via `Authorization: Bearer` header
- **Webhooks**: HMAC-SHA256 signed payloads
- **Content**: Markdown rendered in safe mode (no raw HTML)

## Current Status (MVP)

This MVP implementation includes:

- [x] Review task creation via API
- [x] Review task listing with filters
- [x] Block viewing and editing
- [x] Decision submission (approve/deny with reason)
- [x] Diff calculation (text and JSON)
- [x] Decision events API (pull-based)
- [x] Webhook delivery (with retries)
- [x] API key authentication for agents
- [x] Dev mode authentication for reviewers

Not yet implemented:
- [ ] Google OAuth for production
- [ ] Session-based auth middleware
- [ ] Comprehensive test suite
- [ ] MCP server integration

## License

MIT License — see [LICENSE](./LICENSE)
