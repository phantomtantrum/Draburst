"""Smoke-тести TUI через Textual Pilot (без мережі)."""

from __future__ import annotations

from datetime import datetime

from textual.widgets import DataTable, TabbedContent, TextArea

from phantomstalker.app import PhantomStalkerApp
from phantomstalker.core.persona import Mood
from phantomstalker.services.copilot import CopilotService
from phantomstalker.ui.forms import ContactForm
from phantomstalker.ui.screens import HelpScreen, SettingsScreen
from tests.fakes import FakeClient


def make_app(conn, keyring_backend, client: FakeClient | None = None) -> PhantomStalkerApp:
    client = client or FakeClient()

    def factory(app: PhantomStalkerApp) -> CopilotService:
        return CopilotService(api_key="sk-test", phantom_name=app.settings.phantom_name,
                              client_factory=lambda _k: client)

    return PhantomStalkerApp(db=conn, keyring_backend=keyring_backend,
                             copilot_factory=factory, animate=False)


async def test_starts_with_greeting_and_tabs(conn, keyring_backend):
    app = make_app(conn, keyring_backend)
    async with app.run_test(size=(120, 40)) as pilot:
        assert app.persona.line
        assert "ключ API" in app.persona.line  # ключа ще немає — фантом підказує
        tabs = app.query_one(TabbedContent)
        assert tabs.active == "chat"
        await pilot.press("2")
        assert tabs.active == "people"
        await pilot.press("tab")
        assert tabs.active == "footprint"
        await pilot.press("4")
        assert tabs.active == "coach"
        await pilot.press("1")
        assert tabs.active == "chat"


async def test_greeting_mentions_stale_contact(conn, keyring_backend):
    app = make_app(conn, keyring_backend)
    app.crm.add_contact("Олена", created_at=datetime(2025, 1, 1))
    keyring_backend.set_password("phantomstalker", "anthropic_api_key", "sk")
    async with app.run_test(size=(120, 40)):
        assert "Олена" in app.persona.line


async def test_help_and_settings_screens(conn, keyring_backend):
    app = make_app(conn, keyring_backend)
    async with app.run_test(size=(120, 40)) as pilot:
        await pilot.press("question_mark")
        assert isinstance(app.screen, HelpScreen)
        await pilot.press("escape")
        await pilot.press("s")
        assert isinstance(app.screen, SettingsScreen)
        name_input = app.screen.query_one("#phantom_name")
        name_input.value = "Каспер"
        app.screen.query_one("#api_key").value = "sk-ant-new"
        await pilot.click("#save")
        await pilot.pause()
        assert not isinstance(app.screen, SettingsScreen)
        assert app.settings.phantom_name == "Каспер"
        assert app.persona.name == "Каспер"
        assert app.settings.get_api_key() == "sk-ant-new"


async def test_copilot_streams_result(conn, keyring_backend):
    keyring_backend.set_password("phantomstalker", "anthropic_api_key", "sk")
    client = FakeClient(["Привіт", "! Як справи?"])
    app = make_app(conn, keyring_backend, client)
    async with app.run_test(size=(140, 45)) as pilot:
        app.query_one("#draft", TextArea).text = "привіт як справи"
        await pilot.click("#act-polish")
        await app.workers.wait_for_complete()
        await pilot.pause()
        assert app.query_one("#result", TextArea).text == "Привіт! Як справи?"
        assert app.persona.mood is Mood.HAPPY
        assert client.calls and client.calls[0]["messages"][0]["content"].endswith("</text>")
        # фокус не «перестрибує» в поле мови — гарячі клавіші працюють далі
        await pilot.press("2")
        assert app.query_one(TabbedContent).active == "people"
        assert app.query_one("#language").value == ""
        await pilot.press("1")
        await pilot.click("#save-draft")
        assert app.crm.count_drafts() == 1


async def test_copilot_without_key_alerts(conn, keyring_backend):
    client = FakeClient()
    app = make_app(conn, keyring_backend, client)
    async with app.run_test(size=(140, 45)) as pilot:
        app.query_one("#draft", TextArea).text = "привіт"
        await pilot.click("#act-polish")
        await pilot.pause()
        assert app.persona.mood is Mood.ALERT
        assert client.calls == []


async def test_typing_digits_in_draft_does_not_switch_tabs(conn, keyring_backend):
    app = make_app(conn, keyring_backend)
    async with app.run_test(size=(140, 45)) as pilot:
        app.query_one("#draft", TextArea).focus()
        await pilot.press("2", "q", "s", "slash")
        assert app.query_one(TabbedContent).active == "chat"
        assert app.query_one("#draft", TextArea).text == "2qs/"


async def test_add_contact_flow(conn, keyring_backend):
    app = make_app(conn, keyring_backend)
    async with app.run_test(size=(140, 45)) as pilot:
        await pilot.press("2")
        await pilot.click("#add")
        assert isinstance(app.screen, ContactForm)
        await pilot.press(*"Олена")
        await pilot.press("enter")
        await pilot.pause()
        assert [c.name for c in app.crm.list_contacts()] == ["Олена"]
        assert app.query_one("#contacts", DataTable).row_count == 1
        assert app.persona.mood is Mood.HAPPY
        await pilot.click("#contacted")
        assert app.crm.list_contacts()[0].last_contacted_at is not None
