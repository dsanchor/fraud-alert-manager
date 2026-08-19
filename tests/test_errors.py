"""
Error-path and pagination tests.

Covers:
- 404 on GET / PUT / PATCH / DELETE for unknown IDs
- limit/offset pagination semantics
"""
from __future__ import annotations

import uuid

BASE = "/api/v1/fraud-alerts"
UNKNOWN_ID = str(uuid.uuid4())


# ---------------------------------------------------------------------------
# 404 — unknown ID
# ---------------------------------------------------------------------------

def test_get_item_unknown_id(client):
    resp = client.get(f"{BASE}/{UNKNOWN_ID}")
    assert resp.status_code == 404
    assert "detail" in resp.json()


def test_put_unknown_id(client, full_payload):
    resp = client.put(f"{BASE}/{UNKNOWN_ID}", json=full_payload)
    assert resp.status_code == 404
    assert "detail" in resp.json()


def test_patch_unknown_id(client, full_payload):
    resp = client.patch(f"{BASE}/{UNKNOWN_ID}", json={})
    assert resp.status_code == 404
    assert "detail" in resp.json()


def test_delete_unknown_id(client):
    resp = client.delete(f"{BASE}/{UNKNOWN_ID}")
    assert resp.status_code == 404
    assert "detail" in resp.json()


# ---------------------------------------------------------------------------
# Pagination — limit and offset
# ---------------------------------------------------------------------------

def _populate(client, payload, count: int) -> list[str]:
    ids = []
    for _ in range(count):
        resp = client.post(BASE, json=payload)
        ids.append(resp.json()["id"])
    return ids


def test_pagination_limit(client, full_payload):
    _populate(client, full_payload, 5)
    resp = client.get(f"{BASE}?limit=2")
    body = resp.json()
    assert resp.status_code == 200
    assert len(body["items"]) == 2
    assert body["limit"] == 2
    assert body["total"] == 5


def test_pagination_offset(client, full_payload):
    ids = _populate(client, full_payload, 4)
    resp = client.get(f"{BASE}?limit=10&offset=2")
    body = resp.json()
    assert len(body["items"]) == 2
    assert body["offset"] == 2
    # The first two items must be those at index 2 and 3 (insertion order)
    returned_ids = [item["id"] for item in body["items"]]
    assert returned_ids == ids[2:]


def test_pagination_offset_beyond_total(client, full_payload):
    _populate(client, full_payload, 2)
    resp = client.get(f"{BASE}?limit=10&offset=10")
    body = resp.json()
    assert resp.status_code == 200
    assert body["items"] == []
    assert body["total"] == 2


def test_pagination_limit_max_200(client, full_payload):
    resp = client.get(f"{BASE}?limit=201")
    assert resp.status_code == 422


def test_pagination_limit_min_1(client, full_payload):
    resp = client.get(f"{BASE}?limit=0")
    assert resp.status_code == 422


def test_pagination_negative_offset(client):
    resp = client.get(f"{BASE}?offset=-1")
    assert resp.status_code == 422


def test_pagination_default_values(client, full_payload):
    _populate(client, full_payload, 3)
    body = client.get(BASE).json()
    assert body["limit"] == 50
    assert body["offset"] == 0
