"""ProjectHub: the single source of truth per project (Spec 2.4-2.5; CLAUDE 4).

Holds the authoritative OrchestrationRunner and broadcasts every state change to
all subscribed windows. Windows never copy state between each other -- they all
read this one stream. A new subscriber immediately receives the current snapshot,
so a re-subscribe (pop-out / reopen) shows current live state and cannot drift.
"""
from __future__ import annotations

import asyncio
from typing import Optional

from fastapi import WebSocket

from .orchestrator import OrchestrationRunner
from .schemas import ProjectSnapshot


class ProjectHub:
    def __init__(self) -> None:
        self._runners: dict[str, OrchestrationRunner] = {}
        self._subs: dict[str, set[WebSocket]] = {}
        self._latest: dict[str, ProjectSnapshot] = {}
        self._lock = asyncio.Lock()

    def exists(self, project_id: str) -> bool:
        return project_id in self._runners

    def latest(self, project_id: str) -> Optional[ProjectSnapshot]:
        return self._latest.get(project_id)

    async def create(self, project_id: str) -> ProjectSnapshot:
        async with self._lock:
            if project_id in self._runners:
                return self._latest[project_id]
            runner = OrchestrationRunner(project_id)
            self._runners[project_id] = runner
            self._subs.setdefault(project_id, set())
            snap = await asyncio.to_thread(runner.start)
            self._latest[project_id] = snap
        await self._broadcast(project_id, snap)
        return snap

    async def decide(self, project_id: str, decision: str, direction: Optional[str] = None) -> ProjectSnapshot:
        runner = self._runners.get(project_id)
        if runner is None:
            raise KeyError(project_id)
        if decision == "approve":
            snap = await asyncio.to_thread(runner.approve)
        else:
            snap = await asyncio.to_thread(runner.reject, direction)
        self._latest[project_id] = snap
        await self._broadcast(project_id, snap)
        return snap

    async def subscribe(self, project_id: str, ws: WebSocket) -> None:
        self._subs.setdefault(project_id, set()).add(ws)
        snap = self._latest.get(project_id)
        if snap is not None:
            await ws.send_json(snap.model_dump(mode="json"))

    def unsubscribe(self, project_id: str, ws: WebSocket) -> None:
        self._subs.get(project_id, set()).discard(ws)

    async def _broadcast(self, project_id: str, snap: ProjectSnapshot) -> None:
        payload = snap.model_dump(mode="json")
        dead = []
        for ws in list(self._subs.get(project_id, set())):
            try:
                await ws.send_json(payload)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self._subs[project_id].discard(ws)