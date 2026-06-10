"""Arena cloud backend (Spec 2.3-2.4): FastAPI + WebSocket live state stream.

All orchestration runs here -- the backend is the executor AND the single source
of truth. Clients are windows that subscribe over WebSocket; they never execute
orchestration or hold authoritative state (CLAUDE section 4). Phase 2 adds the
server-side encrypted secret store, wired in below.
"""
from __future__ import annotations

import os
import uuid
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect

from .hub import ProjectHub
from .schemas import CreateProject, GateDecision, ProjectSnapshot
from .secrets_api import router as secrets_router
from .secrets_store import SecretStore


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Encrypted secret store. Fail closed: without ARENA_SECRET_KEY we refuse to
    # operate the secret store at all (its endpoints return 503). We never store
    # secrets unencrypted, and we never invent a key.
    key = os.environ.get("ARENA_SECRET_KEY")
    if key:
        db = os.environ.get("ARENA_SECRETS_DB", "data/secrets.db")
        parent = os.path.dirname(db)
        if parent:
            os.makedirs(parent, exist_ok=True)
        app.state.secret_store = SecretStore(db, key.encode())
    else:
        app.state.secret_store = None
    yield


app = FastAPI(title="Arena Backend", version="0.1.0", lifespan=lifespan)
hub = ProjectHub()
app.include_router(secrets_router)


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