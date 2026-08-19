from __future__ import annotations

import threading
from datetime import UTC, datetime

from .models import FraudAlert, FraudAlertCreate, FraudAlertUpdate


def _utcnow() -> datetime:
    return datetime.now(tz=UTC)


class FraudAlertRepository:
    """Thread-safe in-memory store ordered by insertion (created_at ascending)."""

    def __init__(self) -> None:
        self._store: dict[str, FraudAlert] = {}
        self._lock = threading.Lock()

    # ------------------------------------------------------------------
    # Write operations
    # ------------------------------------------------------------------

    def create(self, alert_id: str, payload: FraudAlertCreate) -> FraudAlert:
        now = _utcnow()
        alert = FraudAlert(
            id=alert_id,
            created_at=now,
            updated_at=now,
            version=1,
            **payload.model_dump(),
        )
        with self._lock:
            self._store[alert_id] = alert
        return alert.model_copy(deep=True)

    def replace(self, alert_id: str, payload: FraudAlertCreate) -> FraudAlert | None:
        with self._lock:
            existing = self._store.get(alert_id)
            if existing is None:
                return None
            updated = FraudAlert(
                id=alert_id,
                created_at=existing.created_at,
                updated_at=_utcnow(),
                version=existing.version + 1,
                **payload.model_dump(),
            )
            self._store[alert_id] = updated
            return updated.model_copy(deep=True)

    def update(self, alert_id: str, changes: FraudAlertUpdate) -> FraudAlert | None:
        with self._lock:
            existing = self._store.get(alert_id)
            if existing is None:
                return None
            # Shallow merge at the top level: only replace supplied objects.
            data = existing.model_dump()
            patch = changes.model_dump(exclude_none=True)
            data.update(patch)
            updated = FraudAlert(
                id=alert_id,
                created_at=existing.created_at,
                updated_at=_utcnow(),
                version=existing.version + 1,
                transaction_id=data["transaction_id"],
                transaction_information=data["transaction_information"],
                overall_compliance=data["overall_compliance"],
                decision_support=data["decision_support"],
                regulatory_interpretation=data["regulatory_interpretation"],
            )
            self._store[alert_id] = updated
            return updated.model_copy(deep=True)

    def delete(self, alert_id: str) -> bool:
        with self._lock:
            if alert_id not in self._store:
                return False
            del self._store[alert_id]
            return True

    # ------------------------------------------------------------------
    # Read operations
    # ------------------------------------------------------------------

    def get(self, alert_id: str) -> FraudAlert | None:
        with self._lock:
            alert = self._store.get(alert_id)
        return alert.model_copy(deep=True) if alert is not None else None

    def list(self, limit: int, offset: int) -> tuple[list[FraudAlert], int]:
        with self._lock:
            all_items = list(self._store.values())
        total = len(all_items)
        page = [a.model_copy(deep=True) for a in all_items[offset: offset + limit]]
        return page, total

    # ------------------------------------------------------------------
    # Test support
    # ------------------------------------------------------------------

    def clear(self) -> None:
        with self._lock:
            self._store.clear()
