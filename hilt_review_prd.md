# HILT-Review — Product Requirements Document (MVP)

## 1. Overview

**HILT-Review** is a Human‑in‑the‑Loop (HILT) review system that acts as a **gatekeeper** between headless, asynchronous AI agents and downstream execution systems.

AI agents run autonomously (cron jobs, webhooks, background workers, batch processes) and **propose actions**. These proposed actions are **not executed immediately**. Instead, they are sent to HILT‑Review, where a human reviewer asynchronously reviews, edits, approves, or denies them. Only after a human decision does execution proceed downstream.

HILT‑Review **does not** contain AI logic, model inference, or execution logic. Its sole responsibility is the *human decision step*.

---

## 2. Goals

### Primary Goal
- Enable safe, asynchronous human approval of AI‑proposed actions before execution

### Secondary Goals
- Allow humans to edit AI‑generated outputs (especially text) before approval
- Support long‑running, headless agent workflows
- Provide a reliable decision handoff to downstream executors
- Preserve full context (original → diff → final)

---

## 3. Non‑Goals (MVP)

- No AI agent orchestration
- No execution or rollback logic
- No multi‑stage approvals
- No role‑based access control beyond a single reviewer pool
- No SLA enforcement or escalation policies
- No analytics or reporting dashboards

---

## 4. Core Use Case

1. A headless AI agent completes an async job (cron, webhook, batch, etc.)
2. The agent proposes an action (email, purchase, config change, API call, etc.)
3. The agent submits the proposal to HILT‑Review as a **Review Task**
4. The task is queued for human review
5. A human reviews, edits, and either approves or denies the task
6. HILT‑Review emits the final decision and payload
7. A downstream executor performs the action

---

## 5. Key Principles

### 5.1 Gatekeeper Model
- Nothing executes until a human decision is made
- HILT‑Review sits *in the critical path*

### 5.2 Async‑First
- Agents and humans are fully decoupled in time
- Review latency is human‑bound, not system‑bound

### 5.3 Editable by Default
- All AI‑generated content is editable
- “Approve” means *approve the current edited state*

### 5.4 Markdown‑First Text
- AI text outputs are treated as Markdown
- Plaintext fallback is always available

### 5.5 Deterministic Output
- Every decision produces:
  - Original content
  - Diff
  - Final content

---

## 6. Core Concepts

### Review Task
A unit of work representing an AI‑proposed action awaiting human decision.

### Artifact Blocks
Reviewable and editable units of content (e.g. email subject, email body, JSON parameters).

### Interaction Schema
Optional UI guidance that helps humans review faster (choices, confirmation, etc.) without limiting editability.

### Decision Event
The immutable output emitted to downstream systems after human review.

---

## 7. Review Task Lifecycle

```
CREATED → PENDING
PENDING → APPROVED | DENIED
APPROVED/DENIED → DISPATCHED
(any terminal state) → ARCHIVED (after 7 days)
```

- **PENDING** blocks execution
- **APPROVED** triggers execution downstream
- **DENIED** blocks execution but still emits a decision
- **DISPATCHED** indicates delivery to downstream
- **ARCHIVED** is read‑only

---

## 8. Artifact Model

### Artifact Blocks

Each Review Task consists of one or more blocks:

- Markdown text (email bodies, chat responses)
- Plaintext (subjects, titles)
- Structured JSON (parameters, metadata)

All blocks are editable unless explicitly marked otherwise.

---

## 9. Editing & Diffing

- Humans edit working content directly
- Diffs are generated automatically
- Text diffs use unified diff format
- JSON diffs use RFC‑6902 JSON Patch

Diffs are informational but included in downstream payloads.

---

## 10. Interaction Schemas (Guidance Only)

Interaction schemas guide UI rendering but **never remove editability**.

Supported schemas (MVP):
- `edit` (default)
- `confirm`
- `choice` (applies patches)
- `external` (link out, manual confirmation)

---

## 11. User Experience (Reviewer)

- Queue of pending review tasks
- Priority‑sorted
- Clear indication that action has *not* executed yet
- Inline editing with Markdown preview
- Diff preview before approval

Buttons:
- **Approve** → execute edited content
- **Deny** → block execution (reason required)

---

## 12. Integrations

### Upstream (Agents)
- Submit Review Tasks via API
- Include idempotency keys
- Identify source/integration

### Downstream (Executors)
- Receive decisions via webhook and/or pull API
- At‑least‑once delivery
- Must deduplicate using event IDs

---

## 13. Reliability & Delivery

- Webhooks are retried with backoff
- Pull API provides recovery path
- Idempotency required for create operations

---

## 14. Security (MVP)

- API keys per integration
- Signed webhooks (HMAC)
- Markdown rendered in safe mode
- No raw HTML execution

---

## 15. Archiving & Retention

- Tasks archived after 7 days in terminal state
- Archived tasks are read‑only
- Retention policies can be extended later

---

## 16. Out of Scope (Explicit)

- AI reasoning visibility
- Execution retries or compensation
- Compliance/audit guarantees
- Multi‑tenant RBAC

---

## 17. Success Criteria (MVP)

- Agents can safely propose actions asynchronously
- Humans can review and edit content without friction
- No action executes without human approval
- Downstream systems receive deterministic, idempotent decisions

---

## 18. Future Enhancements

- Multi‑stage approvals
- Auto‑approval policies
- Schema validation per action type
- SLA‑based escalation
- Full audit log immutability

