from __future__ import annotations


def test_operation_ids_are_short_and_stable(client):
    paths = client.get("/openapi.json").json()["paths"]

    assert paths["/api/v1/fraud-alerts"]["post"]["operationId"] == "create_alert"
    assert paths["/api/v1/fraud-alerts"]["get"]["operationId"] == "list_alerts"
    assert paths["/api/v1/fraud-alerts/{alert_id}"]["get"]["operationId"] == "get_alert"
    assert paths["/api/v1/fraud-alerts/{alert_id}"]["put"]["operationId"] == "replace_alert"
    assert paths["/api/v1/fraud-alerts/{alert_id}"]["patch"]["operationId"] == "patch_alert"
    assert paths["/api/v1/fraud-alerts/{alert_id}"]["delete"]["operationId"] == "delete_alert"
    assert paths["/health"]["get"]["operationId"] == "health"