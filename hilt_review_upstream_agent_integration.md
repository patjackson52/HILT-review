# HILT-Review — Upstream Agent Integration Guide (MVP)

## 1. Purpose

This guide explains how **headless AI agents** integrate with HILT-Review to propose actions for human approval. Agents run asynchronously (cron jobs, webhooks, batch workers) and **must not execute actions directly**. Instead, they submit Review Tasks and await a human decision.

---

## 2. Core Principle

> **Agents propose. Humans decide. Executors execute.**

HILT-Review is the gatekeeper. Agents should treat task submission as the *final step* of their autonomous run.

---

## 3. When to Create a Review Task

Agents should create a Review Task when:

- The action has external side effects (email, purchase, config change)
- The output is user-facing text
- The decision carries material risk

Agents should NOT create tasks for:

- Internal reasoning
- Read-only analysis
- Low-risk, reversible internal operations

---

## 4. Creating a Review Task

### Endpoint

`POST /review-tasks`

### Required Inputs

- `source_id` – identifies the integration
- `blocks` – editable artifacts (text, json)

### Strongly Recommended

- **Idempotency-Key** header
- `metadata.trace_id` to correlate logs

---

## 5. Designing Artifact Blocks (Important)

### 5.1 Text Output (Preferred)

Use Markdown for all human-facing text.

```json
{
  "id": "email_body",
  "type": "markdown",
  "content": "Hi **Sam**,\n\nHere is the update...",
  "editable": true
}
```

### 5.2 Plaintext Fields

Use plaintext for short fields like subjects or titles.

```json
{
  "id": "email_subject",
  "type": "plaintext",
  "content": "Re: Invoice 38122",
  "editable": true
}
```

### 5.3 Structured Parameters

Use JSON blocks for parameters required by downstream executors.

```json
{
  "id": "send_params",
  "type": "json",
  "content": {
    "to": "sam@vendor.com",
    "cc": []
  },
  "editable": true
}
```

---

## 6. Interaction Schemas (Optional Guidance)

Interaction schemas speed up review but **never restrict editing**.

### Example: Choice

```json
{
  "interaction_schema": {
    "type": "choice",
    "options": [
      {
        "id": "formal",
        "label": "Formal tone",
        "patches": [
          { "block_id": "email_body", "op": "replace", "value": "Dear Sam,..." }
        ]
      }
    ]
  }
}
```

---

## 7. Idempotency Rules

Agents MUST:

- Use the same `Idempotency-Key` when retrying task creation
- Ensure identical request bodies for retries

This prevents duplicate Review Tasks when jobs retry.

---

## 8. What Happens After Submission

1. Task enters **PENDING** state
2. Human reviews and edits
3. Human APPROVES or DENIES
4. Decision is dispatched downstream

Agents should not poll or block waiting for approval in MVP.

---

## 9. Error Handling

- `409 Conflict` → idempotency mismatch
- `4xx` → agent bug (do not retry blindly)
- `5xx` → safe to retry with same idempotency key

---

## 10. Best Practices

- Keep blocks small and focused
- Avoid embedding Markdown inside JSON
- Always assume humans will edit your output
- Write text as a *draft*, not a final answer

---

## 11. Common Mistakes

❌ Executing actions before approval ❌ Treating approval as optional ❌ Large monolithic JSON blobs ❌ Relying on agent-only context

---

## 12. Summary

HILT-Review enables agents to work autonomously **without bypassing human judgment**. Well-structured Review Tasks lead to faster approvals and safer systems.

