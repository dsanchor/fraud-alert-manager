# Squad Decisions

## Active Decisions

### 1. Fraud Alert API Contract (2026-08-19)

**Status:** Accepted (revised 2026-08-19 — schema corrected to user's supplied payload)
**Author:** Keaton (Lead)
**Participants:** Keaton, McManus, Fenster, Hockney

**Summary:** Fraud alert CRUD service with in-memory storage, exact adherence to user's nested JSON payload structure. No invented fields or constraints. Three-layer architecture: models, repository, routes.

**Key Points:**
- Resource: `/api/v1/fraud-alerts` with CRUD endpoints (POST, GET, GET-item, PUT, PATCH, DELETE)
- Identity & timestamps (server-managed): `id`, `created_at`, `updated_at`, `version`
- Schema: `overall_compliance`, `decision_support`, `regulatory_interpretation` — exact user payload structure
- Validation: required fields, declared types, non-negative counts, `extra="forbid"`, no cross-field rules
- Collection params: `limit` (1-200, default 50), `offset` (default 0)
- Status codes: 200, 201, 204, 404, 422
- Ownership: McManus (models/repository), Fenster (app/routes), Hockney (tests), Keaton (shared/docs)

**Boundaries:** No uniqueness constraints, no cross-field validators, shallow PATCH merge only.

### 2. Container Deployment Strategy (2026-08-19)

**Status:** Approved (2026-08-19 — static validation passed)
**Author:** Keaton (Lead)
**Reviewers:** Hockney (Quality), McManus (Revision)

**Summary:** Multi-stage Docker containerization with automated GHCR publication via GitHub Actions. Optimized image layer with non-root user and health check integration.

**Key Points:**
- Builder stage: Python 3.12-slim, installs deps via pyproject.toml + hatchling
- Runtime stage: Minimal python:3.12-slim, non-root user (appuser), health check via `/health`
- Layer optimization: `.dockerignore` excludes build artifacts, git history, tests, docs (with `!README.md` exception)
- CI/CD: GitHub Actions on push to main; SHA-based + latest tags; GHA cache for efficiency
- Registry: GHCR (ghcr.io); authentication via ${{ secrets.GITHUB_TOKEN }}

**Revision History:**
- **13:45:00** Keaton — Initial implementation; .dockerignore missing README.md exception
- **13:47:00** Hockney — Review Round 1: REJECTED (critical issue found)
- **13:50:00** McManus — Corrected .dockerignore with `!README.md` exception
- **13:52:00** Hockney — Review Round 2: APPROVED (all static validation passed)

**Known Limitation:** Docker daemon unavailable during review — runtime build verification deferred to deployment.

## Governance

- All meaningful changes require team consensus
- Document architectural decisions here
- Keep history focused on work, decisions focused on direction
