from __future__ import annotations

from copy import deepcopy

from .models import FraudAlertCreate

_BASE_ALERT = {
    "transaction_id": "TX-2026-1000",
    "transaction_information": {
        "originator_name": "Sofia Ramirez",
        "origin_account": "83D4B1F30",
        "bank_origin": "0121",
        "beneficiary_name": "Harbor Point Supplies",
        "destination_account": "818CCA030",
        "bank_destination": "29196",
        "amount": 18400,
        "currency": "EUR",
    },
    "overall_compliance": {
        "overall_status": "NON_COMPLIANT",
        "non_compliant_rule_count": 3,
        "potential_gap_rule_count": 1,
        "insufficient_data_rule_count": 2,
        "not_applicable_rule_count": 4,
        "compliant_rule_count": 10,
    },
    "decision_support": {
        "calculation_version": "v2.1.0",
        "calculation_inputs": {
            "highest_historical_context_level": 2,
            "non_compliant_rule_count": 3,
            "potential_gap_rule_count": 1,
            "insufficient_data_rule_count": 2,
            "not_applicable_rule_count": 4,
            "compliant_rule_count": 10,
        },
        "investigation_priority": {
            "base_historical_context_score": 0.5,
            "potential_gap_points": 1.0,
            "insufficient_data_points": 0.5,
            "non_compliance_points": 3.0,
            "raw_score": 5.0,
            "score": 4.5,
            "maximum_score": 10.0,
            "priority_band": "HIGH",
        },
        "workflow_classification": {
            "final_verdict": "ESCALATE",
            "matched_rule_id": "RULE-007",
            "rationale": [
                "Multiple non-compliant rules detected",
                "Historical context indicates elevated risk",
            ],
            "meaning": "Case requires immediate escalation to a compliance officer",
            "is_legal_conclusion": False,
            "establishes_money_laundering": False,
        },
    },
    "regulatory_interpretation": {
        "summary": "Significant compliance gaps require immediate attention",
        "key_findings": [
            "Transaction pattern deviates from the established baseline",
            "Three rules were flagged as non-compliant",
        ],
        "regulatory_relevance": "Enhanced due diligence review required",
    },
}

_ALERT_VARIATIONS = (
    {},
    {
        "transaction_id": "TX-2026-1001",
        "originator_name": "Ethan Wallace",
        "beneficiary_name": "Summit Wholesale Inc",
        "amount": 52600,
        "currency": "USD",
        "status": "POTENTIAL_GAP",
        "priority": "MEDIUM",
        "verdict": "REVIEW",
    },
    {
        "transaction_id": "TX-2026-1002",
        "originator_name": "Baltic Export GmbH",
        "beneficiary_name": "Rowan Advisory Group",
        "amount": 11750,
        "currency": "GBP",
        "status": "INSUFFICIENT_DATA",
        "priority": "MEDIUM",
        "verdict": "REQUEST_INFORMATION",
    },
    {
        "transaction_id": "TX-2026-1003",
        "originator_name": "Maya Patel",
        "beneficiary_name": "Crescent Freight Co",
        "amount": 2875,
        "currency": "EUR",
        "status": "NON_COMPLIANT",
        "priority": "HIGH",
        "verdict": "ESCALATE",
    },
    {
        "transaction_id": "TX-2026-1004",
        "originator_name": "Alpine Services SA",
        "beneficiary_name": "Lucas Meyer",
        "amount": 132500,
        "currency": "CHF",
        "status": "NON_COMPLIANT",
        "priority": "CRITICAL",
        "verdict": "ESCALATE",
    },
)


def startup_alerts() -> list[tuple[str, FraudAlertCreate]]:
    alerts = []
    for index, variation in enumerate(_ALERT_VARIATIONS, start=1):
        data = deepcopy(_BASE_ALERT)
        transaction = data["transaction_information"]
        workflow = data["decision_support"]["workflow_classification"]
        priority = data["decision_support"]["investigation_priority"]

        data["transaction_id"] = variation.get("transaction_id", data["transaction_id"])
        transaction["originator_name"] = variation.get(
            "originator_name", transaction["originator_name"]
        )
        transaction["beneficiary_name"] = variation.get(
            "beneficiary_name", transaction["beneficiary_name"]
        )
        transaction["amount"] = variation.get("amount", transaction["amount"])
        transaction["currency"] = variation.get("currency", transaction["currency"])
        data["overall_compliance"]["overall_status"] = variation.get(
            "status", data["overall_compliance"]["overall_status"]
        )
        priority["priority_band"] = variation.get("priority", priority["priority_band"])
        workflow["final_verdict"] = variation.get("verdict", workflow["final_verdict"])

        alert_id = f"demo-alert-{index:03d}"
        alerts.append((alert_id, FraudAlertCreate.model_validate(data)))
    return alerts