"""Модальні форми: контакт, важлива дата, підтвердження."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date

from textual import on
from textual.app import ComposeResult
from textual.binding import Binding
from textual.containers import Horizontal, Vertical, VerticalScroll
from textual.screen import ModalScreen
from textual.widgets import Button, Checkbox, Input, Label, TextArea

from phantomstalker.services.crm import Contact, parse_user_date

# Центрування модальних екранів задане глобально в App.CSS (DEFAULT_CSS — scoped).
FORM_CSS = """
.form-box {
    width: 64;
    height: auto;
    max-height: 90%;
    padding: 1 2;
    border: round $primary;
    background: $surface;
}
.form-box Label { color: $text-muted; }
.form-box .title { color: $primary; text-style: bold; margin-top: 0; }
.form-box .error { color: $error; }
.form-box #notes { height: 6; }
.form-buttons { height: auto; margin-top: 1; align-horizontal: right; }
.form-buttons Button { margin-left: 1; }
"""


@dataclass
class ContactFormResult:
    name: str
    handle: str
    tags: list[str]
    notes: str


class ContactForm(ModalScreen[ContactFormResult | None]):
    DEFAULT_CSS = FORM_CSS
    BINDINGS = [Binding("escape", "cancel", "Скасувати")]

    def __init__(self, contact: Contact | None = None) -> None:
        super().__init__(classes="form-screen")
        self.contact = contact

    def compose(self) -> ComposeResult:
        c = self.contact
        with VerticalScroll(classes="form-box"):
            yield Label("Редагувати контакт" if c else "Новий контакт", classes="title")
            yield Label("Ім'я *")
            yield Input(value=c.name if c else "", id="name", placeholder="Олена")
            yield Label("Нік / як зв'язатись")
            yield Input(value=c.handle if c else "", id="handle", placeholder="@olena")
            yield Label("Теги (через кому)")
            yield Input(value=", ".join(c.tags) if c else "", id="tags", placeholder="друзі, робота")
            yield Label("Нотатки (лише те, що ти знаєш сам або чим людина поділилась)")
            yield TextArea(c.notes if c else "", id="notes", soft_wrap=True)
            yield Label("", id="error", classes="error")
            with Horizontal(classes="form-buttons"):
                yield Button("Скасувати", id="cancel")
                yield Button("Зберегти", id="save", variant="primary")

    def on_mount(self) -> None:
        self.query_one("#name", Input).focus()

    @on(Button.Pressed, "#save")
    @on(Input.Submitted)
    def _save(self) -> None:
        name = self.query_one("#name", Input).value.strip()
        if not name:
            self.query_one("#error", Label).update("Вкажи ім'я.")
            return
        tags = [t.strip() for t in self.query_one("#tags", Input).value.split(",") if t.strip()]
        self.dismiss(ContactFormResult(
            name=name,
            handle=self.query_one("#handle", Input).value.strip(),
            tags=tags,
            notes=self.query_one("#notes", TextArea).text,
        ))

    @on(Button.Pressed, "#cancel")
    def action_cancel(self) -> None:
        self.dismiss(None)


@dataclass
class DateFormResult:
    label: str
    when: date
    recurring: bool


class DateForm(ModalScreen[DateFormResult | None]):
    DEFAULT_CSS = FORM_CSS
    BINDINGS = [Binding("escape", "cancel", "Скасувати")]

    def __init__(self, contact_name: str) -> None:
        super().__init__(classes="form-screen")
        self.contact_name = contact_name

    def compose(self) -> ComposeResult:
        with Vertical(classes="form-box"):
            yield Label(f"Важлива дата · {self.contact_name}", classes="title")
            yield Label("Що за подія *")
            yield Input(id="label", placeholder="День народження")
            yield Label("Дата * (РРРР-ММ-ДД або ДД.ММ.РРРР)")
            yield Input(id="date", placeholder="1995-03-14")
            yield Checkbox("Повторюється щороку", value=True, id="recurring")
            yield Label("", id="error", classes="error")
            with Horizontal(classes="form-buttons"):
                yield Button("Скасувати", id="cancel")
                yield Button("Зберегти", id="save", variant="primary")

    def on_mount(self) -> None:
        self.query_one("#label", Input).focus()

    @on(Button.Pressed, "#save")
    @on(Input.Submitted)
    def _save(self) -> None:
        label = self.query_one("#label", Input).value.strip()
        error = self.query_one("#error", Label)
        if not label:
            error.update("Вкажи назву події.")
            return
        try:
            when = parse_user_date(self.query_one("#date", Input).value)
        except ValueError as exc:
            error.update(str(exc))
            return
        self.dismiss(DateFormResult(label, when, self.query_one("#recurring", Checkbox).value))

    @on(Button.Pressed, "#cancel")
    def action_cancel(self) -> None:
        self.dismiss(None)


class ConfirmScreen(ModalScreen[bool]):
    DEFAULT_CSS = FORM_CSS
    BINDINGS = [Binding("escape", "cancel", "Ні"), Binding("y", "confirm", "Так")]

    def __init__(self, question: str) -> None:
        super().__init__(classes="form-screen")
        self.question = question

    def compose(self) -> ComposeResult:
        with Vertical(classes="form-box"):
            yield Label(self.question, classes="title")
            with Horizontal(classes="form-buttons"):
                yield Button("Ні", id="no")
                yield Button("Так", id="yes", variant="error")

    @on(Button.Pressed, "#yes")
    def action_confirm(self) -> None:
        self.dismiss(True)

    @on(Button.Pressed, "#no")
    def action_cancel(self) -> None:
        self.dismiss(False)
