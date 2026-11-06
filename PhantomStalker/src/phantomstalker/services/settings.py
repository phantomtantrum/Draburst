"""Налаштування: звичайні значення — в SQLite, ключ API — тільки в keyring."""

from __future__ import annotations

import os
import sqlite3
from pathlib import Path
from typing import Any, Protocol

KEYRING_SERVICE = "phantomstalker"
KEYRING_API_KEY = "anthropic_api_key"

DEFAULTS: dict[str, str] = {
    "phantom_name": "Phantom",
    "tone_profile": "дружній, лаконічний, без канцеляризмів, з легким гумором",
    "default_language": "українська",
    "model": "claude-opus-5-5",
    "stale_after_days": "30",
}


class KeyringBackend(Protocol):
    def get_password(self, service: str, username: str) -> str | None: ...
    def set_password(self, service: str, username: str, password: str) -> None: ...
    def delete_password(self, service: str, username: str) -> None: ...


def _system_keyring() -> Any:
    import keyring

    return keyring


class SettingsService:
    def __init__(self, conn: sqlite3.Connection, keyring_backend: KeyringBackend | None = None) -> None:
        self.conn = conn
        self._keyring = keyring_backend if keyring_backend is not None else _system_keyring()

    # --- звичайні налаштування --------------------------------------------
    def get(self, key: str, default: str | None = None) -> str:
        row = self.conn.execute("SELECT value FROM settings WHERE key = ?", (key,)).fetchone()
        if row is not None:
            return row["value"]
        if default is not None:
            return default
        return DEFAULTS.get(key, "")

    def set(self, key: str, value: str) -> None:
        if key == KEYRING_API_KEY:
            raise ValueError("Ключ API зберігається лише в keyring — використовуй set_api_key()")
        self.conn.execute(
            "INSERT INTO settings (key, value) VALUES (?, ?) "
            "ON CONFLICT(key) DO UPDATE SET value = excluded.value",
            (key, value),
        )
        self.conn.commit()

    @property
    def phantom_name(self) -> str:
        return self.get("phantom_name").strip() or DEFAULTS["phantom_name"]

    @property
    def tone_profile(self) -> str:
        return self.get("tone_profile")

    @property
    def model(self) -> str:
        return self.get("model").strip() or DEFAULTS["model"]

    @property
    def stale_after_days(self) -> int:
        try:
            return max(1, int(self.get("stale_after_days")))
        except ValueError:
            return int(DEFAULTS["stale_after_days"])

    # --- секрети ------------------------------------------------------------
    def get_api_key(self) -> str | None:
        """Порядок: keyring → змінна середовища ANTHROPIC_API_KEY."""
        try:
            stored = self._keyring.get_password(KEYRING_SERVICE, KEYRING_API_KEY)
        except Exception:  # немає бекенду keyring (напр. headless-сервер)
            stored = None
        return stored or os.environ.get("ANTHROPIC_API_KEY") or None

    def set_api_key(self, value: str) -> None:
        value = value.strip()
        if value:
            self._keyring.set_password(KEYRING_SERVICE, KEYRING_API_KEY, value)
        else:
            self.clear_api_key()

    def clear_api_key(self) -> None:
        try:
            self._keyring.delete_password(KEYRING_SERVICE, KEYRING_API_KEY)
        except Exception:
            pass

    def has_api_key(self) -> bool:
        return bool(self.get_api_key())


def load_dotenv(path: str | Path = ".env") -> None:
    """Мінімальний читач .env (KEY=VALUE). Не перезаписує вже задані змінні."""
    file = Path(path)
    if not file.is_file():
        return
    for raw in file.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        key = key.strip().removeprefix("export ").strip()
        value = value.strip().strip('"').strip("'")
        if key and value:
            os.environ.setdefault(key, value)
