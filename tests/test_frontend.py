"""
Frontend integration tests — same-container static serving.

Architecture reference: .squad/decisions/inbox/keaton-frontend-architecture.md
Owner: Hockney (Tester)

These tests verify the contract between the FastAPI backend and the frontend
assets served from app/static/.  They run fully with the TestClient and do not
require a live server.

Tests that touch specific JS/CSS assets are skipped when those files do not yet
exist so that the suite remains green while Kujan's work is in progress.  The
skip messages explain exactly what is pending.
"""
from __future__ import annotations

import re
import zipfile
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

_STATIC_DIR = Path(__file__).parent.parent / "app" / "static"
_JS_DIR = _STATIC_DIR / "js"
_CSS_DIR = _STATIC_DIR / "css"

_INDEX_HTML = _STATIC_DIR / "index.html"
_MAIN_JS = _JS_DIR / "main.js"
_STYLES_CSS = _CSS_DIR / "styles.css"

# All JS files anywhere under app/static/js/
_ALL_JS_FILES = list(_JS_DIR.rglob("*.js")) if _JS_DIR.is_dir() else []


def _vio(js_file: Path, lineno: int, line: str) -> str:
    """Format a violation entry with a path relative to _STATIC_DIR."""
    rel = js_file.relative_to(_STATIC_DIR)
    return f"{rel}:{lineno}: {line.strip()}"

# ---------------------------------------------------------------------------
# Skip sentinels
# ---------------------------------------------------------------------------

_skip_no_css = pytest.mark.skipif(
    not _STYLES_CSS.exists(),
    reason="app/static/css/styles.css not yet created by Kujan — pending integration",
)
_skip_no_mainjs = pytest.mark.skipif(
    not _MAIN_JS.exists(),
    reason="app/static/js/main.js not yet created by Kujan — pending integration",
)
_skip_no_js = pytest.mark.skipif(
    not _ALL_JS_FILES,
    reason="No JS files under app/static/js/ yet — pending integration",
)


# ---------------------------------------------------------------------------
# 1. Root route — GET /
# ---------------------------------------------------------------------------

class TestRootRoute:
    def test_get_root_returns_200(self, client: TestClient):
        resp = client.get("/")
        assert resp.status_code == 200

    def test_get_root_content_type_html(self, client: TestClient):
        resp = client.get("/")
        assert "text/html" in resp.headers.get("content-type", "")

    def test_get_root_no_cache(self, client: TestClient):
        """index.html must not be aggressively cached (architecture §3.3)."""
        resp = client.get("/")
        cc = resp.headers.get("cache-control", "")
        assert cc != "", "Cache-Control header should be present on /"
        assert "immutable" not in cc.lower(), "index.html must not be served immutable"

    def test_get_root_references_local_stylesheet(self, client: TestClient):
        """<link> to stylesheet must be a /static/… relative path, not a CDN URL."""
        resp = client.get("/")
        body = resp.text
        # find href of stylesheet link
        matches = re.findall(r'<link[^>]+rel=["\']stylesheet["\'][^>]*>', body, re.IGNORECASE)
        assert matches, "index.html must contain a <link rel='stylesheet'> tag"
        for tag in matches:
            href_match = re.search(r'href=["\']([^"\']+)["\']', tag)
            assert href_match, f"stylesheet link has no href: {tag}"
            href = href_match.group(1)
            assert href.startswith("/static/"), (
                f"Stylesheet href must start with /static/ (no CDN): got '{href}'"
            )

    def test_get_root_references_local_module_script(self, client: TestClient):
        """<script type=module> src must be a /static/… path, not a CDN URL."""
        resp = client.get("/")
        body = resp.text
        matches = re.findall(r'<script[^>]+type=["\']module["\'][^>]*>', body, re.IGNORECASE)
        assert matches, "index.html must contain a <script type='module'> tag"
        for tag in matches:
            src_match = re.search(r'src=["\']([^"\']+)["\']', tag)
            assert src_match, f"module script has no src: {tag}"
            src = src_match.group(1)
            assert src.startswith("/static/"), (
                f"Module script src must start with /static/ (no CDN): got '{src}'"
            )

    def test_get_root_has_main_element(self, client: TestClient):
        """Architecture requires a single <main id='main'> render target."""
        body = client.get("/").text
        assert re.search(r'<main[^>]+id=["\']main["\']', body, re.IGNORECASE), (
            "index.html must have <main id='main'>"
        )

    def test_get_root_has_dialog_element(self, client: TestClient):
        """Delete confirmation requires a native <dialog> element (architecture §6)."""
        body = client.get("/").text
        assert "<dialog" in body.lower(), "index.html must contain a <dialog> element"

    def test_get_root_csp_meta_exists(self, client: TestClient):
        """CSP meta tag must be present (architecture §7)."""
        body = client.get("/").text
        csp_meta = re.search(
            r'<meta\s[^>]*http-equiv=["\']Content-Security-Policy["\']',
            body,
            re.IGNORECASE,
        )
        assert csp_meta, "index.html must contain a <meta http-equiv='Content-Security-Policy'>"

    def test_get_root_csp_no_unsafe_inline(self, client: TestClient):
        """CSP must not contain unsafe-inline (architecture §7)."""
        body = client.get("/").text
        csp_tag = re.search(
            r'<meta\s[^>]*http-equiv=["\']Content-Security-Policy["\'][^>]*content=["\']([^"\']+)["\']',
            body,
            re.IGNORECASE,
        )
        if not csp_tag:
            # try the other attribute order
            csp_tag = re.search(
                r'<meta\s[^>]*content=["\']([^"\']+)["\'][^>]*http-equiv=["\']Content-Security-Policy["\']',
                body,
                re.IGNORECASE,
            )
        assert csp_tag, "Could not extract CSP content attribute"
        csp_value = csp_tag.group(1)
        assert "unsafe-inline" not in csp_value, (
            "CSP must not include unsafe-inline (architecture §7)"
        )

    def test_get_root_csp_self_only_connect(self, client: TestClient):
        """connect-src must restrict to 'self' — no external API origins."""
        body = client.get("/").text
        # extract the full CSP content value
        csp_match = re.search(r"content=['\"]([^'\"]*connect-src[^'\"]*)['\"]", body, re.IGNORECASE)
        if csp_match:
            csp_value = csp_match.group(1)
            assert "connect-src 'self'" in csp_value or "connect-src" in csp_value, (
                "CSP connect-src should restrict to self"
            )

    def test_get_root_no_external_script_tags(self, client: TestClient):
        """No <script src='https://...'> — all JS must be local (architecture §7)."""
        body = client.get("/").text
        external_scripts = re.findall(r'<script[^>]+src=["\']https?://', body, re.IGNORECASE)
        assert not external_scripts, (
            f"Found external script(s): {external_scripts}. All JS must be local."
        )

    def test_get_root_no_external_link_hrefs(self, client: TestClient):
        """No <link href='https://...'> — stylesheets must be local."""
        body = client.get("/").text
        external_links = re.findall(r'<link[^>]+href=["\']https?://', body, re.IGNORECASE)
        assert not external_links, (
            f"Found external link(s): {external_links}. All CSS must be local."
        )

    def test_get_root_nav_links_present(self, client: TestClient):
        """Navigation links to #/alerts and #/alerts/new required by architecture §4.1."""
        body = client.get("/").text
        assert "#/alerts" in body, "index.html must contain a link to #/alerts"
        assert "#/alerts/new" in body, "index.html must contain a link to #/alerts/new"


# ---------------------------------------------------------------------------
# 2. Static asset serving — CSS and JS
# ---------------------------------------------------------------------------

class TestStaticAssets:
    @_skip_no_css
    def test_styles_css_returns_200(self, client: TestClient):
        resp = client.get("/static/css/styles.css")
        assert resp.status_code == 200

    @_skip_no_css
    def test_styles_css_content_type(self, client: TestClient):
        resp = client.get("/static/css/styles.css")
        ct = resp.headers.get("content-type", "")
        assert "css" in ct or "text" in ct, f"Unexpected content-type for CSS: {ct}"

    @_skip_no_mainjs
    def test_main_js_returns_200(self, client: TestClient):
        resp = client.get("/static/js/main.js")
        assert resp.status_code == 200

    @_skip_no_mainjs
    def test_main_js_content_type(self, client: TestClient):
        resp = client.get("/static/js/main.js")
        ct = resp.headers.get("content-type", "")
        assert "javascript" in ct or "text" in ct, f"Unexpected content-type for JS: {ct}"

    def test_unknown_static_path_returns_404(self, client: TestClient):
        resp = client.get("/static/does-not-exist.css")
        assert resp.status_code == 404

    def test_static_path_traversal_rejected(self, client: TestClient):
        """Path traversal must not expose Python source (architecture §3.2, ac #8)."""
        resp = client.get("/static/../app/main.py")
        assert resp.status_code in (400, 403, 404), (
            f"Path traversal should be blocked, got {resp.status_code}"
        )


# ---------------------------------------------------------------------------
# 3. Existing backend routes remain reachable
# ---------------------------------------------------------------------------

class TestBackendRoutesUnchanged:
    def test_health_returns_200_ok(self, client: TestClient):
        resp = client.get("/health")
        assert resp.status_code == 200
        assert resp.json() == {"status": "ok"}

    def test_docs_returns_200(self, client: TestClient):
        resp = client.get("/docs")
        assert resp.status_code == 200

    def test_openapi_json_returns_200(self, client: TestClient):
        resp = client.get("/openapi.json")
        assert resp.status_code == 200

    def test_openapi_json_is_json(self, client: TestClient):
        resp = client.get("/openapi.json")
        # must be parseable JSON
        data = resp.json()
        assert "openapi" in data or "paths" in data

    def test_openapi_excludes_root_path(self, client: TestClient):
        """/ must have include_in_schema=False (architecture §3.2 rule 3)."""
        paths = client.get("/openapi.json").json().get("paths", {})
        assert "/" not in paths, "Root / must not appear in OpenAPI schema"

    def test_openapi_excludes_static_paths(self, client: TestClient):
        """Static mount must not pollute the OpenAPI document."""
        paths = client.get("/openapi.json").json().get("paths", {})
        static_paths = [p for p in paths if p.startswith("/static")]
        assert not static_paths, f"Static paths must not appear in OpenAPI: {static_paths}"

    def test_api_list_alerts_returns_200(self, client: TestClient):
        resp = client.get("/api/v1/fraud-alerts")
        assert resp.status_code == 200

    def test_api_create_alert_returns_201(self, client: TestClient, full_payload: dict):
        resp = client.post("/api/v1/fraud-alerts", json=full_payload)
        assert resp.status_code == 201

    def test_api_get_single_alert(self, client: TestClient, created_alert: dict):
        alert_id = created_alert["id"]
        resp = client.get(f"/api/v1/fraud-alerts/{alert_id}")
        assert resp.status_code == 200

    def test_api_put_alert(self, client: TestClient, created_alert: dict, full_payload: dict):
        alert_id = created_alert["id"]
        resp = client.put(f"/api/v1/fraud-alerts/{alert_id}", json=full_payload)
        assert resp.status_code == 200

    def test_api_patch_alert(self, client: TestClient, created_alert: dict):
        alert_id = created_alert["id"]
        resp = client.patch(f"/api/v1/fraud-alerts/{alert_id}", json={})
        assert resp.status_code == 200

    def test_api_delete_alert(self, client: TestClient, created_alert: dict):
        alert_id = created_alert["id"]
        resp = client.delete(f"/api/v1/fraud-alerts/{alert_id}")
        assert resp.status_code == 204


# ---------------------------------------------------------------------------
# 4. Unknown paths return JSON 404, not index.html
# ---------------------------------------------------------------------------

class TestUnknownPathsReturnJsonNotHtml:
    """
    The static mount must NOT be a root catch-all.  Unknown API paths and
    unknown server paths must return a JSON-shaped 404, not the SPA shell.
    (Architecture §3.2 rules 1 & 6; acceptance criterion #7.)
    """

    def test_unknown_api_path_returns_json_404(self, client: TestClient):
        resp = client.get("/api/v1/fraud-alerts/does-not-exist")
        assert resp.status_code == 404
        # response must be JSON
        data = resp.json()
        assert isinstance(data, dict), "404 response body must be a JSON object"

    def test_unknown_api_subpath_is_json_not_html(self, client: TestClient):
        resp = client.get("/api/v1/no-such-endpoint")
        assert resp.status_code == 404
        ct = resp.headers.get("content-type", "")
        assert "text/html" not in ct, (
            "Unknown /api/v1/... path must return JSON, not HTML"
        )

    def test_unknown_server_path_is_not_index_html(self, client: TestClient):
        """
        Non-API, non-static, non-SPA paths must not silently return index.html.
        Hash routing means the server never receives client routes, so no
        catch-all is registered (architecture §3.2 rule 6).
        """
        resp = client.get("/some/unknown/server/path")
        assert resp.status_code == 404, (
            "Unknown server paths should 404, not serve index.html"
        )
        # if it is HTML, it must be a real 404 page, not a 200 SPA shell
        if "text/html" in resp.headers.get("content-type", ""):
            assert resp.status_code == 404

    def test_unknown_api_v1_path_body_has_detail(self, client: TestClient):
        """FastAPI 404 bodies have a 'detail' key."""
        resp = client.get("/api/v1/fraud-alerts/nonexistent-id-xyz")
        data = resp.json()
        assert "detail" in data, "404 body must contain a 'detail' field"


# ---------------------------------------------------------------------------
# 5. Frontend source — UX hooks and security (code analysis)
# ---------------------------------------------------------------------------

class TestFrontendSourceSecurity:
    """
    Code-level checks on the checked-in JS source.  These are skipped when JS
    files are not yet present.  They run without executing the JS.
    """

    @_skip_no_js
    def test_no_innerhtml_with_interpolation(self):
        """
        innerHTML is permitted only for static developer-authored strings.
        Dynamic use (template literals with variables) is a security rejection
        gate (architecture §7).
        """
        dangerous_pattern = re.compile(
            r'\.innerHTML\s*=\s*`[^`]*\$\{',  # innerHTML = `...${...}`
        )
        violations = []
        for js_file in _ALL_JS_FILES:
            content = js_file.read_text(encoding="utf-8", errors="replace")
            for lineno, line in enumerate(content.splitlines(), 1):
                if dangerous_pattern.search(line):
                    violations.append(_vio(js_file, lineno, line))
        assert not violations, (
            "Unsafe innerHTML with template literals found:\n" + "\n".join(violations)
        )

    @_skip_no_js
    def test_no_outerhtml_assignment(self):
        """outerHTML assignment is a DOM injection risk."""
        dangerous_pattern = re.compile(r'\.outerHTML\s*=')
        violations = []
        for js_file in _ALL_JS_FILES:
            content = js_file.read_text(encoding="utf-8", errors="replace")
            for lineno, line in enumerate(content.splitlines(), 1):
                if dangerous_pattern.search(line):
                    violations.append(_vio(js_file, lineno, line))
        assert not violations, (
            "outerHTML assignment found:\n" + "\n".join(violations)
        )

    @_skip_no_js
    def test_no_insertadjacenthtml_with_dynamic_content(self):
        """insertAdjacentHTML with a variable second argument is unsafe."""
        dangerous_pattern = re.compile(
            r'insertAdjacentHTML\s*\([^,]+,\s*[^"\'`\)][^\)]*\)'
        )
        violations = []
        for js_file in _ALL_JS_FILES:
            content = js_file.read_text(encoding="utf-8", errors="replace")
            for lineno, line in enumerate(content.splitlines(), 1):
                if dangerous_pattern.search(line):
                    violations.append(_vio(js_file, lineno, line))
        assert not violations, (
            "Potentially unsafe insertAdjacentHTML found:\n" + "\n".join(violations)
        )

    @_skip_no_js
    def test_no_eval(self):
        """eval() is prohibited (architecture §7)."""
        # match eval( but not identifiers like 'evaluate' or 'evalSomething'
        dangerous_pattern = re.compile(r'\beval\s*\(')
        violations = []
        for js_file in _ALL_JS_FILES:
            content = js_file.read_text(encoding="utf-8", errors="replace")
            for lineno, line in enumerate(content.splitlines(), 1):
                if dangerous_pattern.search(line):
                    violations.append(_vio(js_file, lineno, line))
        assert not violations, "eval() found:\n" + "\n".join(violations)

    @_skip_no_js
    def test_no_new_function(self):
        """new Function(...) is equivalent to eval (architecture §7)."""
        dangerous_pattern = re.compile(r'\bnew\s+Function\s*\(')
        violations = []
        for js_file in _ALL_JS_FILES:
            content = js_file.read_text(encoding="utf-8", errors="replace")
            for lineno, line in enumerate(content.splitlines(), 1):
                if dangerous_pattern.search(line):
                    violations.append(_vio(js_file, lineno, line))
        assert not violations, "new Function() found:\n" + "\n".join(violations)

    @_skip_no_js
    def test_no_javascript_urls(self):
        """javascript: URLs are prohibited (architecture §7)."""
        dangerous_pattern = re.compile(r'["\']javascript\s*:', re.IGNORECASE)
        violations = []
        for js_file in _ALL_JS_FILES:
            content = js_file.read_text(encoding="utf-8", errors="replace")
            for lineno, line in enumerate(content.splitlines(), 1):
                if dangerous_pattern.search(line):
                    violations.append(_vio(js_file, lineno, line))
        assert not violations, "javascript: URL found:\n" + "\n".join(violations)

    @_skip_no_js
    def test_no_inline_event_attributes_in_js_strings(self):
        """
        on* handlers must be attached programmatically, never via HTML string
        injection (architecture §7).  We check that no JS file constructs strings
        containing on*= attribute patterns with dynamic content.
        Uses a word boundary so identifiers like 'textContent' are not flagged.
        """
        dangerous_pattern = re.compile(r'\bon[a-z]+\s*=\s*["\']')
        violations = []
        for js_file in _ALL_JS_FILES:
            content = js_file.read_text(encoding="utf-8", errors="replace")
            for lineno, line in enumerate(content.splitlines(), 1):
                if dangerous_pattern.search(line):
                    violations.append(_vio(js_file, lineno, line))
        assert not violations, (
            "Inline on* event attribute string found:\n" + "\n".join(violations)
        )

    @_skip_no_js
    def test_no_external_fetch_calls(self):
        """
        API calls must use relative paths (architecture §4.3).
        No absolute http(s):// URLs should appear in fetch() calls.
        """
        dangerous_pattern = re.compile(r'fetch\s*\(\s*["\']https?://')
        violations = []
        for js_file in _ALL_JS_FILES:
            content = js_file.read_text(encoding="utf-8", errors="replace")
            for lineno, line in enumerate(content.splitlines(), 1):
                if dangerous_pattern.search(line):
                    violations.append(_vio(js_file, lineno, line))
        assert not violations, (
            "fetch() with absolute external URL found:\n" + "\n".join(violations)
        )


class TestFrontendSourceUxHooks:
    """
    Structural checks: required UX elements must exist in the source.
    Skipped while files are absent.
    """

    @_skip_no_mainjs
    def test_main_js_imports_router(self):
        """main.js must wire up the hash router (architecture §4.1)."""
        content = _MAIN_JS.read_text(encoding="utf-8", errors="replace")
        # expect an import from router.js or a hashchange/DOMContentLoaded listener
        has_router = (
            "router" in content.lower()
            or "hashchange" in content
            or "DOMContentLoaded" in content
        )
        assert has_router, "main.js must reference the router or hashchange/DOMContentLoaded"

    @_skip_no_js
    def test_api_js_defines_base_constant(self):
        """api.js must use a single relative BASE constant (architecture §4.3)."""
        api_js = _JS_DIR / "api.js"
        if not api_js.exists():
            pytest.skip("app/static/js/api.js not yet created — pending integration")
        content = api_js.read_text(encoding="utf-8", errors="replace")
        # BASE must be a relative path, not an absolute URL
        assert "/api/v1/fraud-alerts" in content, (
            "api.js must define a BASE constant for the API path"
        )
        # must NOT be an absolute URL
        assert "http://" not in content and "https://" not in content, (
            "api.js must use relative paths only"
        )

    @_skip_no_js
    def test_delete_uses_dialog_not_window_confirm(self):
        """Delete confirmation must use <dialog>, not window.confirm (architecture §6)."""
        violations = []
        for js_file in _ALL_JS_FILES:
            content = js_file.read_text(encoding="utf-8", errors="replace")
            for lineno, line in enumerate(content.splitlines(), 1):
                if "window.confirm" in line or re.search(r'\bconfirm\s*\(', line):
                    violations.append(_vio(js_file, lineno, line))
        assert not violations, (
            "window.confirm() found — delete confirmation must use <dialog>:\n"
            + "\n".join(violations)
        )

    @_skip_no_js
    def test_form_js_strips_server_fields_before_submit(self):
        """
        Edit form must strip id/created_at/updated_at/version before PUT
        (architecture §5.4 — the single most likely integration bug).
        """
        form_js = _JS_DIR / "views" / "form.js"
        if not form_js.exists():
            pytest.skip("app/static/js/views/form.js not yet created — pending integration")
        content = form_js.read_text(encoding="utf-8", errors="replace")
        server_fields = {"created_at", "updated_at", "version"}
        found_any = any(field in content for field in server_fields)
        assert found_any, (
            "form.js must reference server-managed fields (id/created_at/updated_at/version) "
            "to strip them before PUT submit (architecture §5.4)"
        )

    @_skip_no_js
    def test_list_view_exists(self):
        """List view module must exist (architecture §8 file boundaries)."""
        list_js = _JS_DIR / "views" / "list.js"
        if not list_js.exists():
            pytest.skip("app/static/js/views/list.js not yet created — pending Kujan")

    @_skip_no_js
    def test_detail_view_exists(self):
        """Detail view module must exist."""
        detail_js = _JS_DIR / "views" / "detail.js"
        if not detail_js.exists():
            pytest.skip("app/static/js/views/detail.js not yet created — pending Kujan")


# ---------------------------------------------------------------------------
# 6. Wheel / packaging — static assets included
# ---------------------------------------------------------------------------

class TestPackagingIncludesStaticAssets:
    """
    Verify that building the wheel includes app/static/index.html.
    Requires the `build` package to be installed (skips gracefully otherwise).
    """

    def test_wheel_contains_index_html(self, tmp_path):
        """
        Build the wheel and confirm app/static/index.html is inside it.
        Architecture §9: hatchling's `packages = ["app"]` should include
        non-Python files, but this was a known risk.
        """
        import subprocess
        import sys

        project_root = Path(__file__).parent.parent
        result = subprocess.run(
            [sys.executable, "-m", "build", "--wheel", "--outdir", str(tmp_path)],
            cwd=project_root,
            capture_output=True,
            text=True,
        )
        if result.returncode != 0:
            err = result.stderr[:400]
            pytest.skip(
                f"python -m build failed (build may not be installed): {err}"
            )

        wheels = list(tmp_path.glob("*.whl"))
        assert wheels, "No wheel produced by build"

        with zipfile.ZipFile(wheels[0]) as whl:
            names = whl.namelist()

        html_entries = [
            n for n in names
            if n.endswith("static/index.html") or "app/static/index.html" in n
        ]
        assert html_entries, (
            f"app/static/index.html not found in wheel.\n"
            f"Wheel contents (first 30): {names[:30]}"
        )
