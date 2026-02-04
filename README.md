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
| [Database Schema](./hilt_review_postgres_schema.md) | PostgreSQL tables, indexes, triggers |
| [Upstream Integration](./hilt_review_upstream_agent_integration.md) | Guide for AI agents submitting tasks |
| [Downstream Integration](./hilt_review_downstream_executor_integration.md) | Guide for executors receiving decisions |
| [Repository Structure](./hilt_review_repo_structure.md) | Recommended project layout |
| [Authentication](./hilt_review_authentication.md) | OAuth, API keys, and security |

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

```bash
# Clone the repository
git clone https://github.com/patjackson52/HILT-review.git
cd HILT-review

# Set up the database
psql -f db/schema.sql

# Start development servers
./scripts/dev-up.sh
```

## Tech Stack (Recommended)

- **Backend**: Node.js/Express or Python/FastAPI
- **Frontend**: React with TypeScript
- **Database**: PostgreSQL 14+
- **Auth**: Google OAuth 2.0 for reviewers, API keys for integrations

## API Overview

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/sources` | POST/GET | Manage integration sources |
| `/review-tasks` | POST/GET | Create and list review tasks |
| `/review-tasks/{id}` | GET | Get task details |
| `/review-tasks/{id}/blocks` | PATCH | Update working content |
| `/review-tasks/{id}/decision` | POST | Submit approve/deny decision |
| `/sources/{id}/decision-events` | GET | Pull decision events |

See the [OpenAPI spec](./openapi/hilt-review-openapi.yaml) for complete API documentation.

## Security

- **Reviewer Auth**: Google OAuth 2.0 with domain restriction support
- **API Auth**: Per-source API keys via `X-API-Key` header
- **Webhooks**: HMAC-SHA256 signed payloads
- **Content**: Markdown rendered in safe mode (no raw HTML)

## License

MIT License — see [LICENSE](./LICENSE)
