"""Модуль «Люди»: особиста CRM з ручним введенням."""

from __future__ import annotations

from datetime import date
from typing import TYPE_CHECKING

from rich.text import Text
from textual import on
from textual.app import ComposeResult
from textual.binding import Binding
from textual.containers import Horizontal, Vertical, VerticalScroll
from textual.widgets import Button, DataTable, Input, Static

from phantomstalker.services.crm import Contact, humanize_days
from phantomstalker.ui.forms import ConfirmScreen, ContactForm, ContactFormResult, DateForm, DateFormResult

if TYPE_CHECKING:
    from phantomstalker.app import PhantomStalkerApp


class PeopleView(Vertical):
    DEFAULT_CSS = """
    PeopleView { padding: 0 1; }
    PeopleView #search { margin-bottom: 1; }
    PeopleView #people-main { height: 1fr; }
    PeopleView #contacts { width: 3fr; }
    PeopleView #details { width: 2fr; padding: 0 1; border-left: tall $primary 40%; }
    PeopleView #people-actions { height: auto; margin-top: 1; }
    PeopleView #people-actions Button { margin-right: 1; min-width: 8; }
    """

    BINDINGS = [
        Binding("a", "add", "додати"),
        Binding("e", "edit", "редагувати"),
        Binding("c", "contacted", "спілкувались"),
        Binding("d", "add_date", "дата"),
        Binding("delete", "delete", "видалити"),
    ]

    @property
    def ps_app(self) -> PhantomStalkerApp:
        return self.app  # type: ignore[return-value]

    def compose(self) -> ComposeResult:
        yield Input(placeholder="Пошук за ім'ям, ніком, тегами чи нотатками…", id="search")
        with Horizontal(id="people-main"):
            yield DataTable(id="contacts", cursor_type="row", zebra_stripes=True)
            with VerticalScroll(id="details"):
                yield Static("Обери людину зі списку.", id="detail-text")
        with Horizontal(id="people-actions"):
            yield Button("+ Додати", id="add", variant="primary")
            yield Button("Редагувати", id="edit")
            yield Button("Спілкувались сьогодні", id="contacted")
            yield Button("Важлива дата", id="add-date")
            yield Button("Видалити", id="delete", variant="error")

    def on_mount(self) -> None:
        table = self.query_one(DataTable)
        table.add_columns("Ім'я", "Нік", "Теги", "Востаннє")
        self.refresh_contacts()

    # --- дані --------------------------------------------------------------
    def refresh_contacts(self, select_id: int | None = None) -> None:
        table = self.query_one(DataTable)
        search = self.query_one("#search", Input).value
        today = date.today()
        stale = self.ps_app.settings.stale_after_days
        table.clear()
        for contact in self.ps_app.crm.list_contacts(search or None):
            days = contact.days_since_contact(today)
            last = Text(humanize_days(days))
            if days is None or days >= stale:
                last.stylize("bold #E8553A")
            table.add_row(contact.name, contact.handle, ", ".join(contact.tags), last,
                          key=str(contact.id))
        if select_id is not None:
            try:
                table.move_cursor(row=table.get_row_index(str(select_id)))
            except Exception:
                pass
        self._show_details(self.selected_contact())

    def selected_contact(self) -> Contact | None:
        table = self.query_one(DataTable)
        if table.row_count == 0:
            return None
        try:
            key = table.coordinate_to_cell_key(table.cursor_coordinate).row_key.value
        except Exception:
            return None
        try:
            return self.ps_app.crm.get_contact(int(key))  # type: ignore[arg-type]
        except (KeyError, TypeError, ValueError):
            return None

    def _show_details(self, contact: Contact | None) -> None:
        panel = self.query_one("#detail-text", Static)
        if contact is None:
            panel.update("Поки що нікого немає. Натисни «+ Додати» (a).")
            return
        crm = self.ps_app.crm
        today = date.today()
        out = Text()
        out.append(f"{contact.name}\n", style="bold #FF8C42")
        if contact.handle:
            out.append(f"{contact.handle}\n")
        if contact.tags:
            out.append(f"# {', '.join(contact.tags)}\n", style="dim")
        out.append(f"\nВостаннє: {humanize_days(contact.days_since_contact(today))}\n")
        dates = crm.list_important_dates(contact.id)
        if dates:
            out.append("\nВажливі дати:\n", style="bold")
            for d in sorted(dates, key=lambda x: x.next_occurrence(today) or date.max):
                nxt = d.next_occurrence(today)
                suffix = f" (через {(nxt - today).days} дн.)" if nxt else " (минула)"
                out.append(f"  • {d.label}: {d.date:%d.%m}{'' if d.recurring else f'.{d.date:%Y}'}{suffix}\n")
        if contact.notes.strip():
            out.append("\nНотатки:\n", style="bold")
            out.append(contact.notes.strip() + "\n")
        history = crm.list_interactions(contact.id)[:5]
        if history:
            out.append("\nОстанні розмови:\n", style="bold")
            for item in history:
                summary = f" — {item.summary}" if item.summary else ""
                out.append(f"  • {item.date:%d.%m.%Y}{summary}\n", style="dim")
        panel.update(out)

    # --- події -------------------------------------------------------------
    @on(Input.Changed, "#search")
    def _on_search(self) -> None:
        self.refresh_contacts()

    @on(DataTable.RowHighlighted)
    def _on_row(self) -> None:
        self._show_details(self.selected_contact())

    @on(Button.Pressed, "#add")
    def action_add(self) -> None:
        def done(result: ContactFormResult | None) -> None:
            if result is None:
                return
            contact = self.ps_app.crm.add_contact(result.name, result.handle, result.tags, result.notes)
            self.refresh_contacts(select_id=contact.id)
            self.ps_app.react("contact_added", name=contact.name)

        self.app.push_screen(ContactForm(), done)

    @on(Button.Pressed, "#edit")
    def action_edit(self) -> None:
        contact = self.selected_contact()
        if contact is None:
            return

        def done(result: ContactFormResult | None) -> None:
            if result is None:
                return
            self.ps_app.crm.update_contact(contact.id, name=result.name, handle=result.handle,
                                           tags=result.tags, notes=result.notes)
            self.refresh_contacts(select_id=contact.id)
            self.ps_app.react("contact_updated", name=result.name)

        self.app.push_screen(ContactForm(contact), done)

    @on(Button.Pressed, "#contacted")
    def action_contacted(self) -> None:
        contact = self.selected_contact()
        if contact is None:
            return
        self.ps_app.crm.mark_contacted(contact.id)
        self.refresh_contacts(select_id=contact.id)
        self.ps_app.react("contacted", name=contact.name)

    @on(Button.Pressed, "#add-date")
    def action_add_date(self) -> None:
        contact = self.selected_contact()
        if contact is None:
            return

        def done(result: DateFormResult | None) -> None:
            if result is None:
                return
            self.ps_app.crm.add_important_date(contact.id, result.label, result.when, result.recurring)
            self.refresh_contacts(select_id=contact.id)
            self.ps_app.react("date_added", label=result.label)

        self.app.push_screen(DateForm(contact.name), done)

    @on(Button.Pressed, "#delete")
    def action_delete(self) -> None:
        contact = self.selected_contact()
        if contact is None:
            return

        def done(confirmed: bool | None) -> None:
            if not confirmed:
                return
            self.ps_app.crm.delete_contact(contact.id)
            self.refresh_contacts()
            self.ps_app.react("contact_deleted", name=contact.name)

        self.app.push_screen(ConfirmScreen(f"Видалити «{contact.name}» і всю історію?"), done)
