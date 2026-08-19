"""
Happy-path CRUD contract tests.

Each test starts with a clean repository (via the autouse fixture in conftest.py).
"""
from __future__ import annotations

import re

# ---------------------------------------------------------------------------
# Health
# ---------------------------------------------------------------------------

def test_health(client):
    resp = client.get("/health")
    assert resp.status_code == 200
    assert resp.json() == {"status": "ok"}


# ---------------------------------------------------------------------------
# POST — create
# ---------------------------------------------------------------------------

def test_post_returns_201(client, full_payload):
    resp = client.post("/api/v1/fraud-alerts", json=full_payload)
    assert resp.status_code == 201


def test_post_location_header(client, full_payload):
    resp = client.post("/api/v1/fraud-alerts", json=full_payload)
    location = resp.headers.get("location", "")
    body = resp.json()
    # Location is an absolute URL from TestClient (http://testserver/…)
    assert body["id"] in location
    assert "/api/v1/fraud-alerts/" in location


def test_post_response_contains_server_fields(client, full_payload):
    resp = client.post("/api/v1/fraud-alerts", json=full_payload)
    body = resp.json()
    assert "id" in body
    assert "created_at" in body
    assert "updated_at" in body
    assert body["version"] == 1


def test_post_id_is_uuid(client, full_payload):
    body = client.post("/api/v1/fraud-alerts", json=full_payload).json()
    uuid_re = re.compile(
        r"^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$",
        re.IGNORECASE,
    )
    assert uuid_re.match(body["id"]), f"id {body['id']!r} is not a v4 UUID"


def test_post_timestamps_are_iso_utc(client, full_payload):
    body = client.post("/api/v1/fraud-alerts", json=full_payload).json()
    # Must end with Z (UTC) and be parseable
    assert body["created_at"].endswith("Z"), body["created_at"]
    assert body["updated_at"].endswith("Z"), body["updated_at"]


def test_post_created_at_equals_updated_at(client, full_payload):
    body = client.post("/api/v1/fraud-alerts", json=full_payload).json()
    assert body["created_at"] == body["updated_at"]


def test_post_payload_round_trips(client, full_payload):
    body = client.post("/api/v1/fraud-alerts", json=full_payload).json()
    assert body["overall_compliance"] == full_payload["overall_compliance"]
    assert body["decision_support"] == full_payload["decision_support"]
    assert body["regulatory_interpretation"] == full_payload["regulatory_interpretation"]


# ---------------------------------------------------------------------------
# GET collection
# ---------------------------------------------------------------------------

def test_list_empty(client):
    resp = client.get("/api/v1/fraud-alerts")
    assert resp.status_code == 200
    body = resp.json()
    assert body["items"] == []
    assert body["total"] == 0


def test_list_envelope_keys(client, created_alert):
    resp = client.get("/api/v1/fraud-alerts")
    body = resp.json()
    assert set(body.keys()) >= {"items", "total", "limit", "offset"}


def test_list_contains_created_item(client, created_alert):
    resp = client.get("/api/v1/fraud-alerts")
    ids = [item["id"] for item in resp.json()["items"]]
    assert created_alert["id"] in ids


def test_list_total_reflects_count(client, full_payload):
    client.post("/api/v1/fraud-alerts", json=full_payload)
    client.post("/api/v1/fraud-alerts", json=full_payload)
    body = client.get("/api/v1/fraud-alerts").json()
    assert body["total"] == 2
    assert len(body["items"]) == 2


def test_list_default_limit_and_offset(client, created_alert):
    body = client.get("/api/v1/fraud-alerts").json()
    assert body["limit"] == 50
    assert body["offset"] == 0


# ---------------------------------------------------------------------------
# GET item
# ---------------------------------------------------------------------------

def test_get_item_200(client, created_alert):
    alert_id = created_alert["id"]
    resp = client.get(f"/api/v1/fraud-alerts/{alert_id}")
    assert resp.status_code == 200


def test_get_item_matches_post(client, created_alert):
    alert_id = created_alert["id"]
    resp = client.get(f"/api/v1/fraud-alerts/{alert_id}")
    assert resp.json() == created_alert


# ---------------------------------------------------------------------------
# PUT — full replace
# ---------------------------------------------------------------------------

def test_put_200(client, created_alert, full_payload):
    alert_id = created_alert["id"]
    resp = client.put(f"/api/v1/fraud-alerts/{alert_id}", json=full_payload)
    assert resp.status_code == 200


def test_put_increments_version(client, created_alert, full_payload):
    alert_id = created_alert["id"]
    body = client.put(f"/api/v1/fraud-alerts/{alert_id}", json=full_payload).json()
    assert body["version"] == 2


def test_put_updates_updated_at(client, created_alert, full_payload):
    alert_id = created_alert["id"]
    body = client.put(f"/api/v1/fraud-alerts/{alert_id}", json=full_payload).json()
    # updated_at must be >= created_at (may equal if very fast)
    assert body["updated_at"] >= created_alert["created_at"]


def test_put_preserves_created_at(client, created_alert, full_payload):
    alert_id = created_alert["id"]
    body = client.put(f"/api/v1/fraud-alerts/{alert_id}", json=full_payload).json()
    assert body["created_at"] == created_alert["created_at"]


def test_put_replaces_payload(client, created_alert, full_payload):
    import copy
    alert_id = created_alert["id"]
    modified = copy.deepcopy(full_payload)
    modified["overall_compliance"]["overall_status"] = "COMPLIANT"
    body = client.put(f"/api/v1/fraud-alerts/{alert_id}", json=modified).json()
    assert body["overall_compliance"]["overall_status"] == "COMPLIANT"


# ---------------------------------------------------------------------------
# PATCH — shallow top-level merge
# ---------------------------------------------------------------------------

def test_patch_200(client, created_alert, full_payload):
    alert_id = created_alert["id"]
    patch_body = {"regulatory_interpretation": full_payload["regulatory_interpretation"]}
    resp = client.patch(f"/api/v1/fraud-alerts/{alert_id}", json=patch_body)
    assert resp.status_code == 200


def test_patch_increments_version(client, created_alert, full_payload):
    alert_id = created_alert["id"]
    patch_body = {"regulatory_interpretation": full_payload["regulatory_interpretation"]}
    body = client.patch(f"/api/v1/fraud-alerts/{alert_id}", json=patch_body).json()
    assert body["version"] == 2


def test_patch_replaces_supplied_top_level_object(client, created_alert, full_payload):
    import copy
    alert_id = created_alert["id"]
    modified_ri = copy.deepcopy(full_payload["regulatory_interpretation"])
    modified_ri["summary"] = "Patched summary"
    body = client.patch(
        f"/api/v1/fraud-alerts/{alert_id}",
        json={"regulatory_interpretation": modified_ri},
    ).json()
    assert body["regulatory_interpretation"]["summary"] == "Patched summary"


def test_patch_leaves_untouched_objects_intact(client, created_alert, full_payload):
    alert_id = created_alert["id"]
    patch_body = {"regulatory_interpretation": full_payload["regulatory_interpretation"]}
    body = client.patch(f"/api/v1/fraud-alerts/{alert_id}", json=patch_body).json()
    assert body["overall_compliance"] == created_alert["overall_compliance"]
    assert body["decision_support"] == created_alert["decision_support"]


def test_patch_empty_body_is_noop(client, created_alert):
    """An empty PATCH is valid (all fields optional) and must return 200."""
    alert_id = created_alert["id"]
    resp = client.patch(f"/api/v1/fraud-alerts/{alert_id}", json={})
    assert resp.status_code == 200


# ---------------------------------------------------------------------------
# DELETE
# ---------------------------------------------------------------------------

def test_delete_204(client, created_alert):
    alert_id = created_alert["id"]
    resp = client.delete(f"/api/v1/fraud-alerts/{alert_id}")
    assert resp.status_code == 204


def test_delete_removes_item(client, created_alert):
    alert_id = created_alert["id"]
    client.delete(f"/api/v1/fraud-alerts/{alert_id}")
    resp = client.get(f"/api/v1/fraud-alerts/{alert_id}")
    assert resp.status_code == 404
