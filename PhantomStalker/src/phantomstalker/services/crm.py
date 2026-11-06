"""Особиста CRM: лише люди та факти, які користувач вніс сам. Жодного автозбору."""

from __future__ import annotations

import sqlite3
from dataclasses import dataclass, field
from datetime import date, datetime
from typing import Literal


def _now() -> datetime:
    return datetime.now().replace(microsecond=0)


def _parse_dt(value: str | None) -> datetime | None:
    return datetime.fromisoformat(value) if value else None


def _split_tags(raw: str) -> list[str]:
    return [t.strip() for t in raw.split(",") if t.strip()]


@dataclass
class Contact:
    id: int
    name: str
    handle: str = ""
    tags: list[str] = field(default_factory=list)
    notes: str = ""
    created_at: datetime = field(default_factory=_now)
    last_contacted_at: datetime | None = None

    @classmethod
    def from_row(cls, row: sqlite3.Row) -> Contact:
        return cls(
            id=row["id"],
            name=row["name"],
            handle=row["handle"],
            tags=_split_tags(row["tags"]),
            notes=row["notes"],
            created_at=datetime.fromisoformat(row["created_at"]),
            last_contacted_at=_parse_dt(row["last_contacted_at"]),
        )

    def days_since_contact(self, today: date) -> int | None:
        if self.last_contacted_at is None:
            return None
        return (today - self.last_contacted_at.date()).days


@dataclass
class ImportantDate:
    id: int
    contact_id: int
    label: str
    date: date
    recurring: bool = True

    @classmethod
    def from_row(cls, row: sqlite3.Row) -> ImportantDate:
        return cls(
            id=row["id"],
            contact_id=row["contact_id"],
            label=row["label"],
            date=date.fromisoformat(row["date"]),
            recurring=bool(row["recurring"]),
        )

    def next_occurrence(self, today: date) -> date | None:
        """Найближча дата події (для щорічних — цього або наступного року)."""
        if not self.recurring:
            return self.date if self.date >= today else None
        for year in (today.year, today.year + 1):
            candidate = _safe_date(year, self.date.month, self.date.day)
            if candidate >= today:
                return candidate
        return None  # pragma: no cover - недосяжно


def _safe_date(year: int, month: int, day: int) -> date:
    """29 лютого в невисокосний рік стає 28 лютого."""
    try:
        return date(year, month, day)
    except ValueError:
        return date(year, month, 28)


@dataclass
class Interaction:
    id: int
    contact_id: int
    date: datetime
    channel: str
    summary: str


@dataclass
class Reminder:
    contact: Contact
    kind: Literal["date", "stale"]
    text: str
    days_left: int  # для «stale» — від'ємне число днів без контакту


class CRMRepository:
    def __init__(self, conn: sqlite3.Connection) -> None:
        self.conn = conn

    # --- контакти ----------------------------------------------------------
    def add_contact(self, name: str, handle: str = "", tags: list[str] | tuple[str, ...] = (),
                    notes: str = "", created_at: datetime | None = None) -> Contact:
        name = name.strip()
        if not name:
            raise ValueError("Ім'я контакту не може бути порожнім")
        created = (created_at or _now()).isoformat()
        cur = self.conn.execute(
            "INSERT INTO contacts (name, handle, tags, notes, created_at) VALUES (?, ?, ?, ?, ?)",
            (name, handle.strip(), ", ".join(t.strip() for t in tags if t.strip()), notes, created),
        )
        self.conn.commit()
        return self.get_contact(cur.lastrowid)  # type: ignore[arg-type]

    def get_contact(self, contact_id: int) -> Contact:
        row = self.conn.execute("SELECT * FROM contacts WHERE id = ?", (contact_id,)).fetchone()
        if row is None:
            raise KeyError(contact_id)
        return Contact.from_row(row)

    def list_contacts(self, search: str | None = None) -> list[Contact]:
        rows = self.conn.execute("SELECT * FROM contacts").fetchall()
        contacts = [Contact.from_row(r) for r in rows]
        needle = (search or "").strip().casefold()
        if needle:
            # Фільтруємо в Python: SQLite LIKE не враховує регістр кирилиці.
            contacts = [
                c for c in contacts
                if needle in " ".join([c.name, c.handle, *c.tags, c.notes]).casefold()
            ]
        return sorted(contacts, key=lambda c: c.name.casefold())

    def update_contact(self, contact_id: int, *, name: str | None = None, handle: str | None = None,
                       tags: list[str] | None = None, notes: str | None = None) -> Contact:
        current = self.get_contact(contact_id)
        new_name = current.name if name is None else name.strip()
        if not new_name:
            raise ValueError("Ім'я контакту не може бути порожнім")
        self.conn.execute(
            "UPDATE contacts SET name = ?, handle = ?, tags = ?, notes = ? WHERE id = ?",
            (
                new_name,
                current.handle if handle is None else handle.strip(),
                ", ".join(current.tags if tags is None else [t.strip() for t in tags if t.strip()]),
                current.notes if notes is None else notes,
                contact_id,
            ),
        )
        self.conn.commit()
        return self.get_contact(contact_id)

    def delete_contact(self, contact_id: int) -> None:
        self.conn.execute("DELETE FROM contacts WHERE id = ?", (contact_id,))
        self.conn.commit()

    # --- взаємодії ---------------------------------------------------------
    def mark_contacted(self, contact_id: int, when: datetime | None = None,
                       channel: str = "", summary: str = "") -> Contact:
        stamp = (when or _now()).isoformat()
        self.get_contact(contact_id)  # KeyError, якщо контакту немає
        self.conn.execute(
            "INSERT INTO interactions (contact_id, date, channel, summary) VALUES (?, ?, ?, ?)",
            (contact_id, stamp, channel, summary),
        )
        self.conn.execute(
            "UPDATE contacts SET last_contacted_at = ? WHERE id = ?", (stamp, contact_id)
        )
        self.conn.commit()
        return self.get_contact(contact_id)

    def list_interactions(self, contact_id: int) -> list[Interaction]:
        rows = self.conn.execute(
            "SELECT * FROM interactions WHERE contact_id = ? ORDER BY date DESC", (contact_id,)
        ).fetchall()
        return [
            Interaction(r["id"], r["contact_id"], datetime.fromisoformat(r["date"]),
                        r["channel"], r["summary"])
            for r in rows
        ]

    # --- важливі дати ------------------------------------------------------
    def add_important_date(self, contact_id: int, label: str, when: date,
                           recurring: bool = True) -> ImportantDate:
        label = label.strip()
        if not label:
            raise ValueError("Назва дати не може бути порожньою")
        self.get_contact(contact_id)
        cur = self.conn.execute(
            "INSERT INTO important_dates (contact_id, label, date, recurring) VALUES (?, ?, ?, ?)",
            (contact_id, label, when.isoformat(), int(recurring)),
        )
        self.conn.commit()
        row = self.conn.execute(
            "SELECT * FROM important_dates WHERE id = ?", (cur.lastrowid,)
        ).fetchone()
        return ImportantDate.from_row(row)

    def list_important_dates(self, contact_id: int | None = None) -> list[ImportantDate]:
        if contact_id is None:
            rows = self.conn.execute("SELECT * FROM important_dates").fetchall()
        else:
            rows = self.conn.execute(
                "SELECT * FROM important_dates WHERE contact_id = ?", (contact_id,)
            ).fetchall()
        return [ImportantDate.from_row(r) for r in rows]

    # --- нагадування -------------------------------------------------------
    def reminders(self, today: date | None = None, *, stale_after_days: int = 30,
                  horizon_days: int = 7) -> list[Reminder]:
        """Найближчі важливі дати + люди, з якими давно не було зв'язку."""
        today = today or date.today()
        contacts = {c.id: c for c in self.list_contacts()}
        result: list[Reminder] = []

        for item in self.list_important_dates():
            nxt = item.next_occurrence(today)
            if nxt is None or (nxt - today).days > horizon_days:
                continue
            days = (nxt - today).days
            contact = contacts[item.contact_id]
            when = "сьогодні" if days == 0 else ("завтра" if days == 1 else f"через {days} дн.")
            result.append(Reminder(contact, "date", f"{contact.name}: {item.label} — {when}", days))

        for contact in contacts.values():
            last = contact.last_contacted_at or contact.created_at
            silent = (today - last.date()).days
            if silent >= stale_after_days:
                result.append(Reminder(
                    contact, "stale",
                    f"Давно не було зв'язку: {contact.name} ({silent} дн.) — може, написати?",
                    -silent,
                ))

        result.sort(key=lambda r: (r.kind != "date", r.days_left))
        return result

    # --- чернетки ----------------------------------------------------------
    def save_draft(self, original: str, result: str, tone: str,
                   contact_id: int | None = None) -> int:
        cur = self.conn.execute(
            "INSERT INTO drafts (contact_id, original, result, tone, created_at) VALUES (?, ?, ?, ?, ?)",
            (contact_id, original, result, tone, _now().isoformat()),
        )
        self.conn.commit()
        return int(cur.lastrowid)  # type: ignore[arg-type]

    def count_drafts(self) -> int:
        return int(self.conn.execute("SELECT COUNT(*) FROM drafts").fetchone()[0])


def parse_user_date(raw: str) -> date:
    """Приймає РРРР-ММ-ДД або ДД.ММ.РРРР."""
    raw = raw.strip()
    for fmt in ("%Y-%m-%d", "%d.%m.%Y"):
        try:
            return datetime.strptime(raw, fmt).date()
        except ValueError:
            continue
    raise ValueError("Дата має бути у форматі РРРР-ММ-ДД або ДД.ММ.РРРР")


def humanize_days(days: int | None) -> str:
    if days is None:
        return "ще не було"
    if days == 0:
        return "сьогодні"
    if days == 1:
        return "вчора"
    return f"{days} дн. тому"


__all__ = [
    "CRMRepository",
    "Contact",
    "ImportantDate",
    "Interaction",
    "Reminder",
    "humanize_days",
    "parse_user_date",
]
