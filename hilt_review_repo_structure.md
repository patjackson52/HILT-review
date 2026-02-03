# HILT-Review — Repository Structure (Recommended)

This document defines a clean, implementation-ready repository layout for the HILT-Review project. It is designed to align directly with the saved PRD, OpenAPI spec, database schema, and integration guides.

The structure favors clarity, separation of concerns, and easy handoff to Claude Code or human engineers.

---

## Top-Level Layout

```
hilt-review/
├── README.md
├── docs/
│   ├── PRD.md
│   ├── Frontend-Spec.md
│   ├── Upstream-Agent-Integration.md
│   ├── Downstream-Executor-Integration.md
│   └── Architecture.md
│
├── openapi/
│   └── hilt-review-openapi.yaml
│
├── db/
│   ├── schema.sql
│   ├── migrations/
│   │   └── 001_initial.sql
│   └── seeds/
│       └── dev_sources.sql
│
├── backend/
│   ├── src/
│   │   ├── api/
│   │   ├── domain/
│   │   ├── services/
│   │   ├── workers/
│   │   │   ├── decision_dispatcher
│   │   │   └── archiver
│   │   └── storage/
│   ├── tests/
│   └── README.md
│
├── frontend/
│   ├── src/
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
│   │   ├── api/
│   │   └── utils/
│   ├── tests/
│   └── README.md
│
├── scripts/
│   ├── dev.sh
│   ├── migrate.sh
│   └── seed.sh
│
└── infra/
    ├── docker/
    │   ├── backend.Dockerfile
    │   └── frontend.Dockerfile
    └── terraform/
        └── main.tf
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

### Backend

- `domain/` contains core entities (ReviewTask, ArtifactBlock, DecisionEvent)
- `services/` contains business logic (diffing, validation, state transitions)
- `workers/decision_dispatcher` implements outbox → webhook / pull delivery
- `workers/archiver` handles 7-day auto-archive

### Frontend

- Editors are isolated components
- Rendering logic is block-type driven
- No frontend business logic leaks into backend

### Infra

- Dockerized backend + frontend
- Terraform optional but prepared

---

## README.md (Top-Level)

Recommended contents:

- What HILT-Review is
- Gatekeeper model (diagram)
- How to run locally
- Where to find API / DB / Docs

---

## How to Use This Repo with Claude Code

1. Paste this structure into a repo
2. Drop saved canvas artifacts into mapped locations
3. Point Claude Code at:
   - `openapi/`
   - `db/`
   - `docs/`
4. Ask Claude Code to implement backend and frontend incrementally

This structure minimizes ambiguity and prevents scope creep.

---

## Future Extensions (Optional)

- `audit/` for immutable logs
- `policies/` for auto-approval rules
- `schemas/` for block validation

---

## Success Criteria

- New engineers understand the system in <15 minutes
- Claude Code can scaffold without clarification
- Artifacts remain authoritative and in sync

