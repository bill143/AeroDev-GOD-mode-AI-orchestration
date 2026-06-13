"""Real integration tests for the Section 2 backbone: FastAPI + WebSocket
single-source-of-truth state stream over the verified Section 1 engine.

These drive the actual LangGraph runtime and open real WebSocket connections
through Starlette's TestClient. No mocks, no simulated state.
"""
from fastapi.testclient import TestClient

from src.backend.app import app


def test_create_project_halts_at_initiation_gate():
    with TestClient(app) as c:
        snap = c.post("/projects", json={"project_id": "alpha"}).json()
        assert snap["phase"] == "initiation"
        assert snap["status"] == "awaiting_approval"
        assert snap["awaiting_gate"] == "initiation"


def test_two_windows_share_one_source_of_truth():
    with TestClient(app) as c:
        c.post("/projects", json={"project_id": "beta"})
        with c.websocket_connect("/ws/projects/beta") as w1, \
             c.websocket_connect("/ws/projects/beta") as w2:
            s1 = w1.receive_json()
            s2 = w2.receive_json()
            assert s1 == s2                       # identical source of truth
            assert s1["awaiting_gate"] == "initiation"

            c.post("/projects/beta/gate", json={"decision": "approve"})
            u1 = w1.receive_json()
            u2 = w2.receive_json()
            assert u1 == u2                       # both windows get the same update
            assert u1["phase"] == "planning"
            assert u1["gate_approvals"]["initiation"] is True


def test_reject_keeps_project_gated_then_approve_advances():
    with TestClient(app) as c:
        c.post("/projects", json={"project_id": "gamma"})
        rej = c.post("/projects/gamma/gate",
                     json={"decision": "reject", "direction": "tighten scope"}).json()
        assert rej["status"] == "rejected"
        assert rej["awaiting_gate"] == "initiation"      # did NOT advance
        assert rej["phase"] == "initiation"
        assert rej["last_rejection"] == "tighten scope"

        # the gate was re-presentable, not destroyed: a later approval advances
        adv = c.post("/projects/gamma/gate", json={"decision": "approve"}).json()
        assert adv["phase"] == "planning"
        assert adv["status"] == "awaiting_approval"


def test_full_gate_run_reaches_complete():
    with TestClient(app) as c:
        c.post("/projects", json={"project_id": "delta"})
        snap = None
        for _ in range(3):       # initiation, planning, team_assembly gates
            snap = c.post("/projects/delta/gate", json={"decision": "approve"}).json()
        assert snap["phase"] == "complete"
        assert snap["status"] == "complete"
        assert snap["gate_approvals"] == {
            "initiation": True, "planning": True, "team_assembly": True
        }


def test_late_subscriber_gets_current_live_state():
    with TestClient(app) as c:
        c.post("/projects", json={"project_id": "epsilon"})
        c.post("/projects/epsilon/gate", json={"decision": "approve"})   # advance
        with c.websocket_connect("/ws/projects/epsilon") as w:
            snap = w.receive_json()
            assert snap["phase"] == "planning"        # current, not the start
            assert snap["awaiting_gate"] == "planning"