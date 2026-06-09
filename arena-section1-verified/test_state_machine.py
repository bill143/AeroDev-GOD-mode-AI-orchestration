"""Real tests for the hard-gate state machine. These exercise the actual
LangGraph runtime, not mocks."""
from datetime import datetime, timezone
import pytest
from langgraph.types import Command

from src.orchestration.state_machine import build_graph
from src.orchestration.phases import Phase


def _initial_state(pid="p1"):
    return {
        "project_id": pid,
        "phase": Phase.INITIATION.value,
        "phase_entered_at": datetime.now(timezone.utc),
        "messages": [],
        "gate_approvals": {},
        "last_checkpoint_id": None,
        "deliberation_result": None,
    }


def test_graph_compiles():
    graph = build_graph()
    assert graph is not None


def test_gate_halts_without_approval():
    """The core property: the graph must STOP at the first gate and NOT
    advance to planning until approved."""
    graph = build_graph()
    config = {"configurable": {"thread_id": "t1"}}
    result = graph.invoke(_initial_state(), config)

    # The run paused at the gate. It must NOT have reached planning.
    assert result["phase"] == Phase.INITIATION.value
    state = graph.get_state(config)
    assert len(state.next) > 0  # graph is paused, not finished
    assert "gate_initiation" in state.next


def test_gate_advances_only_after_approval():
    """After supplying approval, the graph advances past the initiation gate
    into planning."""
    graph = build_graph()
    config = {"configurable": {"thread_id": "t2"}}
    graph.invoke(_initial_state(), config)  # pauses at gate

    # Resume with an explicit approval.
    result = graph.invoke(Command(resume={"approved": True}), config)

    # It should now have moved past initiation; phase advanced.
    assert result["phase"] in (
        Phase.PLANNING.value,
        Phase.TEAM_ASSEMBLY.value,
        Phase.BUILD.value,
        Phase.COMPLETE.value,
    )
    assert result["gate_approvals"]["initiation"] is True


def test_rejection_keeps_project_gated():
    """If the user rejects the gate, the project does not advance."""
    graph = build_graph()
    config = {"configurable": {"thread_id": "t3"}}
    graph.invoke(_initial_state(), config)

    with pytest.raises(Exception):
        graph.invoke(Command(resume={"approved": False}), config)
