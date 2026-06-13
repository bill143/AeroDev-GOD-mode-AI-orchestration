"""Secret-entry console API (Spec 7.3, 4.2).

The user (or the orchestrator, with user confirmation) enters secrets here. The
value is accepted in the request body (masked client-side), encrypted, and
stored. There is intentionally NO endpoint that returns a secret value -- secrets
are server-side only and consumed in-process by the connection layer.
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field

from .secrets_store import SecretStore

router = APIRouter(prefix="/tenants/{tenant_id}/secrets", tags=["secrets"])


def get_secret_store(request: Request) -> SecretStore:
    store = getattr(request.app.state, "secret_store", None)
    if store is None:
        # Fail closed: no key configured -> no secret operations at all.
        raise HTTPException(status_code=503, detail="secrets storage not configured (set ARENA_SECRET_KEY)")
    return store


class SecretIn(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    value: str = Field(min_length=1)   # masked client-side; NEVER returned


@router.post("")
def put_secret(tenant_id: str, body: SecretIn,
               store: SecretStore = Depends(get_secret_store)) -> dict:
    store.put(tenant_id, body.name, body.value)
    return {"name": body.name, "stored": True}      # value intentionally not echoed


@router.get("")
def list_secrets(tenant_id: str,
                 store: SecretStore = Depends(get_secret_store)) -> list[dict]:
    return store.list_names(tenant_id)              # names + timestamps only


@router.get("/audit")
def secret_audit(tenant_id: str,
                 store: SecretStore = Depends(get_secret_store)) -> list[dict]:
    return store.audit_for(tenant_id)               # events, never values


@router.delete("/{name}")
def delete_secret(tenant_id: str, name: str,
                  store: SecretStore = Depends(get_secret_store)) -> dict:
    return {"deleted": store.delete(tenant_id, name)}