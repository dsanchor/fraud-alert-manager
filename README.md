# fraud-alert-manager

FastAPI CRUD service for structured fraud alert assessments. Stores data in-memory
(process lifetime only — all data is lost on restart).

---

## Setup

Requires **Python 3.12+**.

```bash
python -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -e ".[dev]"
```

---

## Running the server

```bash
uvicorn app.main:app --reload
```

The server starts on **http://127.0.0.1:8000**.

| URL | Purpose |
|-----|---------|
| `http://127.0.0.1:8000/docs` | Interactive OpenAPI UI (Swagger) |
| `http://127.0.0.1:8000/health` | Health check → `{"status": "ok"}` |

---

## Running tests

```bash
pytest
```

---

## Linting

```bash
ruff check .
```

---

## Persistence note

Storage is **in-memory only**. There is no database. Every restart empties the store.
This is intentional for v1 — persistence is deferred.

---

## Endpoints

| Method | Path | Success | Description |
|--------|------|---------|-------------|
| `POST` | `/api/v1/fraud-alerts` | `201` + `Location` | Create a new alert |
| `GET` | `/api/v1/fraud-alerts` | `200` | List alerts (`limit`, `offset`) |
| `GET` | `/api/v1/fraud-alerts/{id}` | `200` | Fetch one alert |
| `PUT` | `/api/v1/fraud-alerts/{id}` | `200` | Full replace |
| `PATCH` | `/api/v1/fraud-alerts/{id}` | `200` | Shallow top-level merge |
| `DELETE` | `/api/v1/fraud-alerts/{id}` | `204` | Delete an alert |

Collection query params: `limit` (default `50`, max `200`) and `offset` (default `0`).

Errors: `404` for unknown IDs, `422` for schema/validation failures (FastAPI native shapes).

---

## Example request

```bash
curl -s -X POST http://127.0.0.1:8000/api/v1/fraud-alerts \
  -H "Content-Type: application/json" \
  -d '{
    "overall_compliance": {
      "overall_status": "NON_COMPLIANT",
      "non_compliant_rule_count": 3,
      "potential_gap_rule_count": 1,
      "insufficient_data_rule_count": 0,
      "not_applicable_rule_count": 2,
      "compliant_rule_count": 5
    },
    "decision_support": {
      "calculation_version": "1.0.0",
      "calculation_inputs": {
        "highest_historical_context_level": 2,
        "non_compliant_rule_count": 3,
        "potential_gap_rule_count": 1,
        "insufficient_data_rule_count": 0,
        "not_applicable_rule_count": 2,
        "compliant_rule_count": 5
      },
      "investigation_priority": {
        "base_historical_context_score": 40.0,
        "potential_gap_points": 5.0,
        "insufficient_data_points": 0.0,
        "non_compliance_points": 30.0,
        "raw_score": 75.0,
        "score": 75.0,
        "maximum_score": 100.0,
        "priority_band": "HIGH"
      },
      "workflow_classification": {
        "final_verdict": "ESCALATE",
        "matched_rule_id": "RULE-042",
        "rationale": [
          "Multiple non-compliant rules detected.",
          "Historical context indicates elevated risk."
        ],
        "meaning": "This transaction requires immediate investigation.",
        "is_legal_conclusion": false,
        "establishes_money_laundering": false
      }
    },
    "regulatory_interpretation": {
      "summary": "Transaction flagged under AML screening criteria.",
      "key_findings": [
        "Pattern matches known typology.",
        "Counterparty is in a high-risk jurisdiction."
      ],
      "regulatory_relevance": "Subject to FATF Recommendation 16."
    }
  }' | python -m json.tool
```
