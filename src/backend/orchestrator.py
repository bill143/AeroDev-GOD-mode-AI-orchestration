"""Drives the verified Section 1 LangGraph engine.

The state machine remains the single source of truth (CLAUDE section 4): this
runner only starts it, supplies real approval/rejection events, and reads
authoritative snapshots. It never advances a phase without a real approval --
gates halt via interrupt(), exactly as the Section 1 tests prove.
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional

from langgraph.types import Command

from src.orchestration.phases import Phase
from src.orchestration.state_machine import build_graph

from .schemas import ProjectSnapshot

GATE_PREFIX = "gate_"


class OrchestrationRunner:
    def __init__(self, project_id: str) -> None:
        self.project_id = project_id
        self.graph = build_graph()
        self.config = {"configurable": {"thread_id": project_id}}
        self.last_rejection: Optional[str] = None
        self._started = False

    def _initial_state(self) -> dict:
        return {
            "project_id": self.project_id,
            "phase": Phase.INITIATION.value,
            "phase_entered_at": datetime.now(timezone.utc),
            "messages": [],
            "gate_approvals": {},
            "last_checkpoint_id": None,
            "deliberation_result": None,
        }

    def start(self) -> ProjectSnapshot:
        if not self._started:
            self.graph.invoke(self._initial_state(), self.config)
            self._started = True
        return self.snapshot()

    def approve(self) -> ProjectSnapshot:
        if self._awaiting_gate() is None:
            return self.snapshot()
        self.last_rejection = None
        self.graph.invoke(Command(resume={"approved": True}), self.config)
        return self.snapshot()

    def reject(self, direction: Optional[str] = None) -> ProjectSnapshot:
        # Rework loop (Spec 1.6): do NOT advance. Stay paused at the same gate so
        # it is re-presentable and can later be approved. Record the direction.
        gate = self._awaiting_gate()
        self.last_rejection = direction or f"Gate '{gate}' rejected"
        return self.snapshot(status_override="rejected")

    def _snapshot_state(self):
        return self.graph.get_state(self.config)

    def _awaiting_gate(self) -> Optional[str]:
        for node in self._snapshot_state().next:
            if node.startswith(GATE_PREFIX):
                return node[len(GATE_PREFIX):]
        return None

    def snapshot(self, status_override: Optional[str] = None) -> ProjectSnapshot:
        st = self._snapshot_state()
        values = st.values or {}
        gate = self._awaiting_gate()
        if status_override:
            status = status_override
        elif gate is not None:
            status = "awaiting_approval"
        elif len(st.next) == 0:
            status = "complete"
        else:
            status = "running"
        return ProjectSnapshot(
            project_id=self.project_id,
            phase=values.get("phase", Phase.INITIATION.value),
            status=status,
            awaiting_gate=gate,
            gate_approvals=values.get("gate_approvals", {}),
            messages=values.get("messages", []),
            last_rejection=self.last_rejection,
        )