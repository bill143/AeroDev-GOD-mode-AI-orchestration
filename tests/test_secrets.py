"""Real tests for Phase 2 Step 1 — encrypted, tenant-scoped secret storage.

Verifies the four security properties the spec demands (7.3, 7.6):
  - encrypted at rest (plaintext never on disk)
  - tenant-scoped (one tenant cannot read another's secret)
  - never returns a secret value over the API
  - fails closed without an encryption key
No mocks: real Fernet crypto, real SQLite, real FastAPI requests.
"""
import pytest
from cryptography.fernet import Fernet
from fastapi.testclient import TestClient

from src.backend import secrets_api
from src.backend.app import app
from src.backend.secrets_store import SecretError, SecretStore


def _store(tmp_path):
    return SecretStore(str(tmp_path / "secrets.db"), Fernet.generate_key())


# ---------------- store-level (crypto + isolation) ----------------

def test_roundtrip_and_encrypted_at_rest(tmp_path):
    s = _store(tmp_path)
    s.put("tenantA", "openai_key", "sk-secret-123")
    assert s.get("tenantA", "openai_key") == "sk-secret-123"
    raw = (tmp_path / "secrets.db").read_bytes()
    assert b"sk-secret-123" not in raw          # plaintext never on disk


def test_tenant_isolation(tmp_path):
    s = _store(tmp_path)
    s.put("A", "key", "valueA")
    s.put("B", "key", "valueB")
    assert s.get("A", "key") == "valueA"
    assert s.get("B", "key") == "valueB"
    assert s.get("C", "key") is None            # unknown tenant sees nothing


def test_list_names_never_returns_values(tmp_path):
    s = _store(tmp_path)
    s.put("A", "openai_key", "sk-xyz")
    listing = s.list_names("A")
    assert [x["name"] for x in listing] == ["openai_key"]
    assert all("value" not in x and "sk-xyz" not in str(x) for x in listing)


def test_wrong_key_cannot_decrypt(tmp_path):
    db = str(tmp_path / "secrets.db")
    SecretStore(db, Fernet.generate_key()).put("A", "k", "v")
    other = SecretStore(db, Fernet.generate_key())   # different key, same db file
    with pytest.raises(SecretError):
        other.get("A", "k")


def test_delete_and_exists(tmp_path):
    s = _store(tmp_path)
    s.put("A", "k", "v")
    assert s.exists("A", "k") is True
    assert s.delete("A", "k") is True
    assert s.exists("A", "k") is False
    assert s.get("A", "k") is None


def test_audit_records_events_not_values(tmp_path):
    s = _store(tmp_path)
    s.put("A", "k", "supersecret")
    s.get("A", "k")
    s.delete("A", "k")
    events = s.audit_for("A")
    kinds = [e["event"] for e in events]
    assert {"secret.put", "secret.get", "secret.delete"} <= set(kinds)
    assert all("supersecret" not in str(e) for e in events)


def test_from_env_requires_key(monkeypatch, tmp_path):
    monkeypatch.delenv("ARENA_SECRET_KEY", raising=False)
    with pytest.raises(SecretError):
        SecretStore.from_env(str(tmp_path / "s.db"))


# ---------------- API-level (never echoes a value; fail-closed) ----------------

def test_api_stores_and_lists_without_exposing_value(tmp_path):
    store = _store(tmp_path)
    app.dependency_overrides[secrets_api.get_secret_store] = lambda: store
    try:
        with TestClient(app) as c:
            r = c.post("/tenants/acme/secrets", json={"name": "openai_key", "value": "sk-zzz"})
            assert r.status_code == 200
            assert r.json() == {"name": "openai_key", "stored": True}
            assert "sk-zzz" not in r.text                 # value never echoed

            lst = c.get("/tenants/acme/secrets")
            assert [x["name"] for x in lst.json()] == ["openai_key"]
            assert "sk-zzz" not in lst.text

            # there is NO endpoint that returns a secret value
            assert c.get("/tenants/acme/secrets/openai_key").status_code in (404, 405)
    finally:
        app.dependency_overrides.clear()


def test_api_fails_closed_without_key(monkeypatch):
    monkeypatch.delenv("ARENA_SECRET_KEY", raising=False)
    app.dependency_overrides.pop(secrets_api.get_secret_store, None)
    with TestClient(app) as c:
        r = c.post("/tenants/x/secrets", json={"name": "k", "value": "v"})
        assert r.status_code == 503        # no key -> secrets refused, not stored insecurely