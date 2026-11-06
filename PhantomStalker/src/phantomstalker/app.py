"""Головний Textual-застосунок PhantomStalker."""

from __future__ import annotations

import sqlite3
from collections.abc import Callable, Iterable
from datetime import datetime
from pathlib import Path

from textual import events
from textual.app import App, ComposeResult, SystemCommand
from textual.binding import Binding
from textual.containers import Horizontal
from textual.screen import Screen
from textual.theme import Theme
from textual.widgets import Button, Checkbox, Footer, Header, Input, Select, TabbedContent, TabPane, TextArea

from phantomstalker.core.persona import Mood, PersonaEngine
from phantomstalker.services.copilot import CopilotService
from phantomstalker.services.crm import CRMRepository
from phantomstalker.services.settings import KeyringBackend, SettingsService
from phantomstalker.storage.db import connect
from phantomstalker.ui.copilot_view import CopilotView
from phantomstalker.ui.people_view import PeopleView
from phantomstalker.ui.phantom_panel import PhantomPanel
from phantomstalker.ui.screens import (
    COACH_BODY,
    FOOTPRINT_BODY,
    ComingSoonView,
    HelpScreen,
    SettingsScreen,
)

MODULES = ("chat", "people", "footprint", "coach")
FORM_WIDGETS = (Input, TextArea, Button, Checkbox, Select)

PHANTOM_THEME = Theme(
    name="phantom",
    primary="#FF8C42",
    secondary="#FFB75E",
    accent="#FFA94D",
    warning="#F2A541",
    error="#E8553A",
    success="#7BC67E",
    background="#16120F",
    surface="#1F1915",
    panel="#2A211B",
    dark=True,
)

CopilotFactory = Callable[["PhantomStalkerApp"], CopilotService]


def _default_copilot_factory(app: PhantomStalkerApp) -> CopilotService:
    s = app.settings
    return CopilotService(
        api_key=s.get_api_key(),
        model=s.model,
        phantom_name=s.phantom_name,
        tone_profile=s.tone_profile,
        default_language=s.get("default_language"),
    )


class PhantomStalkerApp(App):
    TITLE = "PhantomStalker"
    SUB_TITLE = "Твій фантом. Твої люди. Твій слід."
    CSS = """
    .form-screen { align: center middle; }
    #body { height: 1fr; }
    #modules { width: 1fr; }
    """

    BINDINGS = [
        Binding("1", "module('chat')", "Чат", show=False),
        Binding("2", "module('people')", "Люди", show=False),
        Binding("3", "module('footprint')", "Слід", show=False),
        Binding("4", "module('coach')", "Коуч", show=False),
        Binding("tab", "next_module", "модуль", priority=True),
        Binding("shift+tab", "prev_module", "модуль", show=False, priority=True),
        Binding("slash", "command_palette", "команда"),
        Binding("question_mark", "help", "довідка"),
        Binding("s", "settings", "налаштування"),
        Binding("escape", "back", "назад", show=False),
        Binding("q", "quit", "вихід"),
    ]

    def __init__(
        self,
        *,
        db: str | Path | sqlite3.Connection | None = None,
        keyring_backend: KeyringBackend | None = None,
        copilot_factory: CopilotFactory = _default_copilot_factory,
        animate: bool = True,
    ) -> None:
        super().__init__()
        self.conn = db if isinstance(db, sqlite3.Connection) else connect(db)
        self.settings = SettingsService(self.conn, keyring_backend)
        self.crm = CRMRepository(self.conn)
        self.persona = PersonaEngine(self.settings.phantom_name)
        self._copilot_factory = copilot_factory
        self._animate = animate

    # --- побудова екрана ---------------------------------------------------
    def compose(self) -> ComposeResult:
        yield Header(show_clock=False, icon="👻")
        with Horizontal(id="body"):
            yield PhantomPanel(self.persona, animate=self._animate, id="phantom")
            with TabbedContent(initial="chat", id="modules"):
                with TabPane("[1] Чат", id="chat"):
                    yield CopilotView()
                with TabPane("[2] Люди", id="people"):
                    yield PeopleView()
                with TabPane("[3] Слід", id="footprint"):
                    yield ComingSoonView("Вистеж себе", "v0.2", FOOTPRINT_BODY)
                with TabPane("[4] Коуч", id="coach"):
                    yield ComingSoonView("Підготовка до розмов", "v0.3", COACH_BODY)
        yield Footer()

    def on_mount(self) -> None:
        self.register_theme(PHANTOM_THEME)
        self.theme = "phantom"
        self._greet()
        self.set_focus(None)

    def _greet(self) -> None:
        row = self.conn.execute("SELECT last_seen FROM persona_state WHERE id = 1").fetchone()
        last_seen = datetime.fromisoformat(row["last_seen"]) if row else None
        reminders = self.crm.reminders(stale_after_days=self.settings.stale_after_days)
        reminder = reminders[0].text if reminders else None
        if not self.settings.has_api_key():
            reminder = (reminder + "\n" if reminder else "") + "Додай ключ API в налаштуваннях (s)."
        self.persona.greet(reminder, last_seen)
        self._save_persona_state()
        self._sync_panel()

    def _save_persona_state(self) -> None:
        self.conn.execute(
            "INSERT INTO persona_state (id, mood, last_seen) VALUES (1, ?, ?) "
            "ON CONFLICT(id) DO UPDATE SET mood = excluded.mood, last_seen = excluded.last_seen",
            (self.persona.mood.value, datetime.now().replace(microsecond=0).isoformat()),
        )
        self.conn.commit()

    def _sync_panel(self) -> None:
        try:
            self.query_one(PhantomPanel).sync()
        except Exception:
            pass

    # --- API для модулів ---------------------------------------------------
    def react(self, event: str, **fmt: object) -> str:
        line = self.persona.react(event, **fmt)
        self._sync_panel()
        return line

    def make_copilot(self) -> CopilotService:
        return self._copilot_factory(self)

    # --- активність користувача будить фантома -----------------------------
    async def on_event(self, event: events.Event) -> None:
        if isinstance(event, (events.Key, events.MouseDown)):
            was_sleeping = self.persona.mood == Mood.SLEEPING
            self.persona.poke()
            if was_sleeping:
                self._sync_panel()
        await super().on_event(event)

    # --- дії ---------------------------------------------------------------
    @property
    def _tabs(self) -> TabbedContent:
        return self.query_one("#modules", TabbedContent)

    def action_module(self, module: str) -> None:
        if module in MODULES:
            self._tabs.active = module
            if module in ("footprint", "coach"):
                self.react("coming_soon")

    def _cycle(self, step: int) -> None:
        on_main = self.screen is self.screen_stack[0]
        if not on_main or isinstance(self.focused, FORM_WIDGETS):
            # у формах Tab лишається звичною навігацією між полями
            (self.screen.focus_next if step > 0 else self.screen.focus_previous)()
            return
        current = MODULES.index(self._tabs.active) if self._tabs.active in MODULES else 0
        self.action_module(MODULES[(current + step) % len(MODULES)])

    def action_next_module(self) -> None:
        self._cycle(+1)

    def action_prev_module(self) -> None:
        self._cycle(-1)

    def action_back(self) -> None:
        self.set_focus(None)

    def action_help(self) -> None:
        self.push_screen(HelpScreen())

    def action_settings(self) -> None:
        def done(saved: bool | None) -> None:
            if saved:
                self.persona.name = self.settings.phantom_name
                self.react("settings_saved")

        self.push_screen(SettingsScreen(), done)

    def action_add_contact(self) -> None:
        self.action_module("people")
        self.query_one(PeopleView).action_add()

    def get_system_commands(self, screen: Screen) -> Iterable[SystemCommand]:
        yield SystemCommand("Чат", "Напарник-листування", lambda: self.action_module("chat"))
        yield SystemCommand("Люди", "Особиста CRM", lambda: self.action_module("people"))
        yield SystemCommand("Додати контакт", "Нова людина в CRM", self.action_add_contact)
        yield SystemCommand("Слід", "Перевірка власного цифрового сліду (v0.2)",
                            lambda: self.action_module("footprint"))
        yield SystemCommand("Коуч", "Підготовка до розмов (v0.3)", lambda: self.action_module("coach"))
        yield SystemCommand("Налаштування", "Ім'я фантома, тон, ключ API", self.action_settings)
        yield SystemCommand("Довідка", "Гарячі клавіші та приватність", self.action_help)
        yield SystemCommand("Вихід", "Закрити PhantomStalker", self.exit)

    def on_unmount(self) -> None:
        try:
            self._save_persona_state()
        except sqlite3.Error:
            pass
