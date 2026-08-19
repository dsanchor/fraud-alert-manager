"""
Validation contract tests — every case must yield 422.

All tests assert on the FastAPI-native 422 body shape:
  {"detail": [{"loc": [...], "msg": "...", "type": "..."}]}

Repository is cleared between tests via the autouse fixture in conftest.py.
"""
from __future__ import annotations

import copy

BASE = "/api/v1/fraud-alerts"


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _assert_422(resp):
    assert resp.status_code == 422
    body = resp.json()
    assert "detail" in body
    assert isinstance(body["detail"], list)
    return body["detail"]


# ---------------------------------------------------------------------------
# POST — missing required top-level objects
# ---------------------------------------------------------------------------

def test_post_missing_overall_compliance(client, full_payload):
    payload = copy.deepcopy(full_payload)
    del payload["overall_compliance"]
    _assert_422(client.post(BASE, json=payload))


def test_post_missing_decision_support(client, full_payload):
    payload = copy.deepcopy(full_payload)
    del payload["decision_support"]
    _assert_422(client.post(BASE, json=payload))


def test_post_missing_regulatory_interpretation(client, full_payload):
    payload = copy.deepcopy(full_payload)
    del payload["regulatory_interpretation"]
    _assert_422(client.post(BASE, json=payload))


# ---------------------------------------------------------------------------
# POST — missing required nested fields
# ---------------------------------------------------------------------------

def test_post_missing_overall_status(client, full_payload):
    payload = copy.deepcopy(full_payload)
    del payload["overall_compliance"]["overall_status"]
    _assert_422(client.post(BASE, json=payload))


def test_post_missing_calculation_version(client, full_payload):
    payload = copy.deepcopy(full_payload)
    del payload["decision_support"]["calculation_version"]
    _assert_422(client.post(BASE, json=payload))


def test_post_missing_investigation_priority(client, full_payload):
    payload = copy.deepcopy(full_payload)
    del payload["decision_support"]["investigation_priority"]
    _assert_422(client.post(BASE, json=payload))


def test_post_missing_workflow_classification(client, full_payload):
    payload = copy.deepcopy(full_payload)
    del payload["decision_support"]["workflow_classification"]
    _assert_422(client.post(BASE, json=payload))


def test_post_missing_regulatory_summary(client, full_payload):
    payload = copy.deepcopy(full_payload)
    del payload["regulatory_interpretation"]["summary"]
    _assert_422(client.post(BASE, json=payload))


def test_post_missing_key_findings(client, full_payload):
    payload = copy.deepcopy(full_payload)
    del payload["regulatory_interpretation"]["key_findings"]
    _assert_422(client.post(BASE, json=payload))


# ---------------------------------------------------------------------------
# POST — wrong types
# ---------------------------------------------------------------------------

def test_post_non_compliant_rule_count_string(client, full_payload):
    payload = copy.deepcopy(full_payload)
    payload["overall_compliance"]["non_compliant_rule_count"] = "three"
    _assert_422(client.post(BASE, json=payload))


def test_post_is_legal_conclusion_not_bool(client, full_payload):
    # Pydantic v2 coerces truthy strings ("yes"/"no") to bool; use a dict which
    # cannot be coerced to bool and must raise a type error.
    payload = copy.deepcopy(full_payload)
    payload["decision_support"]["workflow_classification"]["is_legal_conclusion"] = {
        "not": "a bool"
    }
    _assert_422(client.post(BASE, json=payload))


def test_post_key_findings_not_list(client, full_payload):
    payload = copy.deepcopy(full_payload)
    payload["regulatory_interpretation"]["key_findings"] = "a single string"
    _assert_422(client.post(BASE, json=payload))


def test_post_rationale_not_list(client, full_payload):
    payload = copy.deepcopy(full_payload)
    payload["decision_support"]["workflow_classification"]["rationale"] = "single"
    _assert_422(client.post(BASE, json=payload))


# ---------------------------------------------------------------------------
# POST — negative counts (must be >= 0)
# ---------------------------------------------------------------------------

def test_post_negative_non_compliant_rule_count_top(client, full_payload):
    payload = copy.deepcopy(full_payload)
    payload["overall_compliance"]["non_compliant_rule_count"] = -1
    _assert_422(client.post(BASE, json=payload))


def test_post_negative_compliant_rule_count_top(client, full_payload):
    payload = copy.deepcopy(full_payload)
    payload["overall_compliance"]["compliant_rule_count"] = -5
    _assert_422(client.post(BASE, json=payload))


def test_post_negative_non_compliant_rule_count_inputs(client, full_payload):
    payload = copy.deepcopy(full_payload)
    payload["decision_support"]["calculation_inputs"]["non_compliant_rule_count"] = -1
    _assert_422(client.post(BASE, json=payload))


def test_post_negative_highest_historical_context_level(client, full_payload):
    payload = copy.deepcopy(full_payload)
    payload["decision_support"]["calculation_inputs"]["highest_historical_context_level"] = -1
    _assert_422(client.post(BASE, json=payload))


# ---------------------------------------------------------------------------
# POST — extra="forbid": unknown fields at top level and nested
# ---------------------------------------------------------------------------

def test_post_unknown_top_level_field(client, full_payload):
    payload = copy.deepcopy(full_payload)
    payload["invented_field"] = "should be rejected"
    detail = _assert_422(client.post(BASE, json=payload))
    locs = [str(e.get("loc")) for e in detail]
    assert any("invented_field" in loc for loc in locs)


def test_post_unknown_nested_field_in_overall_compliance(client, full_payload):
    payload = copy.deepcopy(full_payload)
    payload["overall_compliance"]["extra_field"] = "bad"
    _assert_422(client.post(BASE, json=payload))


def test_post_unknown_nested_field_in_decision_support(client, full_payload):
    payload = copy.deepcopy(full_payload)
    payload["decision_support"]["extra"] = "bad"
    _assert_422(client.post(BASE, json=payload))


def test_post_unknown_nested_field_in_workflow_classification(client, full_payload):
    payload = copy.deepcopy(full_payload)
    payload["decision_support"]["workflow_classification"]["ghost"] = True
    _assert_422(client.post(BASE, json=payload))


def test_post_unknown_nested_field_in_regulatory_interpretation(client, full_payload):
    payload = copy.deepcopy(full_payload)
    payload["regulatory_interpretation"]["extra"] = "bad"
    _assert_422(client.post(BASE, json=payload))


# ---------------------------------------------------------------------------
# PUT — same validation rules apply
# ---------------------------------------------------------------------------

def test_put_unknown_top_level_field(client, created_alert, full_payload):
    payload = copy.deepcopy(full_payload)
    payload["bogus"] = 99
    resp = client.put(f"{BASE}/{created_alert['id']}", json=payload)
    _assert_422(resp)


def test_put_negative_count(client, created_alert, full_payload):
    payload = copy.deepcopy(full_payload)
    payload["overall_compliance"]["potential_gap_rule_count"] = -1
    resp = client.put(f"{BASE}/{created_alert['id']}", json=payload)
    _assert_422(resp)


# ---------------------------------------------------------------------------
# PATCH — validation on supplied objects
# ---------------------------------------------------------------------------

def test_patch_supplied_object_with_negative_count(client, created_alert, full_payload):
    bad_oc = copy.deepcopy(full_payload["overall_compliance"])
    bad_oc["not_applicable_rule_count"] = -3
    resp = client.patch(f"{BASE}/{created_alert['id']}", json={"overall_compliance": bad_oc})
    _assert_422(resp)


def test_patch_supplied_object_with_unknown_field(client, created_alert, full_payload):
    bad_ri = copy.deepcopy(full_payload["regulatory_interpretation"])
    bad_ri["surprise"] = "field"
    resp = client.patch(f"{BASE}/{created_alert['id']}", json={"regulatory_interpretation": bad_ri})
    _assert_422(resp)


# ---------------------------------------------------------------------------
# Server-managed fields must be rejected when sent by client
# ---------------------------------------------------------------------------

def test_post_cannot_set_id(client, full_payload):
    payload = copy.deepcopy(full_payload)
    payload["id"] = "00000000-0000-4000-8000-000000000000"
    _assert_422(client.post(BASE, json=payload))


def test_post_cannot_set_version(client, full_payload):
    payload = copy.deepcopy(full_payload)
    payload["version"] = 99
    _assert_422(client.post(BASE, json=payload))


def test_post_cannot_set_created_at(client, full_payload):
    payload = copy.deepcopy(full_payload)
    payload["created_at"] = "2000-01-01T00:00:00Z"
    _assert_422(client.post(BASE, json=payload))


# ---------------------------------------------------------------------------
# Transaction extension — required fields
# ---------------------------------------------------------------------------

def test_post_missing_transaction_id(client, full_payload):
    """Top-level transaction_id is required."""
    payload = copy.deepcopy(full_payload)
    del payload["transaction_id"]
    _assert_422(client.post(BASE, json=payload))


def test_post_missing_transaction_information(client, full_payload):
    """transaction_information block is required."""
    payload = copy.deepcopy(full_payload)
    del payload["transaction_information"]
    _assert_422(client.post(BASE, json=payload))


def test_post_old_original_transaction_field_rejected(client, full_payload):
    """Sending the old original_transaction key must be rejected (unknown field)."""
    payload = copy.deepcopy(full_payload)
    payload["original_transaction"] = payload["transaction_information"].copy()
    detail = _assert_422(client.post(BASE, json=payload))
    locs = [str(e.get("loc")) for e in detail]
    assert any("original_transaction" in loc for loc in locs)


def test_post_nested_transaction_id_rejected(client, full_payload):
    """A transaction_id nested inside transaction_information must be rejected (extra=forbid)."""
    payload = copy.deepcopy(full_payload)
    payload["transaction_information"]["transaction_id"] = "TX-TEST-0001"
    detail = _assert_422(client.post(BASE, json=payload))
    locs = [str(e.get("loc")) for e in detail]
    assert any("transaction_id" in loc for loc in locs)


def test_post_missing_transaction_information_originator_name(client, full_payload):
    payload = copy.deepcopy(full_payload)
    del payload["transaction_information"]["originator_name"]
    _assert_422(client.post(BASE, json=payload))


def test_post_missing_transaction_information_origin_account(client, full_payload):
    payload = copy.deepcopy(full_payload)
    del payload["transaction_information"]["origin_account"]
    _assert_422(client.post(BASE, json=payload))


def test_post_missing_transaction_information_bank_origin(client, full_payload):
    payload = copy.deepcopy(full_payload)
    del payload["transaction_information"]["bank_origin"]
    _assert_422(client.post(BASE, json=payload))


def test_post_missing_transaction_information_beneficiary_name(client, full_payload):
    payload = copy.deepcopy(full_payload)
    del payload["transaction_information"]["beneficiary_name"]
    _assert_422(client.post(BASE, json=payload))


def test_post_missing_transaction_information_destination_account(client, full_payload):
    payload = copy.deepcopy(full_payload)
    del payload["transaction_information"]["destination_account"]
    _assert_422(client.post(BASE, json=payload))


def test_post_missing_transaction_information_bank_destination(client, full_payload):
    payload = copy.deepcopy(full_payload)
    del payload["transaction_information"]["bank_destination"]
    _assert_422(client.post(BASE, json=payload))


def test_post_missing_transaction_information_amount(client, full_payload):
    payload = copy.deepcopy(full_payload)
    del payload["transaction_information"]["amount"]
    _assert_422(client.post(BASE, json=payload))


def test_post_missing_transaction_information_currency(client, full_payload):
    payload = copy.deepcopy(full_payload)
    del payload["transaction_information"]["currency"]
    _assert_422(client.post(BASE, json=payload))


# ---------------------------------------------------------------------------
# Transaction extension — type constraints
# ---------------------------------------------------------------------------

def test_post_transaction_information_amount_must_be_number(client, full_payload):
    """amount must be a JSON number; a non-numeric string cannot be coerced and must be rejected.

    Note: Pydantic v2 default mode coerces numeric strings (e.g. "15000") to float.
    We use a non-numeric string to assert the field type is numeric, not free-form text.
    """
    payload = copy.deepcopy(full_payload)
    payload["transaction_information"]["amount"] = "fifteen thousand"
    _assert_422(client.post(BASE, json=payload))


def test_post_transaction_information_amount_dict_rejected(client, full_payload):
    payload = copy.deepcopy(full_payload)
    payload["transaction_information"]["amount"] = {"value": 15000}
    _assert_422(client.post(BASE, json=payload))


# ---------------------------------------------------------------------------
# Transaction extension — identifier fields stay strings
# ---------------------------------------------------------------------------

def test_post_transaction_information_bank_origin_integer_rejected(client, full_payload):
    """bank_origin must be a string so leading zeros are preserved; integer rejected."""
    payload = copy.deepcopy(full_payload)
    payload["transaction_information"]["bank_origin"] = 121  # loses leading zero
    _assert_422(client.post(BASE, json=payload))


# ---------------------------------------------------------------------------
# Transaction extension — extra="forbid" on transaction_information
# ---------------------------------------------------------------------------

def test_post_unknown_nested_field_in_transaction_information(client, full_payload):
    """Unknown fields inside transaction_information must be rejected."""
    payload = copy.deepcopy(full_payload)
    payload["transaction_information"]["ghost_field"] = "unexpected"
    detail = _assert_422(client.post(BASE, json=payload))
    locs = [str(e.get("loc")) for e in detail]
    assert any("ghost_field" in loc for loc in locs)
