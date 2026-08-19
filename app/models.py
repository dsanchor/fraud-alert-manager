from __future__ import annotations

from datetime import datetime
from typing import Annotated

from pydantic import BaseModel, ConfigDict, Field  # noqa: F401 (re-exported implicitly)

_NonNeg = Annotated[int, Field(ge=0)]


class OverallCompliance(BaseModel):
    model_config = ConfigDict(extra="forbid")

    overall_status: str
    non_compliant_rule_count: _NonNeg
    potential_gap_rule_count: _NonNeg
    insufficient_data_rule_count: _NonNeg
    not_applicable_rule_count: _NonNeg
    compliant_rule_count: _NonNeg


class CalculationInputs(BaseModel):
    model_config = ConfigDict(extra="forbid")

    highest_historical_context_level: _NonNeg
    non_compliant_rule_count: _NonNeg
    potential_gap_rule_count: _NonNeg
    insufficient_data_rule_count: _NonNeg
    not_applicable_rule_count: _NonNeg
    compliant_rule_count: _NonNeg


class InvestigationPriority(BaseModel):
    model_config = ConfigDict(extra="forbid")

    base_historical_context_score: float
    potential_gap_points: float
    insufficient_data_points: float
    non_compliance_points: float
    raw_score: float
    score: float
    maximum_score: float
    priority_band: str


class WorkflowClassification(BaseModel):
    model_config = ConfigDict(extra="forbid")

    final_verdict: str
    matched_rule_id: str
    rationale: list[str]
    meaning: str
    is_legal_conclusion: bool
    establishes_money_laundering: bool


class DecisionSupport(BaseModel):
    model_config = ConfigDict(extra="forbid")

    calculation_version: str
    calculation_inputs: CalculationInputs
    investigation_priority: InvestigationPriority
    workflow_classification: WorkflowClassification


class RegulatoryInterpretation(BaseModel):
    model_config = ConfigDict(extra="forbid")

    summary: str
    key_findings: list[str]
    regulatory_relevance: str


class TransactionInformation(BaseModel):
    """Client-owned record of the payment transaction under review."""

    model_config = ConfigDict(extra="forbid")

    originator_name: str
    origin_account: str
    bank_origin: str
    beneficiary_name: str
    destination_account: str
    bank_destination: str
    amount: float
    currency: str


class FraudAlertCreate(BaseModel):
    """Client-supplied payload for POST and PUT (full replace)."""

    model_config = ConfigDict(extra="forbid")

    transaction_id: str
    transaction_information: TransactionInformation
    overall_compliance: OverallCompliance
    decision_support: DecisionSupport
    regulatory_interpretation: RegulatoryInterpretation


class FraudAlertUpdate(BaseModel):
    """Partial payload for PATCH.

    Each top-level object is optional; supplying one replaces it whole.
    """

    model_config = ConfigDict(extra="forbid")

    transaction_id: str | None = None
    transaction_information: TransactionInformation | None = None
    overall_compliance: OverallCompliance | None = None
    decision_support: DecisionSupport | None = None
    regulatory_interpretation: RegulatoryInterpretation | None = None


class FraudAlert(BaseModel):
    """Full response model including server-managed fields."""

    model_config = ConfigDict(extra="forbid")

    id: str
    created_at: datetime
    updated_at: datetime
    version: int

    transaction_id: str
    transaction_information: TransactionInformation
    overall_compliance: OverallCompliance
    decision_support: DecisionSupport
    regulatory_interpretation: RegulatoryInterpretation
