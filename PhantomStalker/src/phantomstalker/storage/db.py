"""Локальне сховище на SQLite. Уся база живе тільки на машині користувача."""

from __future__ import annotations

import os
import sqlite3
from pathlib import Path

SCHEMA = """
CREATE TABLE IF NOT EXISTS contacts (
    id                INTEGER PRIMARY KEY AUTOINCREMENT,
    name              TEXT NOT NULL,
    handle            TEXT NOT NULL DEFAULT '',
    tags              TEXT NOT NULL DEFAULT '',
    notes             TEXT NOT NULL DEFAULT '',
    created_at        TEXT NOT NULL,
    last_contacted_at TEXT
);

CREATE TABLE IF NOT EXISTS interactions (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    contact_id INTEGER NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
    date       TEXT NOT NULL,
    channel    TEXT NOT NULL DEFAULT '',
    summary    TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS important_dates (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    contact_id INTEGER NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
    label      TEXT NOT NULL,
    date       TEXT NOT NULL,
    recurring  INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS drafts (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    contact_id INTEGER REFERENCES contacts(id) ON DELETE SET NULL,
    original   TEXT NOT NULL,
    result     TEXT NOT NULL,
    tone       TEXT NOT NULL,
    created_at TEXT NOT NULL
);

-- Лише власні дані користувача; зберігаємо хеш, а не саме значення.
CREATE TABLE IF NOT EXISTS footprint_checks (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    value_hash TEXT NOT NULL,
    source     TEXT NOT NULL,
    result     TEXT NOT NULL,
    checked_at TEXT NOT NULL
);

-- Секрети (ключ API) тут НЕ зберігаються — тільки в keyring.
CREATE TABLE IF NOT EXISTS settings (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS persona_state (
    id        INTEGER PRIMARY KEY CHECK (id = 1),
    mood      TEXT NOT NULL,
    last_seen TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_interactions_contact ON interactions(contact_id);
CREATE INDEX IF NOT EXISTS idx_dates_contact ON important_dates(contact_id);
"""


def default_db_path() -> Path:
    """Шлях до бази: $PHANTOMSTALKER_DB або ~/.phantomstalker/phantom.db."""
    override = os.environ.get("PHANTOMSTALKER_DB")
    if override:
        return Path(override).expanduser()
    return Path.home() / ".phantomstalker" / "phantom.db"


def connect(path: str | Path | None = None) -> sqlite3.Connection:
    """Відкриває (і за потреби створює) базу та застосовує схему."""
    target = default_db_path() if path is None else path
    if str(target) != ":memory:":
        target = Path(target)
        target.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(target), check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    conn.executescript(SCHEMA)
    conn.commit()
    return conn
