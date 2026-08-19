# Project Context

- **Owner:** Copilot
- **Project:** FastAPI CRUD service for structured fraud alerts
- **Stack:** Python, FastAPI, Pydantic, in-memory persistence, pytest
- **Created:** 2026-08-19T13:21:28.482+02:00

## Learnings

### 2026-08-19 — Fraud Alert API design review (contract corrected)

Facilitated the contract ceremony for the FastAPI CRUD service. Accepted contract
recorded in `.squad/decisions/inbox/keaton-fraud-alert-api-contract.md`.

- **Correction:** the first draft of the contract invented schema that was never in the
  user's payload — `alert_reference`, `status`, `compliant`/`compliance_score`/`framework`/
  `violations`, `recommended_action`/`confidence`/`risk_score`, `jurisdiction`/`regulation`/
  reporting fields, plus uniqueness with a `409` and the matching filters and cross-field
  validators. All removed. The supplied payload is the authoritative schema.
- **Actual accepted body:** `overall_compliance` (`overall_status` + five non-negative
  rule counts); `decision_support` (`calculation_version`, `calculation_inputs` with
  `highest_historical_context_level` + the five counts, `investigation_priority` with
  seven numeric score fields + `priority_band`, `workflow_classification` with
  `final_verdict`, `matched_rule_id`, `rationale` list, `meaning`, `is_legal_conclusion`,
  `establishes_money_laundering`); `regulatory_interpretation` (`summary`, `key_findings`,
  `regulatory_relevance`).
- **No cross-field validators, no uniqueness, no enums, no filters.** Validation is
  required-fields, declared types, `>= 0` on counts, and `extra="forbid"`. Nothing else.
- **Base path `/api/v1/fraud-alerts`.** Versioned prefix from day one.
- **Server owns `id`, `created_at`, `updated_at`, `version`.** Separate
  `FraudAlertCreate`/`FraudAlert` models make that structural rather than a runtime check.
- **`extra="forbid"` on every model.** Silent field drop in a nested object is the failure
  mode that costs the most debugging time.
- **PUT *and* PATCH, with PATCH defined as shallow top-level merge only.** Written into
  the contract so nobody has to guess.
- **Errors are `404` and `422` only**, in FastAPI's native shapes; pagination is plain
  `limit`/`offset`. In-memory repository with no secondary index and no domain exceptions.
- **Ownership seams unchanged:** McManus → `app/models.py`, `app/repository.py`;
  Fenster → `app/main.py`, `app/routes.py`, `app/dependencies.py`; Hockney → `tests/`;
  Keaton → `pyproject.toml`, `README.md`. No cross-editing to make one's own part pass.
- **Scope held down:** no DB, no auth, no Docker, no CI, no settings/logging framework.

**Lasting heuristic:** transcribe the supplied payload field-for-field before designing
anything around it. Plausible-sounding domain fields invented during a design review read
as requirements to everyone downstream and cost more rework than any endpoint decision.
Then pin down PATCH merge depth and unknown-field handling before a model is written.

### 2026-08-19 — Container packaging and CI/CD pipeline

Authored `Dockerfile`, `.dockerignore`, and `.github/workflows/publish-container.yml`
for the FastAPI service.

- **Multi-stage build (builder + runtime):** keeps the final image slim — dev tools and
  hatchling never land in the shipped layer; only site-packages and the app source are
  copied across.
- **`python:3.12-slim` base:** small, well-maintained, matches the declared
  `requires-python = ">=3.12"` constraint. No Alpine to avoid musl/glibc surprises with
  Python C extensions (uvicorn[standard] pulls `httptools`, `uvloop`).
- **Non-root `appuser`:** created with `--system --no-create-home --shell /sbin/nologin`;
  dropped before the CMD instruction.
- **Health check via `urllib.request`:** stdlib-only, no curl/wget dependency needed;
  checks the `/health` endpoint that the app already exposes.
- **`.dockerignore`:** excludes `.git`, `.squad`, `.copilot`, `.github`, `__pycache__`,
  virtualenvs, test/lint caches, editor files, `.env*`, and secret file patterns.
- **Workflow permissions:** `contents: read`, `packages: write` — nothing else.
- **`GITHUB_TOKEN` only:** no external secrets; login step gated to `push` events so
  fork PRs cannot trigger a push.
- **Image name lowercasing:** `tr '[:upper:]' '[:lower:]'` on `github.repository`
  satisfies ghcr.io's requirement without third-party actions.
- **Tags:** `sha-<short>` for traceability + `latest` only on main push via `metadata-action`.
- **BuildKit GHA cache** (`cache-from/to: type=gha, mode=max`) for fast rebuilds.

**Lasting heuristic:** gate the registry login and the `push:` flag both on
`github.event_name == 'push'` — omitting either one leaks credentials to fork PRs or
tries to push without auth and fails. A PR build that builds but does not push is the
correct security posture for public repos.

### 2026-08-19 — Tooling and README authored

Authored `pyproject.toml` (hatchling build, Python 3.12+, `fastapi>=0.115`,
`uvicorn[standard]>=0.30`, `pydantic>=2.8`, dev extras `pytest>=8.0` / `httpx>=0.27` /
`ruff>=0.6`, pytest testpaths, ruff config) and full `README.md` (setup, run, docs URL,
tests, lint, in-memory caveat, endpoint table, curl example using only contract-specified
fields — no invented fields).

- **Hatchling** chosen over setuptools for cleaner `pyproject.toml`-only configuration.
- **`pip install -e ".[dev]"`** is the single install command; no requirements files needed.
- The curl example in the README was composed field-for-field against the contract (§3)
  so it can serve as a manual smoke-test and a reference for Hockney's fixture.

### 2026-08-19 — Frontend architecture design review

Facilitated the frontend ceremony. Accepted plan in
`.squad/decisions/inbox/keaton-frontend-architecture.md`. Same FastAPI app, same
container, no Node.

- **Stack:** static HTML/CSS/ES-module vanilla JS under `app/static/`, served by
  Starlette `StaticFiles`. No bundler, no CDN, no new runtime dependency — the image
  already carries the assets via the existing `COPY app/ ./app/`.
- **Never mount `StaticFiles` at `/`.** A root mount is a catch-all and silently turns
  unknown `/api/v1/...` paths into HTML 404s, changing the documented error surface.
  Mount at `/static`, serve `/` with an explicit `FileResponse`, and set
  `include_in_schema=False` so the OpenAPI doc stays API-only.
- **Hash routing (`/#/alerts/:id`) instead of `pushState`** precisely because
  pushState would demand a server catch-all that reintroduces the collision above.
  Routing choice was driven by the server constraint, not by frontend taste.
- **Resolve the asset dir as `Path(__file__).parent / "static"`,** never CWD-relative:
  container `WORKDIR` is `/app` with the package at `/app/app`, and pytest runs from
  the repo root. Two different CWDs, one correct answer.
- **Form: structured fields primary, JSON tab as escape hatch.** JSON-only is not UX;
  structured-only is hostile to pasting a machine-generated 45-field payload. The seam
  is made safe by a single source of truth (the draft object) and by blocking the tab
  switch on parse failure rather than dropping data.
- **No `<select>` for `overall_status` / `priority_band` / `final_verdict`.** The
  contract has no enums; a dropdown would invent a constraint the backend lacks. Same
  discipline as the earlier "don't invent schema" correction, applied to widgets.
- **Account/bank identifiers stay `type="text"`** — they are strings with meaningful
  leading zeroes (decision #1b). A numeric input would corrupt them.
- **Edit uses PUT, not PATCH.** A full-form editor already produces a full body;
  PATCH would add a diffing code path for nothing. The predictable bug is forgetting
  to strip `id`/`created_at`/`updated_at`/`version` before submit — `extra="forbid"`
  turns that into a 422, so it gets a dedicated acceptance test.
- **Security gate:** no `innerHTML` with server data (build nodes, set `textContent`),
  no `eval`/inline handlers, restrictive CSP meta with no `unsafe-inline`, no
  third-party origins, no CORS middleware (same-origin by construction).
- **Ownership:** Kujan → `app/static/**`; Fenster → `app/main.py` only;
  Hockney → `tests/test_frontend.py`; Keaton → `README.md`, `pyproject.toml`,
  `.dockerignore`. No cross-editing.
- **Packaging watch item:** hatchling already bit this project once (decision #2).
  Acceptance requires verifying `app/static/*` actually lands in the wheel and the
  image, rather than assuming `packages = ["app"]` covers data files.

**Lasting heuristic:** when adding a UI to an existing API service, the first design
question is not the framework — it is *which URL space the UI is allowed to occupy*.
Pin the path allocation (`/`, `/static`, `/api/v1`, `/docs`, `/health`) and forbid
catch-all mounts before anything else; the client-side routing style then follows from
that constraint instead of fighting it.
