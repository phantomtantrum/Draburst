"""Налаштування, довідка та заглушки модулів наступних версій."""

from __future__ import annotations

from typing import TYPE_CHECKING

from textual import on
from textual.app import ComposeResult
from textual.binding import Binding
from textual.containers import Horizontal, VerticalScroll
from textual.screen import ModalScreen
from textual.widgets import Button, Input, Label, Markdown, Static

from phantomstalker.ui.forms import FORM_CSS

if TYPE_CHECKING:
    from phantomstalker.app import PhantomStalkerApp


class SettingsScreen(ModalScreen[bool]):
    DEFAULT_CSS = FORM_CSS + """
    SettingsScreen .form-box { width: 72; }
    SettingsScreen Input { margin-bottom: 1; }
    """
    BINDINGS = [Binding("escape", "cancel", "Назад")]

    def __init__(self) -> None:
        super().__init__(classes="form-screen")

    @property
    def ps_app(self) -> PhantomStalkerApp:
        return self.app  # type: ignore[return-value]

    def compose(self) -> ComposeResult:
        s = self.ps_app.settings
        key_state = "збережено ✓" if s.has_api_key() else "не задано"
        with VerticalScroll(classes="form-box"):
            yield Label("Налаштування", classes="title")
            yield Label("Ім'я фантома")
            yield Input(compact=True, value=s.phantom_name, id="phantom_name")
            yield Label("Профіль тону (як ти зазвичай пишеш)")
            yield Input(compact=True, value=s.tone_profile, id="tone_profile")
            yield Label("Мова перекладу за замовчуванням")
            yield Input(compact=True, value=s.get("default_language"), id="default_language")
            yield Label("Модель Claude")
            yield Input(compact=True, value=s.model, id="model")
            yield Label("Нагадувати, якщо не спілкувались (днів)")
            yield Input(compact=True, value=str(s.stale_after_days), id="stale_after_days", type="integer")
            yield Label(f"Ключ Anthropic API ({key_state}, у системному keyring)")
            yield Input(compact=True, password=True, id="api_key", placeholder="залиш порожнім, щоб не змінювати")
            yield Label("", id="error", classes="error")
            with Horizontal(classes="form-buttons"):
                yield Button("Видалити ключ", id="clear-key", variant="error")
                yield Button("Скасувати", id="cancel")
                yield Button("Зберегти", id="save", variant="primary")

    def on_mount(self) -> None:
        self.query_one("#phantom_name", Input).focus()

    @on(Button.Pressed, "#save")
    @on(Input.Submitted)
    def _save(self) -> None:
        s = self.ps_app.settings
        for key in ("phantom_name", "tone_profile", "default_language", "model", "stale_after_days"):
            value = self.query_one(f"#{key}", Input).value.strip()
            if value:
                s.set(key, value)
        api_key = self.query_one("#api_key", Input).value.strip()
        if api_key:
            try:
                s.set_api_key(api_key)
            except Exception as exc:
                self.query_one("#error", Label).update(
                    f"Не вдалося зберегти ключ у keyring ({type(exc).__name__}). "
                    "Можна задати ANTHROPIC_API_KEY у .env."
                )
                return
        self.dismiss(True)

    @on(Button.Pressed, "#clear-key")
    def _clear_key(self) -> None:
        self.ps_app.settings.clear_api_key()
        self.query_one("#error", Label).update("Ключ видалено з keyring.")

    @on(Button.Pressed, "#cancel")
    def action_cancel(self) -> None:
        self.dismiss(False)


HELP_TEXT = """\
# Довідка

| Клавіша | Дія |
|---|---|
| `1`–`4` | перемкнути модуль (Чат · Люди · Слід · Коуч) |
| `Tab` | наступний модуль (у формах — наступне поле) |
| `/` | командна палітра |
| `s` | налаштування |
| `?` | ця довідка |
| `Esc` | назад / зняти фокус з поля |
| `q` | вихід |

**Люди:** `a` додати · `e` редагувати · `c` спілкувались сьогодні · `d` важлива дата · `Del` видалити

**Приватність.** Усе зберігається локально. Назовні йде лише текст, який ти сам
надсилаєш у Claude API. Ключ API — тільки в системному keyring.
PhantomStalker не збирає даних про інших людей і не шукає нікого в мережі.
"""


class HelpScreen(ModalScreen[None]):
    DEFAULT_CSS = FORM_CSS + """
    HelpScreen .form-box { width: 76; }
    """
    BINDINGS = [Binding("escape,question_mark,q", "close", "Закрити")]

    def __init__(self) -> None:
        super().__init__(classes="form-screen")

    def compose(self) -> ComposeResult:
        with VerticalScroll(classes="form-box"):
            yield Markdown(HELP_TEXT)
            with Horizontal(classes="form-buttons"):
                yield Button("Зрозуміло", id="close", variant="primary")

    @on(Button.Pressed, "#close")
    def action_close(self) -> None:
        self.dismiss(None)


class ComingSoonView(Static):
    DEFAULT_CSS = """
    ComingSoonView { padding: 1 2; color: $text-muted; }
    """

    def __init__(self, title: str, version: str, body: str, **kwargs) -> None:
        text = f"[b $primary]{title}[/] — з'явиться у {version}\n\n{body}"
        super().__init__(text, **kwargs)


FOOTPRINT_BODY = (
    "Перевірка ТВОЄЇ пошти та ніків на витоки (HaveIBeenPwned), поради з приватності.\n"
    "Лише власні дані — після екрана підтвердження власності й згоди."
)
COACH_BODY = (
    "Підготовка до складних розмов, репетиція, допомога сформулювати думку,\n"
    "підказки для нетворкінгу. Коучинг для тебе."
)
