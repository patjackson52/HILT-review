# HILT-Review — Frontend Component & UX Specification (MVP)

## 1. Purpose

This document specifies the frontend architecture, components, and UX patterns for the HILT-Review MVP. The frontend enables humans to asynchronously review, edit, approve, or deny AI-proposed actions that are gated before execution.

The design prioritizes:
- Fast comprehension of AI output
- Safe, powerful editing (especially text)
- Clear execution semantics (nothing runs until approved)

---

## 2. High-Level UI Structure

### Pages

1. **Review Queue** – list of pending tasks
2. **Review Task Detail** – full review + editing experience
3. **Archive View** (read-only, optional MVP)

---

## 3. Review Queue

### Purpose

Give reviewers a fast overview of pending work and allow prioritization.

### Core Behaviors

- Polling refresh (no WebSockets required in MVP)
- Sort by:
  - Priority (HIGH → LOW)
  - Created time
- Filter by:
  - Status (default: PENDING)
  - Source

### Columns

| Column | Notes |
|------|------|
| Priority | Visual indicator (color or icon) |
| Source | Integration name |
| Summary | Short description (from metadata or first block) |
| Status | PENDING / APPROVED / DENIED |
| Created | Relative time |

Clicking a row opens the Review Task Detail page.

---

## 4. Review Task Detail Page

### Layout (Desktop)

```
-----------------------------------------------------
Header: Task ID • Source • Priority • Status
-----------------------------------------------------

[ LEFT: Editor Stack ]      [ RIGHT: Preview / Diff ]

-----------------------------------------------------
Decision Controls
-----------------------------------------------------
```

Mobile layout stacks vertically.

---

## 5. Artifact Block Rendering

Each Review Task is composed of **Artifact Blocks** rendered in order.

### Block Types

| Type | Editor | Preview |
|----|------|------|
| markdown | Markdown editor | Rendered Markdown |
| plaintext | Text input | Text preview |
| json | JSON editor + form (optional) | Read-only formatted JSON |

All blocks are **editable by default**.

---

## 6. Markdown Editor (Critical Component)

### Requirements

- Two-pane view:
  - Left: Markdown editor
  - Right: Rendered preview
- Toggle modes:
  - Markdown
  - Preview
  - Plaintext fallback

### Rendering Rules

- CommonMark + safe GFM subset
- No raw HTML execution
- Links open in new tab
- Images disabled by default (feature-flagged)

### Failure Handling

If rendering fails:
- Display warning banner
- Fallback to raw text editor

---

## 7. Interaction Schema UI (Guidance Layer)

Interaction schemas provide optional UI affordances but **never limit editing**.

### Confirm

- Emphasize approve/deny buttons
- Still show full editors

### Choice

- Render radio buttons or dropdown
- Selecting an option applies patches to blocks
- User can continue editing afterward

### External

- Show external link
- Require manual confirmation checkbox before approval

---

## 8. Diff Viewer

### Purpose

Before approval, reviewers must clearly see what changed.

### Capabilities

- Toggle diff visibility
- Side-by-side or inline view

### Diff Types

- Markdown / plaintext: unified diff
- JSON: RFC 6902 patch visualization

---

## 9. Decision Controls

### Buttons

- **Approve** – executes current edited state
- **Deny** – blocks execution (reason required)

### Rules

- Approve is disabled if validation fails
- Deny always requires a reason
- Confirmation modal before final submission

---

## 10. Validation & Error States

- JSON blocks must be valid JSON
- Required fields enforced per schema
- Clear inline error messages

---

## 11. Accessibility

- Keyboard navigation for editors and buttons
- Screen-reader-friendly labels
- High-contrast diff highlighting

---

## 12. Non-Goals (Frontend MVP)

- No collaborative editing
- No inline comments
- No real-time presence indicators
- No theming or customization

---

## 13. Component Map (Suggested)

- `ReviewQueuePage`
- `ReviewTaskPage`
- `ArtifactBlockRenderer`
- `MarkdownEditor`
- `JsonEditor`
- `DiffViewer`
- `DecisionControls`

---

## 14. Success Criteria

- Reviewers can understand a task in seconds
- Editing Markdown feels natural and safe
- No accidental execution without approval
- Diff makes changes obvious

