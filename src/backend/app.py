"""Arena cloud backend (Spec 2.3-2.4): FastAPI + WebSocket live state stream.

All orchestration runs here -- the backend is the executor AND the single source
of truth. Clients are windows that subscribe over WebSocket; they never execute
orchestration or hold authoritative state (CLAUDE section 4).
"""
from __future__ import annotations

import uuid

from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect

from .hub import ProjectHub
from .schemas import CreateProject, GateDecision, ProjectSnapshot

app = FastAPI(title="Arena Backend", version="0.1.0")
hub = ProjectHub()


@app.get("/healthz")
async def healthz() -> dict:
    return {"status": "ok", "service": "arena-backend"}


@app.post("/projects", response_model=ProjectSnapshot)
async def create_project(body: CreateProject) -> ProjectSnapshot:
    project_id = body.project_id or f"proj_{uuid.uuid4().hex[:12]}"
    if hub.exists(project_id):
        raise HTTPException(status_code=409, detail="project already exists")
    return await hub.create(project_id)


@app.get("/projects/{project_id}", response_model=ProjectSnapshot)
async def get_project(project_id: str) -> ProjectSnapshot:
    snap = hub.latest(project_id)
    if snap is None:
        raise HTTPException(status_code=404, detail="project not found")
    return snap


@app.post("/projects/{project_id}/gate", response_model=ProjectSnapshot)
async def decide_gate(project_id: str, body: GateDecision) -> ProjectSnapshot:
    try:
        return await hub.decide(project_id, body.decision, body.direction)
    except KeyError:
        raise HTTPException(status_code=404, detail="project not found")


@app.websocket("/ws/projects/{project_id}")
async def ws_project(websocket: WebSocket, project_id: str) -> None:
    await websocket.accept()
    if not hub.exists(project_id):
        await websocket.close(code=4404)
        return
    await hub.subscribe(project_id, websocket)
    try:
        while True:
            await websocket.receive_text()   # keepalive / client pings
    except WebSocketDisconnect:
        pass
    finally:
        hub.unsubscribe(project_id, websocket)