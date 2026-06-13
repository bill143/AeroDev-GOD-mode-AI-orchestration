"""Backend data contracts for the Arena live state stream (Spec 2.3-2.5)."""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Literal, Optional

from pydantic import BaseModel, Field


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class ProjectSnapshot(BaseModel):
    """The single source-of-truth view every window subscribes to."""
    project_id: str
    phase: str
    status: Literal["awaiting_approval", "running", "complete", "rejected", "error"]
    awaiting_gate: Optional[str] = None
    gate_approvals: dict = Field(default_factory=dict)
    messages: list[str] = Field(default_factory=list)
    last_rejection: Optional[str] = None
    updated_at: datetime = Field(default_factory=_utcnow)


class CreateProject(BaseModel):
    project_id: Optional[str] = None


class GateDecision(BaseModel):
    decision: Literal["approve", "reject"]
    direction: Optional[str] = None      # free-text rework direction (Spec 1.6)
    approved_by: str = "owner"