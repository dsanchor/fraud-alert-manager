from __future__ import annotations

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response

from .dependencies import get_repository
from .models import FraudAlert, FraudAlertCreate, FraudAlertUpdate
from .repository import FraudAlertRepository

router = APIRouter(prefix="/api/v1/fraud-alerts", tags=["fraud-alerts"])

Repo = Annotated[FraudAlertRepository, Depends(get_repository)]


class AlertListResponse:
    """Not a Pydantic model — built inline to keep the response shape explicit."""


@router.post("", status_code=201, response_model=FraudAlert, operation_id="create_alert")
def create_alert(
    payload: FraudAlertCreate,
    request: Request,
    response: Response,
    repo: Repo,
) -> FraudAlert:
    alert_id = str(uuid.uuid4())
    alert = repo.create(alert_id, payload)
    response.headers["Location"] = str(request.url_for("get_alert", alert_id=alert_id))
    return alert


@router.get("", response_model=dict, operation_id="list_alerts")
def list_alerts(
    repo: Repo,
    limit: Annotated[int, Query(ge=1, le=200)] = 50,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> dict:
    items, total = repo.list(limit=limit, offset=offset)
    return {
        "items": [item.model_dump() for item in items],
        "total": total,
        "limit": limit,
        "offset": offset,
    }


@router.get(
    "/{alert_id}", response_model=FraudAlert, name="get_alert", operation_id="get_alert"
)
def get_alert(alert_id: str, repo: Repo) -> FraudAlert:
    alert = repo.get(alert_id)
    if alert is None:
        raise HTTPException(status_code=404, detail=f"Alert '{alert_id}' not found.")
    return alert


@router.put("/{alert_id}", response_model=FraudAlert, operation_id="replace_alert")
def replace_alert(alert_id: str, payload: FraudAlertCreate, repo: Repo) -> FraudAlert:
    alert = repo.replace(alert_id, payload)
    if alert is None:
        raise HTTPException(status_code=404, detail=f"Alert '{alert_id}' not found.")
    return alert


@router.patch("/{alert_id}", response_model=FraudAlert, operation_id="patch_alert")
def patch_alert(alert_id: str, payload: FraudAlertUpdate, repo: Repo) -> FraudAlert:
    alert = repo.update(alert_id, payload)
    if alert is None:
        raise HTTPException(status_code=404, detail=f"Alert '{alert_id}' not found.")
    return alert


@router.delete("/{alert_id}", status_code=204, operation_id="delete_alert")
def delete_alert(alert_id: str, repo: Repo) -> None:
    found = repo.delete(alert_id)
    if not found:
        raise HTTPException(status_code=404, detail=f"Alert '{alert_id}' not found.")
