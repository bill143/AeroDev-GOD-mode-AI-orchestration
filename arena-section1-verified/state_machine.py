"""Arena orchestration state machine (Spec 1.1, 1.2, 1.5).

LangGraph backbone with REAL hard gates implemented via interrupt().
Each gate halts the graph and waits for an explicit approval event before
the phase can advance. A gate that is not approved does not transition.
"""
from datetime import datetime, timezone
from typing import TypedDict, Optional, Annotated
import operator

from langgraph.graph import StateGraph, END
from langgraph.checkpoint.memory import MemorySaver
from langgraph.types import interrupt

from .phases import Phase


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class ArenaState(TypedDict):
    project_id: str
    phase: str
    phase_entered_at: datetime
    messages: Annotated[list, operator.add]
    gate_approvals: dict          # {"initiation": bool, "planning": bool, ...}
    last_checkpoint_id: Optional[str]
    deliberation_result: Optional[dict]


# ---- Phase work nodes (do the phase's actual work) ----

def initiate_project(state: ArenaState) -> dict:
    return {
        "phase": Phase.INITIATION.value,
        "phase_entered_at": _utcnow(),
        "messages": [f"Project {state['project_id']} entered initiation"],
    }


def planning_phase(state: ArenaState) -> dict:
    return {
        "phase": Phase.PLANNING.value,
        "phase_entered_at": _utcnow(),
        "messages": [f"Project {state['project_id']} entered planning"],
    }


def team_assembly_phase(state: ArenaState) -> dict:
    return {
        "phase": Phase.TEAM_ASSEMBLY.value,
        "phase_entered_at": _utcnow(),
        "messages": [f"Project {state['project_id']} assembled team"],
    }


def build_phase(state: ArenaState) -> dict:
    return {
        "phase": Phase.BUILD.value,
        "phase_entered_at": _utcnow(),
        "messages": [f"Project {state['project_id']} entered build"],
    }


def complete_project(state: ArenaState) -> dict:
    return {
        "phase": Phase.COMPLETE.value,
        "phase_entered_at": _utcnow(),
        "messages": [f"Project {state['project_id']} completed"],
    }


# ---- Hard gate nodes (HALT until explicit approval) ----
# These are the real gates. Each calls interrupt(), which pauses the graph
# and persists state via the checkpointer. The graph only resumes when the
# caller supplies an approval, and it only proceeds if that approval is True.

def _gate(state: ArenaState, gate_name: str) -> dict:
    """A hard gate. Halts the run and waits for a human approval event.

    interrupt() returns whatever the human supplies on resume. We require an
    explicit truthy approval; anything else keeps the project gated (it raises,
    so the phase cannot silently advance).
    """
    # If already approved in state, pass straight through (resumed run).
    if state.get("gate_approvals", {}).get(gate_name, False):
        return {"messages": [f"Gate '{gate_name}' already approved"]}

    decision = interrupt({
        "gate": gate_name,
        "project_id": state["project_id"],
        "awaiting": "user approval",
    })

    approved = bool(decision.get("approved")) if isinstance(decision, dict) else bool(decision)
    if not approved:
        # Not approved -> stay gated. Raising prevents any silent advance.
        raise PermissionError(f"Gate '{gate_name}' was not approved; phase cannot advance.")

    new_approvals = dict(state.get("gate_approvals", {}))
    new_approvals[gate_name] = True
    return {
        "gate_approvals": new_approvals,
        "messages": [f"Gate '{gate_name}' approved"],
    }


def gate_initiation(state: ArenaState) -> dict:
    return _gate(state, "initiation")


def gate_planning(state: ArenaState) -> dict:
    return _gate(state, "planning")


def gate_team_assembly(state: ArenaState) -> dict:
    return _gate(state, "team_assembly")


def build_graph():
    """Build and compile the orchestration graph with real, halting gates."""
    builder = StateGraph(ArenaState)

    # Work nodes
    builder.add_node("initiation", initiate_project)
    builder.add_node("planning", planning_phase)
    builder.add_node("team_assembly", team_assembly_phase)
    builder.add_node("build", build_phase)
    builder.add_node("complete", complete_project)

    # Gate nodes (between phases)
    builder.add_node("gate_initiation", gate_initiation)
    builder.add_node("gate_planning", gate_planning)
    builder.add_node("gate_team_assembly", gate_team_assembly)

    builder.set_entry_point("initiation")

    # Each phase -> its gate -> (only on approval) the next phase.
    builder.add_edge("initiation", "gate_initiation")
    builder.add_edge("gate_initiation", "planning")
    builder.add_edge("planning", "gate_planning")
    builder.add_edge("gate_planning", "team_assembly")
    builder.add_edge("team_assembly", "gate_team_assembly")
    builder.add_edge("gate_team_assembly", "build")
    builder.add_edge("build", "complete")
    builder.add_edge("complete", END)

    memory_saver = MemorySaver()
    return builder.compile(checkpointer=memory_saver)
