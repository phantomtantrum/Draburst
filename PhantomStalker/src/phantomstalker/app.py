"""PhantomStalker — мінімалістична консоль: стрічка розмови, «> » унизу, slash-команди."""

from __future__ import annotations

import sqlite3
from collections.abc import Callable
from datetime import datetime
from pathlib import Path
from typing import Any

from rich.console import RenderableType
from textual import events, on, work
from textual.app import App, ComposeResult
from textual.binding import Binding
from textual.containers import Horizontal, VerticalScroll
from textual.widgets import Label
from textual.worker import Worker

from phantomstalker.core.commands import (
    AskSecret,
    Clear,
    CommandProcessor,
    Confirm,
    Exit,
    Outcome,
    Say,
    StreamAction,
    match_commands,
    mention_context,
)
from phantomstalker.core.persona import Mood, PersonaEngine
from phantomstalker.core.theme import current, set_current
from phantomstalker.services.copilot import (
    CopilotError,
    CopilotRefusal,
    CopilotRequest,
    CopilotService,
    build_user_prompt,
)
from phantomstalker.services.crm import CRMRepository
from phantomstalker.services.settings import KeyringBackend, SettingsService
from phantomstalker.storage.db import connect, default_db_path
from phantomstalker.ui import console as ui

TICK_SECONDS = 0.5
PLACEHOLDER = "Напиши щось або / для команд"
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
    CSS = """
    Screen { background: ansi_default; }
    #log { height: 1fr; padding: 1 1 1 1; scrollbar-size-vertical: 1; }
    #prompt-box {
        height: auto;
        margin: 0 1;
        padding: 0 1;
        border: round $foreground 35%;
    }
    #caret { width: 2; color: $foreground 60%; }
    #status-row { height: 3; margin: 0 1; }
    PromptInput { border: none; height: 1; padding: 0; background: ansi_default; width: 1fr; }
    PromptInput:focus { border: none; background: ansi_default; }
    """

    BINDINGS = [
        Binding("escape", "interrupt", show=False, priority=True),
        Binding("ctrl+c", "ctrl_c", show=False, priority=True),
    ]

    def __init__(
        self,
        *,
        db: str | Path | sqlite3.Connection | None = None,
        keyring_backend: KeyringBackend | None = None,
        copilot_factory: CopilotFactory = _default_copilot_factory,
        animate: bool = True,
    ) -> None:
        super().__init__(ansi_color=True)
        if isinstance(db, sqlite3.Connection):
            self.conn, self._db_label = db, "in-memory"
        else:
            self.conn, self._db_label = connect(db), str(db or default_db_path())
        self.settings = SettingsService(self.conn, keyring_backend)
        self.crm = CRMRepository(self.conn)
        self.persona = PersonaEngine(self.settings.phantom_name)
        set_current(self.settings.get("color"))
        self._welcome: ui.WelcomeEntry | None = None
        self.commands = CommandProcessor(self.crm, self.settings, lambda: self.last_output)
        self._copilot_factory = copilot_factory
        self._animate = animate

        self.chat_history: list[dict[str, Any]] = []
        self.last_output = ""
        self._history: list[str] = []
        self._history_pos = 0
        self._recalled: str | None = None  # значення з історії — для нього не показуємо підказки
        self._pending: Confirm | AskSecret | None = None
        self._stream_worker: Worker | None = None

    # --- побудова ----------------------------------------------------------
    def compose(self) -> ComposeResult:
        yield VerticalScroll(id="log")
        with Horizontal(id="status-row"):
            yield ui.MiniGhost(self.persona, id="mini")
            yield ui.StatusLine(self.persona, id="status")
        with Horizontal(id="prompt-box"):
            yield Label(">", id="caret")
            yield ui.PromptInput(id="prompt", placeholder=PLACEHOLDER)
        yield ui.Suggestions(id="suggest")

    def on_mount(self) -> None:
        self.query_one("#log", VerticalScroll).anchor()
        self._add_welcome()
        self._greet()
        if self._animate:
            self.set_interval(TICK_SECONDS, self._tick)
        self.prompt.focus()

    def _greet(self) -> None:
        row = self.conn.execute("SELECT last_seen FROM persona_state WHERE id = 1").fetchone()
        last_seen = datetime.fromisoformat(row["last_seen"]) if row else None
        reminders = self.crm.reminders(stale_after_days=self.settings.stale_after_days)
        reminder = reminders[0].text if reminders else None
        if not self.settings.has_api_key():
            reminder = (reminder + "\n" if reminder else "") + "Щоб я міг відповідати, задай ключ API: /key"
        line = self.persona.greet(reminder, last_seen)
        self.add(ui.phantom_message(line.replace("\n", "  \n")))
        self._save_persona_state()

    def _save_persona_state(self) -> None:
        self.conn.execute(
            "INSERT INTO persona_state (id, mood, last_seen) VALUES (1, ?, ?) "
            "ON CONFLICT(id) DO UPDATE SET mood = excluded.mood, last_seen = excluded.last_seen",
            (self.persona.mood.value, datetime.now().replace(microsecond=0).isoformat()),
        )
        self.conn.commit()

    # --- допоміжне ---------------------------------------------------------
    @property
    def prompt(self) -> ui.PromptInput:
        return self.query_one("#prompt", ui.PromptInput)

    @property
    def status(self) -> ui.StatusLine:
        return self.query_one("#status", ui.StatusLine)

    @property
    def suggest(self) -> ui.Suggestions:
        return self.query_one("#suggest", ui.Suggestions)

    def _add_welcome(self) -> None:
        self._welcome = ui.WelcomeEntry(self.persona, self._db_label)
        self.query_one("#log", VerticalScroll).mount(self._welcome)

    def _refresh_persona(self) -> None:
        """Перемалювати все, де видно фантома."""
        for widget_id in ("#status", "#mini"):
            self.query_one(widget_id).refresh()
        if self._welcome is not None and self._welcome.is_mounted:
            self._welcome.refresh()

    def add(self, renderable: RenderableType) -> ui.Entry:
        entry = ui.Entry(renderable)
        self.query_one("#log", VerticalScroll).mount(entry)
        return entry

    def react(self, event: str, **fmt: object) -> None:
        self.persona.react(event, **fmt)
        self._refresh_persona()

    def _tick(self) -> None:
        self.persona.tick()
        self._refresh_persona()

    async def on_event(self, event: events.Event) -> None:
        if isinstance(event, (events.Key, events.MouseDown)):
            was_sleeping = self.persona.mood == Mood.SLEEPING
            self.persona.poke()
            if was_sleeping:
                self._refresh_persona()
        await super().on_event(event)

    # --- поле вводу --------------------------------------------------------
    @on(ui.PromptInput.Changed)
    def _on_change(self, event: ui.PromptInput.Changed) -> None:
        value = event.value
        recalled, self._recalled = self._recalled, None
        if value == recalled:
            self.suggest.show([])
        elif self._pending is None and value.startswith("/") and " " not in value:
            self.suggest.show(match_commands(value))
        else:
            self.suggest.show([])

    @on(ui.PromptInput.Complete)
    def _on_complete(self) -> None:
        current = self.suggest.current
        if current is not None:
            self.prompt.value = f"/{current.name} "
            self.prompt.cursor_position = len(self.prompt.value)

    @on(ui.PromptInput.Navigate)
    def _on_navigate(self, event: ui.PromptInput.Navigate) -> None:
        if self.suggest.items:
            self.suggest.move(event.step)
            return
        if not self._history or self._pending is not None:
            return
        self._history_pos = max(0, min(len(self._history), self._history_pos + event.step))
        at_end = self._history_pos >= len(self._history)
        self._recalled = "" if at_end else self._history[self._history_pos]
        self.prompt.value = self._recalled
        self.prompt.cursor_position = len(self.prompt.value)

    @on(ui.PromptInput.Submitted)
    def _on_submit(self, event: ui.PromptInput.Submitted) -> None:
        value = event.value
        current = self.suggest.current
        if current is not None and value.startswith("/") and " " not in value.strip():
            value = f"/{current.name}"  # Enter на частково набраній команді виконує виділену
        self.prompt.value = ""
        self.suggest.show([])

        if self._pending is not None:
            self._resolve_pending(value)
            return
        text = value.strip()
        if not text:
            return
        self._history.append(text)
        self._history_pos = len(self._history)
        if self._stream_worker is not None and self._stream_worker.is_running:
            self.add(ui.say(Say("Зачекай, я ще відповідаю (esc — перервати)", kind="error")))
            return
        self.add(ui.user_line(text))
        if text.startswith("/"):
            self._handle(self.commands.run(text))
        else:
            self._chat(text)

    # --- результати команд -------------------------------------------------
    def _handle(self, outcome: Outcome) -> None:
        if isinstance(outcome, Say):
            self.add(ui.say(outcome))
            if outcome.react:
                event, fmt = outcome.react
                if event == "settings_saved":
                    self.persona.name = self.settings.phantom_name
                    set_current(self.settings.get("color"))
                self.react(event, **fmt)
            elif outcome.kind == "error":
                self.persona.set_mood(Mood.ALERT)
                self._refresh_persona()
        elif isinstance(outcome, StreamAction):
            if self._require_key():
                content = build_user_prompt(outcome.request, self.settings.get("default_language"))
                self._stream(content, action=outcome.request)
        elif isinstance(outcome, (Confirm, AskSecret)):
            self._enter_pending(outcome)
        elif isinstance(outcome, Clear):
            self.query_one("#log", VerticalScroll).remove_children()
            self.chat_history.clear()
            self.last_output = ""
            self._add_welcome()
        elif isinstance(outcome, Exit):
            self.exit()

    def _enter_pending(self, pending: Confirm | AskSecret) -> None:
        self._pending = pending
        text = pending.prompt if isinstance(pending, AskSecret) else pending.question
        if isinstance(pending, AskSecret):
            self.prompt.password = True
            self.query_one("#prompt-box").styles.border = ("round", current().accent)
        self.prompt.placeholder = text
        self.add(ui.say(Say(text)))

    def _leave_pending(self) -> None:
        self._pending = None
        self.prompt.password = False
        self.prompt.placeholder = PLACEHOLDER
        self.query_one("#prompt-box").styles.clear_rule("border")

    def _resolve_pending(self, value: str) -> None:
        pending = self._pending
        self._leave_pending()
        if isinstance(pending, AskSecret):
            self._handle(pending.on_submit(value))  # секрет ніде не показуємо й не пишемо в історію
        elif isinstance(pending, Confirm):
            self.add(ui.user_line(value))
            if value.strip().casefold() in ("y", "yes", "т", "так"):
                self._handle(pending.on_yes())
            else:
                self.add(ui.say(Say("Скасовано")))

    # --- розмова з ШІ ------------------------------------------------------
    def _require_key(self) -> bool:
        if self.settings.has_api_key():
            return True
        self.add(ui.say(Say("Потрібен ключ API", ["введи /key — він збережеться в системному keyring"],
                            kind="error")))
        self.react("no_api_key")
        return False

    def _chat(self, text: str) -> None:
        if not self._require_key():
            return
        context = mention_context(self.crm, text)
        self._stream(f"{context}\n\n{text}" if context else text)

    def _stream(self, user_content: str, action: CopilotRequest | None = None) -> None:
        self.chat_history.append({"role": "user", "content": user_content})
        self._stream_worker = self._run_stream(action)

    @work(exclusive=True, group="ai")
    async def _run_stream(self, action: CopilotRequest | None) -> None:
        entry = self.add(ui.phantom_message(""))
        self.status.busy = True
        self.react("copilot_start")
        chunks: list[str] = []
        ok = False
        try:
            copilot = self._copilot_factory(self)
            source = copilot.stream(action) if action is not None else copilot.chat(list(self.chat_history))
            async for chunk in source:
                chunks.append(chunk)
                entry.update(ui.phantom_message("".join(chunks)))
            ok = True
        except CopilotRefusal:
            self.react("copilot_refusal")
            entry.update(ui.say(Say("З цим я не допоможу — спробуймо інакше", kind="error")))
        except CopilotError as exc:
            self.react("copilot_error", error=str(exc))
            entry.update(ui.say(Say(str(exc), kind="error")))
        except Exception as exc:  # pragma: no cover - непередбачене не валить застосунок
            self.react("copilot_error", error=type(exc).__name__)
            entry.update(ui.say(Say(f"Несподівана помилка: {type(exc).__name__}", kind="error")))
        finally:
            self.status.busy = False
            text = "".join(chunks)
            if ok and text.strip():
                self.chat_history.append({"role": "assistant", "content": text})
                self.last_output = text
                self.react("copilot_done")
            else:
                # без відповіді прибираємо питання, щоб ролі в історії чергувались
                if self.chat_history and self.chat_history[-1]["role"] == "user":
                    self.chat_history.pop()
                if not chunks and ok:
                    entry.remove()
            self._refresh_persona()

    # --- клавіші -----------------------------------------------------------
    def action_interrupt(self) -> None:
        if self._stream_worker is not None and self._stream_worker.is_running:
            self._stream_worker.cancel()
            self.add(ui.say(Say("Перервано")))
            self.status.busy = False
            self.persona.set_mood(Mood.IDLE, "Окей, зупинився.")
            self._refresh_persona()
        elif self._pending is not None:
            self._leave_pending()
            self.add(ui.say(Say("Скасовано")))
        else:
            self.prompt.value = ""

    def action_ctrl_c(self) -> None:
        if self.prompt.value:
            self.prompt.value = ""
        else:
            self.exit()

    def on_unmount(self) -> None:
        try:
            self._save_persona_state()
        except sqlite3.Error:
            pass
