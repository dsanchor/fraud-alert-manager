# Project Context

- **Owner:** Copilot
- **Project:** FastAPI CRUD service for structured fraud alerts
- **Stack:** Python, FastAPI, Pydantic, in-memory persistence, pytest
- **Created:** 2026-08-19T13:21:28.482+02:00

## Work Log

- **2026-08-19** Implemented `app/__init__.py`, `app/models.py`, `app/repository.py` per
  Keaton's accepted contract (keaton-fraud-alert-api-contract.md).
  - 9 Pydantic v2 models, all `extra="forbid"`, non-negative counts enforced with
    `Annotated[int, Field(ge=0)]`.
  - `FraudAlertCreate` (POST/PUT), `FraudAlertUpdate` (PATCH, all-optional), `FraudAlert`
    (full response with server-managed fields).
  - `FraudAlertRepository`: `threading.Lock` for concurrency safety; `model_copy(deep=True)`
    on every read/write to prevent mutable state leaks; insertion-ordered dict preserves
    `created_at` ascending order; shallow top-level merge in `update`.

- **2026-08-19** Renamed `OriginalTransaction` → `TransactionInformation`; renamed field `original_transaction` → `transaction_information` in all three alert models; removed nested `transaction_id` from the nested object. Repository `update` key updated to match. Ruff clean.

## Learnings

- **`Annotated[int, Field(ge=0)]`** as a type alias is the cleanest Pydantic v2 idiom for
  non-negative integer constraints shared across many fields.
- **`model_copy(deep=True)`** on every repository exit point prevents callers from
  accidentally mutating stored state — essential when the store is just a dict of objects.
- FastAPI runs sync route handlers in a thread-pool, so a `threading.Lock` (not asyncio)
  is the correct concurrency primitive for a sync in-memory repository.
- **`ruff check --fix`** is safe for I001 import-sorting; always inspect the result before
  committing — confirm no unintended changes. For E501 in docstrings, split manually.
  `datetime.UTC` (Python 3.11+) is the modern alias for `timezone.utc`; ruff UP017
  enforces this.
- **2026-08-19** Resolved 3 ruff findings (I001, E501, UP017) in owned files only. All
  67 tests remained green.

