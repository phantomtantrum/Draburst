"""Модуль «Чат»: напарник-листування зі стрімінгом відповіді."""

from __future__ import annotations

from typing import TYPE_CHECKING

from textual import on, work
from textual.app import ComposeResult
from textual.containers import Horizontal, Vertical
from textual.widgets import Button, Input, Label, TextArea

from phantomstalker.services.copilot import (
    ACTION_LABELS,
    Action,
    CopilotError,
    CopilotRefusal,
    CopilotRequest,
)

if TYPE_CHECKING:
    from phantomstalker.app import PhantomStalkerApp


class CopilotView(Vertical):
    DEFAULT_CSS = """
    CopilotView { padding: 0 1; }
    CopilotView Label { color: $text-muted; margin-top: 1; }
    CopilotView #draft { height: 1fr; min-height: 5; }
    CopilotView #result { height: 1fr; min-height: 5; }
    CopilotView #actions { height: auto; }
    CopilotView #actions Button { min-width: 10; margin-right: 1; }
    CopilotView #language { width: 1fr; min-width: 16; }
    CopilotView #result-actions { height: auto; }
    """

    def __init__(self, **kwargs) -> None:
        super().__init__(**kwargs)
        self._last: tuple[str, str] | None = None  # (original, action)
        self._busy = False

    @property
    def ps_app(self) -> PhantomStalkerApp:
        return self.app  # type: ignore[return-value]

    def compose(self) -> ComposeResult:
        yield Label("Твоя чернетка або отримане повідомлення:")
        yield TextArea(id="draft", soft_wrap=True, show_line_numbers=False)
        with Horizontal(id="actions"):
            for action in Action:
                variant = "primary" if action is Action.POLISH else "default"
                yield Button(ACTION_LABELS[action], id=f"act-{action.value}", variant=variant)
            yield Input(placeholder="мова перекладу", id="language")
        yield Label("Результат:")
        yield TextArea(id="result", read_only=True, soft_wrap=True, show_line_numbers=False)
        with Horizontal(id="result-actions"):
            yield Button("Зберегти чернетку", id="save-draft", disabled=True)
            yield Button("Взяти як нову чернетку", id="use-result", disabled=True)

    @on(Button.Pressed, "#actions Button")
    def _on_action(self, event: Button.Pressed) -> None:
        action = Action(event.button.id.removeprefix("act-"))  # type: ignore[union-attr]
        self.run_action_request(action)

    def run_action_request(self, action: Action) -> None:
        if self._busy:
            return
        text = self.query_one("#draft", TextArea).text
        if not text.strip():
            self.ps_app.react("empty_input")
            return
        if not self.ps_app.settings.has_api_key():
            self.ps_app.react("no_api_key")
            return
        language = self.query_one("#language", Input).value
        self._stream(CopilotRequest(action=action, text=text, target_language=language))

    @work(exclusive=True, group="copilot")
    async def _stream(self, request: CopilotRequest) -> None:
        result = self.query_one("#result", TextArea)
        self._set_busy(True)
        self.ps_app.react("copilot_start")
        chunks: list[str] = []
        result.text = ""
        try:
            async for chunk in self.ps_app.make_copilot().stream(request):
                chunks.append(chunk)
                result.text = "".join(chunks)
                result.scroll_end(animate=False)
        except CopilotRefusal:
            self.ps_app.react("copilot_refusal")
        except CopilotError as exc:
            self.ps_app.react("copilot_error", error=str(exc))
        except Exception as exc:  # непередбачене — не валимо застосунок
            self.ps_app.react("copilot_error", error=type(exc).__name__)
        else:
            self._last = (request.text, request.action.value)
            self.ps_app.react("copilot_done")
        finally:
            self._set_busy(False)

    def _set_busy(self, busy: bool) -> None:
        self._busy = busy
        if busy and isinstance(self.app.focused, Button):
            # інакше вимкнена кнопка передасть фокус полю мови, і гарячі клавіші
            # почнуть друкуватися туди
            self.app.set_focus(None)
        for button in self.query("#actions Button"):
            button.disabled = busy
        has_result = bool(self.query_one("#result", TextArea).text.strip()) and not busy
        self.query_one("#save-draft", Button).disabled = not (has_result and self._last)
        self.query_one("#use-result", Button).disabled = not has_result

    @on(Button.Pressed, "#save-draft")
    def _save_draft(self) -> None:
        if not self._last:
            return
        original, tone = self._last
        self.ps_app.crm.save_draft(original, self.query_one("#result", TextArea).text, tone)
        self.ps_app.react("draft_saved")

    @on(Button.Pressed, "#use-result")
    def _use_result(self) -> None:
        self.query_one("#draft", TextArea).text = self.query_one("#result", TextArea).text
        self.query_one("#draft", TextArea).focus()
