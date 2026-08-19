# Project Context

- **Owner:** Copilot
- **Project:** FastAPI CRUD service for structured fraud alerts
- **Stack:** Python, FastAPI, Pydantic, in-memory persistence, pytest
- **Created:** 2026-08-19T13:21:28.482+02:00

## Learnings

### 2026-08-19 — Initial test suite authored

**Task:** Authored full contract test suite from the Keaton API contract (`keaton-fraud-alert-api-contract.md`).

**Files created:**
- `tests/conftest.py` — TestClient + isolated `FraudAlertRepository` via `dependency_overrides`; `autouse` fixture clears repo before every test.
- `tests/fixtures/full_alert.json` — canonical payload (user-supplied values, verbatim).
- `tests/test_crud.py` — happy-path: health, POST 201 + Location, list envelope/pagination defaults, GET item, PUT (full replace, version increment, timestamp semantics), PATCH (shallow top-level merge, empty PATCH noop), DELETE 204.
- `tests/test_validation.py` — 422 cases: missing required fields at every depth, wrong types, negative counts on all count fields, `extra="forbid"` at top-level and all nested objects, rejection of server-managed fields (`id`, `version`, `created_at`).
- `tests/test_errors.py` — 404 on GET/PUT/PATCH/DELETE; limit/offset pagination edge cases (max 200, min 1, negative offset, offset beyond total, default values).

**Patterns learned:**
- Use `dependency_overrides` to inject a test-scoped repo without mutating module globals.
- `autouse` clear-before-each gives deterministic isolation even when pytest reorders tests.
- Assert on `detail[].loc` to confirm Pydantic v2 surfaces the right field path, not just the status code.
- Treat empty PATCH `{}` as a valid noop (all top-level fields optional in `FraudAlertUpdate`).
- Pagination default values (`limit=50`, `offset=0`) must be asserted explicitly; they are part of the observable contract.

### 2026-08-19 — End-to-end validation run

**Result:** All 67 pytest tests pass. Hockney-owned lint clean.

**Two test bugs found and fixed (Hockney files only):**

1. `test_post_location_header` — TestClient `url_for` returns an absolute URL
   (`http://testserver/...`). My assertion used `startswith("/api/v1/...")`. Fixed to
   `"/api/v1/fraud-alerts/" in location`.

2. `test_post_is_legal_conclusion_not_bool` — Pydantic v2 coerces well-known boolean
   strings (`"yes"`, `"no"`, `"true"`, `"false"`) to `bool` without raising a validation
   error. Fixed to pass a `dict` value, which Pydantic v2 cannot coerce to `bool`.

**Three lint issues in production files (not Hockney's to fix):**

| File | Rule | Description | Owner |
|------|------|-------------|-------|
| `app/models.py:1` | `I001` | Import block un-sorted | McManus |
| `app/models.py:86` | `E501` | Line too long (105 > 100) | McManus |
| `app/repository.py:10` | `UP017` | Use `datetime.UTC` alias | McManus |

**Patterns learned:**
- Pydantic v2 bool coercion is wide: strings `"yes"/"no"/"true"/"false"` all succeed.
  Use `dict` or another genuinely non-coercible type to test bool type rejection.
- FastAPI `TestClient` + `url_for` produces absolute URLs (`http://testserver/...`).
  Test with `in` rather than `startswith("/")`.

### 2026-08-19 — End-to-end review: assembled transaction extension

**Task:** Full validation pass after McManus + Fenster changes landed.

**Checks performed:**
- `pytest tests/ -v` — 87/87 pass ✅
- `ruff check` on all changed Python files — clean ✅
- `python3 -m pip wheel . --no-deps` — wheel built: `fraud_alert_manager-0.1.0-py3-none-any.whl` ✅
- Wheel content inspection — `app/` package present and importable ✅
- Repository `update()` semantics — correct shallow merge via `exclude_none=True` patch ✅
- README example payload — matches fixture exactly (all 9 `original_transaction` fields, `amount: 15000` as number, `bank_origin: "0121"` as string) ✅
- Build artifacts — `wheel_out_hockney_review/` dir created for review, cleaned up before verdict ✅

**One test defect found and corrected (Hockney files only):**

`test_post_original_transaction_amount_must_be_number` — original used `"15000"` (numeric string). Pydantic v2 default mode coerces numeric strings to `float`, so the test received 201 instead of 422. Fixed to `"fifteen thousand"` — a non-coercible string that correctly triggers a validation error.

**One open finding (not blocking, owner: Keaton):**

`.gitignore` does not cover `dist/`, `build/`, or wheel output directories. If any team member runs `pip wheel` locally the artefacts will show as untracked. Recommend adding `dist/`, `build/`, `*.whl` to `.gitignore`.

**Verdict: APPROVED**



**Task:** Added `transaction_id` / `original_transaction` to the canonical fixture and authored covering tests (contract + validation).

**Files changed:**
- `tests/fixtures/full_alert.json` — added top-level `transaction_id: "TX-TEST-0001"` and `original_transaction` block with all 9 required fields (exact user-specified values).
- `tests/test_crud.py` — added 4 round-trip assertions: top-level `transaction_id` unchanged, full `original_transaction` object equality, identifier strings with leading zeros preserved (`bank_origin: "0121"`, etc.), `amount` is JSON number.
- `tests/test_validation.py` — added 20 new 422-cases: missing top-level `transaction_id`; missing `original_transaction`; each of the 9 nested fields missing individually; `amount` as string or dict (must be number); `bank_origin` and `transaction_id` as integer (must be string); unknown field inside `original_transaction` rejected with loc check. No rule requiring top-level and nested `transaction_id` to match — user did not specify that constraint.

**Status:** 87 tests collected (was 67 + 20 new). 42 CRUD+error tests pass. New transaction tests are expected to fail until McManus lands the schema update.

**Patterns learned:**
- Strict-mode (`extra="forbid"`) must be applied to the new `OriginalTransaction` sub-model too.
- Identifier fields like `bank_origin` ("0121") must be declared as `str` in the model, not `int`, to preserve leading zeros through round-trips.
- Splitting "amount is string" and "amount is dict" into two tests gives clearer failure messages.



**Result:** RECHAZADO — un defecto bloqueante en `.dockerignore`.

**Análisis estático realizado (Docker no disponible en el entorno).**

**Hallazgos por componente:**

**Dockerfile — todo correcto salvo el contexto de build:**
- Imagen multi-stage: builder instala con hatchling; runtime copia sólo site-packages y binario uvicorn. ✅
- Usuario no-root (`appuser`) aplicado antes de `CMD`. ✅
- HEALTHCHECK usa `python -c "import urllib.request; ..."` — Python siempre disponible en `python:3.12-slim`. ✅
- `CMD ["uvicorn", "app.main:app", ...]` correcto; endpoint `/health` existe en `app/main.py`. ✅

**Defecto bloqueante — `.dockerignore` excluye `README.md`:**
- Regla `*.md` en `.dockerignore` elimina `README.md` del contexto de build.
- La instrucción `COPY pyproject.toml README.md ./` en el builder stage fallará con «file not found in build context».
- `docker build` no puede completarse tal como está configurado.

**Corrección requerida:** Añadir `!README.md` debajo de `*.md` en `.dockerignore`, o excluir sólo los markdown de documentación de forma explícita.

**Workflow `publish-container.yml` — todo correcto:**
- Triggers, permisos mínimos, GHCR auth con GITHUB_TOKEN, lowercase de imagen, tags `latest`+SHA, no-push en PR, login condicional en push. ✅
- Versiones de acciones (checkout@v4, setup-buildx-action@v3, login-action@v3, metadata-action@v5, build-push-action@v6) en major releases actuales. ✅

**Propietario de corrección:** McManus (por reviewer lockout de Keaton; McManus gestiona empaquetado).

**Patrones aprendidos:**
- `.dockerignore` se aplica al contexto de build ANTES de ejecutar cualquier `COPY`; una wildcard `*.md` bloquea archivos que el Dockerfile intente copiar explícitamente.
- Siempre cruzar `.dockerignore` con cada instrucción `COPY` del Dockerfile.

### 2026-08-19 — Schema normalization: original_transaction → transaction_information

**Task:** Update tests and fixture for the normalized transaction schema per user decision.

**Files changed:**
- `tests/fixtures/full_alert.json` — renamed key `original_transaction` → `transaction_information`; removed nested `transaction_id` field (9 fields → 8: originator_name, origin_account, bank_origin, beneficiary_name, destination_account, bank_destination, amount, currency).
- `tests/test_crud.py` — renamed all `original_transaction` references to `transaction_information`; removed assertion on `ot["transaction_id"]` (no longer present in nested block).
- `tests/test_validation.py` — full overhaul of transaction section:
  - `test_post_missing_transaction_information` — required field.
  - `test_post_old_original_transaction_field_rejected` — sending the old key must 422 with loc containing `original_transaction`.
  - `test_post_nested_transaction_id_rejected` — sending `transaction_id` inside `transaction_information` must 422 (extra=forbid).
  - All 8 nested required-field tests (no more `transaction_id` test).
  - Numeric/string type tests updated to `transaction_information` key.
  - `extra="forbid"` unknown-field test updated to `transaction_information`.
  - Removed `test_post_original_transaction_transaction_id_integer_rejected` (field no longer exists).

**Status:** Tests updated and ready. Expected to fail until McManus updates the production model. Top-level `transaction_id: "TX-TEST-0001"` preserved unchanged.

### 2026-08-19 — Full integrated quality gate: schema normalization

**Verdict: APPROVED ✅**

**Checks performed:**
- `pytest tests/ -v` — **87/87 PASSED** ✅
- `ruff check app/ tests/` — **All checks passed** ✅
- Fixture integrity: root `transaction_id: "TX-TEST-0001"` ✓, `transaction_information` 8-field block matches exactly, no `original_transaction`, no nested `transaction_id` ✓
- README: `original_transaction` absent ✓, `transaction_information` present ✓, no nested `transaction_id` in any JSON block ✓
- Wheel build (`pip wheel . --no-deps`) — succeeded ✅
- Wheel import (`from app.models import TransactionInformation`) — fields: `['originator_name', 'origin_account', 'bank_origin', 'beneficiary_name', 'destination_account', 'bank_destination', 'amount', 'currency']` ✅
- Round-trip coverage confirmed: POST/GET/PUT/PATCH all pass; `original_transaction` rejected (422 + loc); nested `transaction_id` rejected (422 + loc) ✅
- Temporary artifacts (`wheel_review_hockney/`) cleaned ✅

No test defects found. No production/docs edits made.

