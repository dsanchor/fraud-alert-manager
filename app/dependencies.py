from __future__ import annotations

from .repository import FraudAlertRepository

# Single process-level repository instance.
_repository = FraudAlertRepository()


def get_repository() -> FraudAlertRepository:
    """FastAPI dependency that returns the process-level repository.

    Tests override this via app.dependency_overrides and call
    get_repository().clear() (or replace the instance) between cases.
    """
    return _repository
