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

### 4. Frontend Architecture: Single-Container SPA with Static Assets (2026-08-19)

**Status:** Accepted (implementation complete; integration approved 2026-08-19)
**Author:** Keaton (Lead)
**Participants:** Keaton (design, docs), Kujan (asset development), Fenster (backend wiring), Hockney (integration testing)

**Summary:** Responsive, accessible web UI for fraud alert CRUD, served as static assets from the same FastAPI container. No Node build pipeline, no second service, no new runtime dependencies. Plain HTML + CSS + ES-module vanilla JavaScript (11 files), committed as source and copied by the existing `COPY app/ ./app/` Dockerfile rule.

**Architecture:**
- **Stack:** HTML5, CSS3, ES6 modules (no framework, no bundler)
- **Routing:** Hash-based client-side routing (fragments never sent to server; no catch-all rewrite needed)
- **State:** Single module-level state object; render as pure function per view
- **API client:** Centralized `api.js` wrapper around `fetch`, all paths relative (works behind any host/prefix)
- **Forms:** Structured form + JSON editor tab, synced through a single draft object. Edit uses full PUT; no PATCH local merge.
- **Accessibility:** Semantic landmarks, labels, focus management, ARIA states, keyboard-only navigation supported
- **Responsiveness:** Mobile-first CSS Grid, 375px–1440px tested; `prefers-color-scheme` + `prefers-reduced-motion` respected
- **Security:** No `innerHTML` with data, no inline scripts, restrictive CSP `<meta>`, no third-party origins, no CDN

**Mount Strategy:**
| Path | Owner | Notes |
|------|-------|-------|
| `/api/v1/fraud-alerts*` | existing | untouched |
| `/` | Fenster route | `FileResponse(index.html)` |
| `/static/*` | Fenster mount | `StaticFiles` (css, js, images) |
| `/health` | existing | untouched |
| `/docs`, `/openapi.json` | FastAPI | `include_in_schema=False` for new routes |

**File Boundaries (no cross-editing):**
- **Kujan:** `app/static/` directory — all asset files (11 files)
- **Fenster:** `app/main.py` only — routing, mounts, asset resolution
- **Hockney:** `tests/test_frontend.py` — integration tests (new file)
- **Keaton:** Docs verification — no new deps, no image size change beyond assets

**Acceptance Criteria (20-point gate):**
1. `GET /` → 200 HTML
2. `GET /static/css/styles.css` → 200 CSS
3. `GET /static/js/main.js` → 200 JavaScript
4. `/health`, `/docs`, `/openapi.json` unchanged
5. All 87 `/api/v1/fraud-alerts` tests pass unmodified
6. `GET /api/v1/fraud-alerts/missing` → 404 JSON (not HTML catch-all)
7. Path traversal blocked
8. Asset resolution works from repo root and alternate CWD
9. Dashboard, list, detail, create, edit, delete all work end-to-end
10. Create round-trip with README example succeeds; edit strips server fields
11. All `FraudAlertCreate` fields reachable in structured form
12. JSON tab ↔ structured tab round-trips without data loss
13. Loading, empty, error, 404, success states demonstrably reachable
14. Delete confirmation modal with focus trap; Esc cancels
15. Full keyboard walkthrough succeeds
16. No `innerHTML` with data, no `eval`, no inline handlers
17. No network request to external origins
18. Usable at 375px and 1440px without horizontal scroll
19. `ruff check .` clean
20. Image builds; `app/static/index.html` present inside

**Supersedes:** nothing. **Depends on:** Decision #3 (API Contract), #1b (Schema), #2 (Container)

**Files:** `app/static/` (11 asset files), `app/main.py` (routing edits only), `tests/test_frontend.py` (new)

**Implementation Cycle:**
- **14:53:00** Keaton — Design & documentation (this decision, acceptance criteria)
- **15:00:00** Kujan — Asset development (11 files: HTML shell, CSS, JS modules for routing, state, API, views, DOM safety)
- **15:08:00** Fenster — Backend wiring (`/` route, `/static` mount, module-relative path resolution)
- **15:12:00** Hockney — Integration testing (20 acceptance criteria, 136 tests total with API suite; 1 expected skip due missing `build` module)
- **15:25:00** Hockney — APPROVED (all integration gates passed; wheel verified with `pip wheel`, live HTTP smoke tests)

## Governance

- All meaningful changes require team consensus
- Document architectural decisions here
- Keep history focused on work, decisions focused on direction
