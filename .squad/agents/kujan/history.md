# Project Context

- **Owner:** Copilot
- **Project:** FastAPI fraud alert manager with API and same-container web UI
- **Stack:** Python, FastAPI, Pydantic, HTML, CSS, JavaScript, pytest
- **Created:** 2026-08-19T15:08:57.241+02:00

## Learnings

### 2026-08-19 — Full SPA built under app/static/

**Deliverables:**
- `app/static/index.html` — shell with CSP meta, landmarks, dialog, skip-link, module script
- `app/static/css/styles.css` — design tokens, dark mode, reduced-motion, responsive layout
- `app/static/js/main.js` — bootstrap, route registration
- `app/static/js/router.js` — hashchange-based router, regex-named-groups pattern matching
- `app/static/js/api.js` — fetch wrapper, ApiError class, 422-to-field-map helper
- `app/static/js/state.js` — state object, stripServerFields, deepClone
- `app/static/js/dom.js` — safe element builders (textContent only, no innerHTML with data)
- `app/static/js/ui.js` — toast, confirmDialog (native <dialog>), aria-busy helpers
- `app/static/js/views/list.js` — dashboard with metrics, table (desktop) + cards (mobile), skeleton, empty, error, pagination, delete
- `app/static/js/views/detail.js` — full detail view, 404 handling, server meta strip, delete
- `app/static/js/views/form.js` — create/edit, all 45 fields, structured tabs + JSON tab sync, list editors, 422 mapping, client validation

**Key decisions / patterns:**
- All dynamic DOM uses `document.createElement` + `textContent`/`value` — zero innerHTML with data
- No eval, no inline handlers, no external origins
- CSP meta: `default-src 'self'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'`
- Server fields (id, created_at, updated_at, version) stripped before PUT via `stripServerFields()`
- JSON↔structured tab sync: switching TO json serialises draft; switching AWAY parses (blocks on invalid JSON)
- Native `<dialog>` for delete confirmation; cancel gets initial focus
- `prefers-color-scheme` dark mode via CSS custom properties
- `prefers-reduced-motion` via animation-duration:0 override
- All 9 JS files pass `node --check`; no innerHTML/eval/inline-handlers/external URLs found in security scan

**Depends on Fenster** to wire `app/main.py` with `StaticFiles` mount at `/static` and `FileResponse` at `/`.
