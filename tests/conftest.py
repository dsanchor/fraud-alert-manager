"""
Shared fixtures and TestClient setup for the fraud-alert-manager test suite.

The repository is cleared between every test so each case is fully isolated.
The override uses FastAPI's dependency_overrides so the real singleton is
never touched and the app module is never mutated between tests.
"""
from __future__ import annotations

import json
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.dependencies import get_repository
from app.main import app
from app.repository import FraudAlertRepository

FIXTURES_DIR = Path(__file__).parent / "fixtures"


# ---------------------------------------------------------------------------
# Isolated repository
# ---------------------------------------------------------------------------

_test_repo = FraudAlertRepository()


def _get_test_repository() -> FraudAlertRepository:
    return _test_repo


app.dependency_overrides[get_repository] = _get_test_repository


@pytest.fixture(autouse=True)
def clear_repository():
    """Reset the in-memory store before every test."""
    _test_repo.clear()
    yield
    _test_repo.clear()


# ---------------------------------------------------------------------------
# TestClient
# ---------------------------------------------------------------------------

@pytest.fixture(scope="session")
def client() -> TestClient:
    return TestClient(app)


# ---------------------------------------------------------------------------
# Payload helpers
# ---------------------------------------------------------------------------

@pytest.fixture(scope="session")
def full_payload() -> dict:
    """The canonical user-supplied payload, loaded once per session."""
    return json.loads((FIXTURES_DIR / "full_alert.json").read_text())


@pytest.fixture()
def created_alert(client: TestClient, full_payload: dict) -> dict:
    """POST a single alert and return the response body."""
    resp = client.post("/api/v1/fraud-alerts", json=full_payload)
    assert resp.status_code == 201
    return resp.json()
