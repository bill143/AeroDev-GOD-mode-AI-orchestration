"""Phase definitions and approval records (Spec 1.2, 1.5)."""
from enum import Enum
from datetime import datetime, timezone
from typing import Optional
from pydantic import BaseModel, Field


def _utcnow() -> datetime:
    """Timezone-aware UTC timestamp (replaces deprecated datetime.utcnow)."""
    return datetime.now(timezone.utc)


class Phase(str, Enum):
    INITIATION = "initiation"
    PLANNING = "planning"
    TEAM_ASSEMBLY = "team_assembly"
    BUILD = "build"
    COMPLETE = "complete"
    PAUSED = "paused"
    REWORK = "rework"
    CHANGE_REVIEW = "change_review"
    CRASH_RECOVERY = "crash_recovery"


class ApprovalRecord(BaseModel):
    gate_name: str
    approved_at: datetime = Field(default_factory=_utcnow)
    approved_by: str
    evidence_refs: list[str]
    phase_before: Phase
    phase_after: Phase
