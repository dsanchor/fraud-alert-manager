# Squad Decisions

## Active Decisions

### 1. Schema Extension: transaction_id + original_transaction (2026-08-19)

**Status:** Superseded (2026-08-19 — normalized schema)
**Author:** McManus (Data Engineer)
**Summary:** Added two new client-owned top-level fields: `transaction_id` (string) and `original_transaction` (nested object with 9 fields: transaction_id, originator_name, origin_account, bank_origin, beneficiary_name, destination_account, bank_destination, amount, currency). Bank/account identifiers preserve leading zeroes as strings. `OriginalTransaction` uses `extra="forbid"`. No constraint enforced that `FraudAlertCreate.transaction_id` must equal `original_transaction.transaction_id`. Fields exposed as optional in `FraudAlertUpdate` (shallow PATCH semantics).
**Files:** `app/models.py`, `app/repository.py`

**Supersession Note (2026-08-19):** This decision has been superseded by decision #1b (Schema Normalization: transaction_information). The field `original_transaction` was renamed to `transaction_information` and the nested `transaction_id` field was removed. The root-level `transaction_id` remains as the sole transaction identifier. See decision #1b for current schema.

### 1b. Schema Normalization: transaction_information (2026-08-19)

**Status:** Implemented (approved 2026-08-19)
**Author:** McManus (Data Engineer)
**Reviewers:** Hockney (Quality approval: 87/87 tests pass, ruff clean, wheel succeeds)
**Summary:** Revised the transaction schema per user instruction: renamed `OriginalTransaction` to `TransactionInformation` and root-level field `original_transaction` to `transaction_information`. Removed nested `transaction_id` from `TransactionInformation`; root-level `transaction_id` is the sole identifier. `TransactionInformation` retains exactly 8 fields: `originator_name`, `origin_account`, `bank_origin`, `beneficiary_name`, `destination_account`, `bank_destination`, `amount`, `currency`. `extra="forbid"` preserved on all nested objects; no backwards-compatibility shims — old field name `original_transaction` is rejected by validation (422). Repository `update` method key updated from `original_transaction` to `transaction_information`.
**Supersedes:** Decision #1 (Schema Extension)
**Files:** `app/models.py`, `app/repository.py`, test fixtures, tests



### 2. Fix Hatchling package discovery for `app/` directory (2026-08-19)

**Status:** Applied
**Author:** Fenster (Backend Dev)
**Summary:** GitHub Actions GHCR build failed with package discovery error (Hatchling looks for project-name-normalized directory; source lives in generic `app/`). Added explicit package declaration to `pyproject.toml`: `[tool.hatch.build.targets.wheel] packages = ["app"]`. Wheel now includes app package; uvicorn import and Dockerfile unchanged.
**Files:** `pyproject.toml`

### 3. Fraud Alert API Contract (2026-08-19)

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
