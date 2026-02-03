# HILT-Review — Repo Skeleton (MVP)

This document proposes a minimal, implementation-friendly repository layout for the HILT-Review MVP. It is designed to keep the API contract, DB schema, and docs in sync and easy to consume by Claude Code.

## 1. Recommended Directory Structure

```text
hilt-review/
├── README.md
├── docs/
│   ├── PRD.md
│   ├── Frontend-Spec.md
│   ├── Upstream-Agent-Integration.md
│   └── Downstream-Executor-Integration.md
├── openapi/
│   └── hilt-review-openapi.yaml
├── db/
│   ├── schema.sql
│   └── migrations/
│       └── 001_init.sql
├── backend/
│   ├── README.md
│   └── (service code here)
├── frontend/
│   ├── README.md
│   └── (ui code here)
├── scripts/
│   ├── dev-up.sh
│   ├── dev-down.sh
│   └── archive-cron.sh
└── .editorconfig
```

## 2. File Mapping to Current Project Artifacts

Copy/rename the already-created artifacts into these repo paths:

- `docs/PRD.md`  ← HILT-Review-PRD.md
- `docs/Frontend-Spec.md` ← HILT-Review-Frontend-Spec.md
- `docs/Upstream-Agent-Integration.md` ← HILT-Review-Upstream-Agent-Integration.md
- `docs/Downstream-Executor-Integration.md` ← HILT-Review-Downstream-Executor-Integration.md
- `openapi/hilt-review-openapi.yaml` ← hilt-review-openapi.yaml
- `db/schema.sql` ← HILT-Review-Postgres-Schema.sql
- `db/migrations/001_init.sql` ← same as schema.sql for MVP (or split later)

## 3. Suggested README.md (Top-Level)

Include the following sections:

- What HILT-Review is (gatekeeper for async headless agents)
- Quickstart (run DB, run backend, run frontend)
- API contract location (OpenAPI)
- DB schema location
- Delivery semantics (at-least-once + idempotency)

## 4. Minimal “Interface Contracts” Checklist

To keep implementation aligned with the spec, treat these as *source of truth*:

1. `openapi/hilt-review-openapi.yaml`
2. `db/schema.sql`
3. `docs/PRD.md`

If any implementation choice conflicts with these, update the docs/specs or reconsider the implementation.

## 5. Dev Scripts (MVP)

### scripts/dev-up.sh
- Starts Postgres
- Runs backend in dev mode
- Runs frontend in dev mode

### scripts/archive-cron.sh
- Runs the 7-day archive job
- Intended to be scheduled by cron in production

## 6. Optional: Add a `docker-compose.yml`

If you want a simple local environment:

```text
hilt-review/
├── docker-compose.yml
```

Where:
- Postgres service
- Backend service
- Frontend service

(Compose content intentionally omitted here so you can tailor language/runtime.)



---

## Execution Intent Convention (MVP – Addendum)

Every Review Task **should include** a JSON Artifact Block with `id = "execution_intent"`. This block specifies *what should be executed* if (and only if) the human approves the task.

HILT-Review does **not** interpret or execute this intent. It stores, displays, allows editing, and emits it downstream after approval.

### Supported `kind` values (MVP)
- `command_template` – reference to a client-owned command or script template
- `mcp_tool_call` – reference to an MCP tool invocation
- `http_request` – generic HTTP execution (optional)

### Example
```json
{
  "id": "execution_intent",
  "type": "json",
  "content": {
    "kind": "command_template",
    "template_id": "rotate-secrets-v1",
    "params": { "service": "billing", "dry_run": true },
    "capabilities_required": ["ops:secrets:write"]
  },
  "editable": true
}
```

The execution intent is **resolved exclusively by the downstream executor** associated with the task’s `source_id`.



---

## Execution Intent Block (Required Convention)

Upstream agents **should include** a JSON Artifact Block with `id = "execution_intent"` in every Review Task. This block describes the action to be executed if the task is approved.

### Purpose
- Makes execution intent explicit and reviewable
- Keeps HILT-Review execution-agnostic
- Allows humans to edit parameters before approval

### Supported Kinds (MVP)
- `command_template` – executor-owned command or script identified by ID
- `mcp_tool_call` – executor-owned MCP tool invocation
- `http_request` – generic HTTP execution (optional)

### Example
```json
{
  "id": "execution_intent",
  "type": "json",
  "content": {
    "kind": "command_template",
    "template_id": "rotate-secrets-v1",
    "params": { "service": "billing", "dry_run": true },
    "capabilities_required": ["ops:secrets:write"]
  },
  "editable": true
}
```

Agents must **not** embed raw credentials or executable secrets in this block.



---

## Executing `execution_intent`

Downstream executors must treat the `execution_intent` block as the **authoritative instruction** for execution after approval.

### Resolution Rules

- Resolve templates, MCP servers, and credentials **locally** (never via HILT-Review)
- Enforce allowlists and capability checks
- Deduplicate executions using `event_id`

### Supported Intent Kinds (MVP)

#### `command_template`
- Look up `template_id` in executor-owned registry
- Apply `params`
- Execute in the appropriate environment

#### `mcp_tool_call`
- Invoke the referenced MCP server and tool
- Use executor-held credentials

#### `http_request` (optional)
- Execute HTTP call as described
- Apply executor-side validation and allowlists

Executors must **never execute** when `decision.type == DENY`.

