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

## Governance

- All meaningful changes require team consensus
- Document architectural decisions here
- Keep history focused on work, decisions focused on direction
