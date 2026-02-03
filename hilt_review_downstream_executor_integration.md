# HILT-Review — Downstream Executor Integration Guide (MVP)

## 1. Purpose

This guide describes how **downstream execution systems** integrate with HILT-Review to receive approved (or denied) decisions and execute actions safely.

Downstream systems are responsible for:
- Executing approved actions
- Ignoring or handling denied actions
- Deduplicating events (at-least-once delivery)

---

## 2. Delivery Models

Each source configures one of:

- **Webhook only** – push-based execution trigger
- **Pull only** – executor polls for decisions
- **Webhook + Pull** – redundancy and recovery

---

## 3. Decision Event Contract

Every approved or denied task produces a **Decision Event**.

### Key Properties

- `event_id` – globally unique; used for deduplication
- `task_id` – review task identifier
- `decision.type` – APPROVE or DENY
- `original` – original artifact blocks
- `final` – human-edited artifact blocks
- `diff` – original → final

---

## 4. Webhook Delivery

### Behavior

- HTTP POST to per-source configured URL
- At-least-once delivery
- Retries with exponential backoff

### Headers

- `X-HILT-Signature` – HMAC-SHA256 of request body
- `Content-Type: application/json`

### Signature Verification (Recommended)

```
hex(hmac_sha256(secret, request_body))
```

Reject requests with invalid signatures.

---

## 5. Webhook Response Rules

- `2xx` → event accepted (idempotent)
- `4xx` → permanent failure (no retry)
- `5xx` → retry with backoff

Respond quickly; execution can be async.

---

## 6. Pull API Consumption

### Endpoint

`GET /sources/{source_id}/decision-events`

### Rules

- Poll periodically
- Store `event_id`s locally
- Process each event exactly once

### Ack (Optional but Recommended)

`POST /sources/{source_id}/decision-events/ack`

Stops re-delivery of acknowledged events.

---

## 7. Deduplication Strategy (Critical)

Downstream systems MUST:

- Treat `event_id` as the idempotency key
- Store processed event IDs durably
- Ignore duplicate deliveries

---

## 8. Execution Semantics

### APPROVE

- Execute action using **final artifact blocks**
- Ignore `original` except for auditing

### DENY

- Do NOT execute
- Optionally:
  - alert operators
  - log for review
  - trigger remediation workflows

---

## 9. Error Handling

If execution fails:

- Do NOT retry execution automatically unless safe
- Failure handling is executor-specific
- HILT-Review does not manage rollback

---

## 10. Security Considerations

- Validate webhook signatures
- Restrict inbound IPs if possible
- Use HTTPS only
- Treat artifact content as untrusted input

---

## 11. Testing & Validation

- Test with duplicate events
- Test webhook retries
- Test DENY handling

---

## 12. Summary

HILT-Review guarantees **human-approved intent**, not execution success. Downstream executors are responsible for safe, idempotent action execution.

