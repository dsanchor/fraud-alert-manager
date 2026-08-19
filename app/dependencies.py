from __future__ import annotations

from .repository import FraudAlertRepository
from .seed_data import startup_alerts

# Single process-level repository instance.
_repository = FraudAlertRepository()
for _alert_id, _payload in startup_alerts():
    _repository.create(_alert_id, _payload)


def get_repository() -> FraudAlertRepository:
    """FastAPI dependency that returns the process-level repository.

    Tests override this via app.dependency_overrides and call
    get_repository().clear() (or replace the instance) between cases.
    """
    return _repository
