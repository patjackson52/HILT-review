# HILT-Review OpenAPI Specification

The complete OpenAPI 3.1 specification for the HILT-Review API is located at:

**[`openapi/hilt-review-openapi.yaml`](./openapi/hilt-review-openapi.yaml)**

## Overview

The API provides endpoints for:

### Sources (Integration Configuration)
- `POST /sources` — Create a source (per-integration configuration)
- `GET /sources` — List all sources
- `GET /sources/{source_id}` — Get a specific source
- `PATCH /sources/{source_id}` — Update source configuration

### Review Tasks (Human Review Queue)
- `POST /review-tasks` — Enqueue a review task (agent-proposed action)
- `GET /review-tasks` — List review tasks (with filtering by source, status)
- `GET /review-tasks/{task_id}` — Get a specific review task
- `PATCH /review-tasks/{task_id}/blocks` — Update working blocks (human edits)
- `POST /review-tasks/{task_id}/decision` — Submit approve/deny decision

### Decision Events (Downstream Delivery)
- `GET /sources/{source_id}/decision-events` — Pull decision events (at-least-once)
- `POST /sources/{source_id}/decision-events/ack` — Acknowledge event receipt

### Webhook Contract (Outgoing)
- `POST /webhooks/decision-event` — Outgoing webhook payload contract (documentation only)

## Authentication

All endpoints require API key authentication via the `X-API-Key` header.

## Key Features

- **Idempotency**: `Idempotency-Key` header supported for task creation
- **Cursor-based pagination**: For listing tasks and events
- **Optimistic concurrency**: `If-Match` header for block updates
- **Webhook signatures**: `X-HILT-Signature` header with HMAC-SHA256

## Viewing the Spec

You can view this spec in tools like:
- [Swagger Editor](https://editor.swagger.io/)
- [Redoc](https://redocly.github.io/redoc/)
- Any OpenAPI 3.1 compatible viewer
