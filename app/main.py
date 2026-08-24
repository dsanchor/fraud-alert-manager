from __future__ import annotations

import os
from pathlib import Path

from fastapi import FastAPI
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from .routes import router


def _public_base_url() -> str | None:
    configured_url = os.getenv("PUBLIC_BASE_URL")
    if configured_url:
        return configured_url.rstrip("/")

    app_name = os.getenv("CONTAINER_APP_NAME")
    dns_suffix = os.getenv("CONTAINER_APP_ENV_DNS_SUFFIX")
    if app_name and dns_suffix:
        return f"https://{app_name}.{dns_suffix}"

    revision_hostname = os.getenv("CONTAINER_APP_HOSTNAME")
    if revision_hostname:
        return f"https://{revision_hostname}"

    return None


public_base_url = _public_base_url()
app = FastAPI(
    title="Fraud Alert Manager",
    version="1.0.0",
    servers=[{"url": public_base_url}] if public_base_url else None,
)

app.include_router(router)


@app.get("/health", tags=["health"])
def health() -> dict:
    return {"status": "ok"}


_STATIC_DIR = Path(__file__).parent / "static"

if _STATIC_DIR.is_dir():
    app.mount("/static", StaticFiles(directory=_STATIC_DIR), name="static")

    @app.get("/", include_in_schema=False)
    def index() -> FileResponse:
        return FileResponse(_STATIC_DIR / "index.html", headers={"Cache-Control": "no-cache"})
