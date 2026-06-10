"""Encrypted, tenant-scoped secret storage (Spec 7.3; CLAUDE 6).

Security properties enforced here:
- Encrypted at rest with authenticated encryption (Fernet / AES-128-CBC + HMAC).
- Server-side only. Plaintext is returned exclusively by get(), which the
  connection layer calls in-process; it is never exposed by any HTTP route.
- Tenant-scoped: every row carries a tenant_id and every query filters on it,
  so one tenant can never read another's secret (Spec 7.6 data seam).
- Secret-entry events are recorded (the event, never the value) for audit (7.7).
- No insecure default: constructed only with a real key; from_env() refuses to
  operate if ARENA_SECRET_KEY is missing.
"""
from __future__ import annotations

import os
import sqlite3
import threading
from datetime import datetime, timezone
from typing import Optional

from cryptography.fernet import Fernet, InvalidToken


class SecretError(Exception):
    """Configuration or cryptographic failure in the secret store."""


def _utcnow_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


class SecretStore:
    def __init__(self, db_path: str, key: bytes) -> None:
        # Fernet validates the key shape and raises on an invalid key.
        self._fernet = Fernet(key)
        self._lock = threading.Lock()
        self._db = sqlite3.connect(db_path, check_same_thread=False)
        self._db.execute("PRAGMA journal_mode=WAL")
        self._init_schema()

    @classmethod
    def from_env(cls, db_path: str, env_var: str = "ARENA_SECRET_KEY") -> "SecretStore":
        key = os.environ.get(env_var)
        if not key:
            raise SecretError(f"{env_var} is not set; refusing to operate without an encryption key")
        return cls(db_path, key.encode())

    def _init_schema(self) -> None:
        with self._lock:
            self._db.executescript(
                """
                CREATE TABLE IF NOT EXISTS secrets(
                    tenant_id  TEXT NOT NULL,
                    name       TEXT NOT NULL,
                    ciphertext BLOB NOT NULL,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL,
                    PRIMARY KEY (tenant_id, name)
                );
                CREATE TABLE IF NOT EXISTS secret_audit(
                    id        INTEGER PRIMARY KEY AUTOINCREMENT,
                    ts        TEXT NOT NULL,
                    event     TEXT NOT NULL,
                    tenant_id TEXT NOT NULL,
                    name      TEXT NOT NULL
                );
                """
            )
            self._db.commit()

    def _audit(self, event: str, tenant_id: str, name: str) -> None:
        self._db.execute(
            "INSERT INTO secret_audit(ts, event, tenant_id, name) VALUES (?,?,?,?)",
            (_utcnow_iso(), event, tenant_id, name),
        )
        self._db.commit()

    def put(self, tenant_id: str, name: str, value: str) -> None:
        if not tenant_id or not name:
            raise SecretError("tenant_id and name are required")
        if value is None or value == "":
            raise SecretError("empty secret value rejected")
        ciphertext = self._fernet.encrypt(value.encode("utf-8"))
        now = _utcnow_iso()
        with self._lock:
            self._db.execute(
                "INSERT INTO secrets(tenant_id, name, ciphertext, created_at, updated_at) "
                "VALUES (?,?,?,?,?) "
                "ON CONFLICT(tenant_id, name) DO UPDATE SET "
                "ciphertext=excluded.ciphertext, updated_at=excluded.updated_at",
                (tenant_id, name, ciphertext, now, now),
            )
            self._db.commit()
            self._audit("secret.put", tenant_id, name)

    def get(self, tenant_id: str, name: str) -> Optional[str]:
        """SERVER-SIDE ONLY. Returns decrypted plaintext for in-process use by the
        connection layer. Never exposed by any HTTP route."""
        with self._lock:
            row = self._db.execute(
                "SELECT ciphertext FROM secrets WHERE tenant_id=? AND name=?",
                (tenant_id, name),
            ).fetchone()
            if row is None:
                return None
            try:
                plaintext = self._fernet.decrypt(row[0]).decode("utf-8")
            except InvalidToken as exc:
                raise SecretError("decryption failed (wrong key or tampered ciphertext)") from exc
            self._audit("secret.get", tenant_id, name)
            return plaintext

    def exists(self, tenant_id: str, name: str) -> bool:
        with self._lock:
            row = self._db.execute(
                "SELECT 1 FROM secrets WHERE tenant_id=? AND name=?", (tenant_id, name)
            ).fetchone()
            return row is not None

    def list_names(self, tenant_id: str) -> list[dict]:
        """Names + timestamps for a tenant. NEVER returns values."""
        with self._lock:
            rows = self._db.execute(
                "SELECT name, created_at, updated_at FROM secrets WHERE tenant_id=? ORDER BY name",
                (tenant_id,),
            ).fetchall()
        return [{"name": r[0], "created_at": r[1], "updated_at": r[2]} for r in rows]

    def delete(self, tenant_id: str, name: str) -> bool:
        with self._lock:
            cur = self._db.execute(
                "DELETE FROM secrets WHERE tenant_id=? AND name=?", (tenant_id, name)
            )
            self._db.commit()
            removed = cur.rowcount > 0
            if removed:
                self._audit("secret.delete", tenant_id, name)
            return removed

    def audit_for(self, tenant_id: str) -> list[dict]:
        with self._lock:
            rows = self._db.execute(
                "SELECT id, ts, event, name FROM secret_audit WHERE tenant_id=? ORDER BY id",
                (tenant_id,),
            ).fetchall()
        return [{"id": r[0], "ts": r[1], "event": r[2], "name": r[3]} for r in rows]