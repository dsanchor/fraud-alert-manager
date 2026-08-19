from __future__ import annotations

from fastapi import FastAPI

from .routes import router

app = FastAPI(title="Fraud Alert Manager", version="1.0.0")

app.include_router(router)


@app.get("/health", tags=["health"])
def health() -> dict:
    return {"status": "ok"}
