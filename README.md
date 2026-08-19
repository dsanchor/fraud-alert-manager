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
| `http://127.0.0.1:8000/` | **Web dashboard** — fraud alert manager UI |
| `http://127.0.0.1:8000/docs` | Interactive OpenAPI UI (Swagger) |
| `http://127.0.0.1:8000/health` | Health check → `{"status": "ok"}` |

---

## Web Dashboard

The dashboard is a responsive single-page application served from `/`, included in the same Docker container — **no Node build step required**.

### Dashboard features

- **List** — paginated table of all alerts; sortable and filterable via the API contract.
- **Detail** — read-only view of an alert, showing all transaction, compliance, decision support, and regulatory interpretation data.
- **Create** — structured form with sections mirroring the schema, plus a JSON editor tab for direct payload editing.
- **Edit** — full form edit with live validation; uses the same form as create.
- **Delete** — with confirmation modal before removal.

### Data editing

- **Structured form** — organized by schema section (transaction info, compliance status, decision support, regulatory context). Every field in the alert schema is reachable.
- **JSON editor (Advanced tab)** — paste or manually edit the full JSON payload. Tab switches serialize/parse through the draft object; invalid JSON blocks the switch and preserves your edits.
- **Client-side validation** — hints for numeric fields, required field checks, and field-level error messages from the server (422 responses) appear inline next to the input.

### Technical notes

- **Same-origin API** — all requests go to `/api/v1/fraud-alerts` on the same server; no external origins.
- **No framework, no build** — plain HTML, CSS, and ES modules served directly from `/static/`. The entire UI ships inside the existing Docker image.
- **Hash routing** — client-side navigation via `/#/alerts`, `/#/alerts/new`, etc. No server-side routing changes needed.
- **In-memory state** — the dashboard persists data via the same in-memory store as the API (see [Persistence note](#persistence-note) below). Refresh the page or restart the container to reset.

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

The `transaction_id` (top-level) and `transaction_information` (with account details, amount, and currency) identify and describe the transaction under assessment.

```bash
curl -s -X POST http://127.0.0.1:8000/api/v1/fraud-alerts \
  -H "Content-Type: application/json" \
  -d '{
    "transaction_id": "TX-TEST-0001",
    "transaction_information": {
      "originator_name": "James Carter",
      "origin_account": "83D4B1F30",
      "bank_origin": "0121",
      "beneficiary_name": "Emily Foster",
      "destination_account": "818CCA030",
      "bank_destination": "29196",
      "amount": 15000,
      "currency": "EUR"
    },
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
