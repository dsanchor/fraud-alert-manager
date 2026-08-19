# Project Context

- **Owner:** Copilot
- **Project:** FastAPI CRUD service for structured fraud alerts
- **Stack:** Python, FastAPI, Pydantic, in-memory persistence, pytest
- **Created:** 2026-08-19T13:21:28.482+02:00

## Learnings

- **2026-08-19:** `url_for` requires the route to have a `name=` kwarg; set `name="get_alert"` on the item GET so the POST Location header resolves correctly.
- **2026-08-19:** `response_model=dict` on the list endpoint is the simplest way to return a typed envelope without a second Pydantic model; keep response shapes explicit via inline dicts.
- **2026-08-19:** Dependency override pattern: expose `get_repository()` returning the module-level `_repository`; tests replace via `app.dependency_overrides[get_repository] = lambda: test_repo` and call `.clear()` between cases.
- **2026-08-19:** Static frontend wiring pattern: resolve `_STATIC_DIR = Path(__file__).parent / "static"` relative to the module, not CWD. Guard `app.mount` and `@app.get("/")` behind `_STATIC_DIR.is_dir()` so tests and imports work before Kujan's frontend assets exist without swallowing any real errors. Mount only at `/static`; serve `index.html` via an explicit `FileResponse` at `GET /` with `include_in_schema=False` and `Cache-Control: no-cache`. Never mount at `/` — that is a catch-all and would break API 404 semantics. All 87 existing tests pass unchanged.
