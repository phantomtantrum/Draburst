"""Smoke-тести консолі через Textual Pilot (без мережі)."""

from __future__ import annotations

from datetime import datetime

from phantomstalker.app import PhantomStalkerApp
from phantomstalker.core.persona import Mood
from phantomstalker.services.copilot import CopilotService
from phantomstalker.ui.console import Entry
from tests.fakes import FakeClient

SIZE = (110, 40)


def make_app(conn, keyring_backend, client: FakeClient | None = None, key: bool = True) -> PhantomStalkerApp:
    client = client or FakeClient()
    if key:
        keyring_backend.set_password("phantomstalker", "anthropic_api_key", "sk")
    return PhantomStalkerApp(
        db=conn, keyring_backend=keyring_backend, animate=False,
        copilot_factory=lambda app: CopilotService(api_key="sk", phantom_name=app.settings.phantom_name,
                                                    client_factory=lambda _k: client),
    )


def log_text(app: PhantomStalkerApp) -> str:
    from rich.console import Console

    console = Console(width=200, record=True, file=open("/dev/null", "w"))
    for entry in app.query(Entry):
        console.print(entry.body)
    return console.export_text()


async def submit(app, pilot, text: str) -> None:
    app.prompt.value = text
    await pilot.press("enter")
    await pilot.pause()


async def test_welcome_and_key_hint(conn, keyring_backend):
    app = make_app(conn, keyring_backend, key=False)
    async with app.run_test(size=SIZE):
        text = log_text(app)
        assert "PhantomStalker" in text and "/key" in text
        assert app.focused is app.prompt


async def test_greeting_mentions_stale_contact(conn, keyring_backend):
    app = make_app(conn, keyring_backend)
    app.crm.add_contact("Олена", created_at=datetime(2025, 1, 1))
    async with app.run_test(size=SIZE):
        assert "Олена" in log_text(app)


async def test_chat_streams_with_history_and_mentions(conn, keyring_backend):
    client = FakeClient(["Привіт", "! Чим допомогти?"])
    app = make_app(conn, keyring_backend, client)
    app.crm.add_contact("Олена", notes="любить каву")
    async with app.run_test(size=SIZE) as pilot:
        await submit(app, pilot, "що написати @Олена?")
        await app.workers.wait_for_complete()
        await pilot.pause()
        assert "Привіт! Чим допомогти?" in log_text(app)
        assert app.persona.mood is Mood.HAPPY
        sent = client.calls[0]["messages"]
        assert sent[0]["role"] == "user" and "любить каву" in sent[0]["content"]
        assert [m["role"] for m in app.chat_history] == ["user", "assistant"]
        # наступна дія без тексту бере останню відповідь
        await submit(app, pilot, "/shorter")
        await app.workers.wait_for_complete()
        assert "Привіт! Чим допомогти?" in client.calls[1]["messages"][0]["content"]
        assert len(app.chat_history) == 4


async def test_without_key_nothing_is_sent(conn, keyring_backend):
    client = FakeClient()
    app = make_app(conn, keyring_backend, client, key=False)
    async with app.run_test(size=SIZE) as pilot:
        await submit(app, pilot, "привіт")
        assert client.calls == []
        assert app.persona.mood is Mood.ALERT
        assert app.chat_history == []


async def test_commands_and_autocomplete(conn, keyring_backend):
    app = make_app(conn, keyring_backend)
    async with app.run_test(size=SIZE) as pilot:
        await pilot.press("slash", "p", "e")
        assert [c.name for c in app.suggest.items] == ["people"]
        await pilot.press("tab")
        assert app.prompt.value == "/people "
        app.prompt.value = ""
        await submit(app, pilot, "/add Олена @olena #друзі")
        await submit(app, pilot, "/peo")  # Enter виконує виділену підказку
        text = log_text(app)
        assert "Додано" in text and "Олена · @olena · #друзі" in text and "Люди (1)" in text


async def test_history_navigation(conn, keyring_backend):
    app = make_app(conn, keyring_backend)
    async with app.run_test(size=SIZE) as pilot:
        await submit(app, pilot, "/remind")
        await submit(app, pilot, "/people")
        await pilot.press("up")
        assert app.prompt.value == "/people"
        await pilot.press("up")
        assert app.prompt.value == "/remind"
        await pilot.press("down", "down")
        assert app.prompt.value == ""


async def test_rm_confirmation(conn, keyring_backend):
    app = make_app(conn, keyring_backend)
    app.crm.add_contact("Олена")
    async with app.run_test(size=SIZE) as pilot:
        await submit(app, pilot, "/rm Олена")
        await submit(app, pilot, "n")
        assert app.crm.list_contacts()
        await submit(app, pilot, "/rm Олена")
        await submit(app, pilot, "так")
        assert app.crm.list_contacts() == []


async def test_key_is_masked_and_not_logged(conn, keyring_backend):
    app = make_app(conn, keyring_backend, key=False)
    async with app.run_test(size=SIZE) as pilot:
        await submit(app, pilot, "/key")
        assert app.prompt.password
        await submit(app, pilot, "sk-ant-secret")
        assert not app.prompt.password
        assert app.settings.get_api_key() == "sk-ant-secret"
        assert "sk-ant-secret" not in log_text(app)
        await pilot.press("up")
        assert app.prompt.value == "/key"  # секрету в історії немає


async def test_escape_cancels_pending_and_clear(conn, keyring_backend):
    app = make_app(conn, keyring_backend)
    async with app.run_test(size=SIZE) as pilot:
        await submit(app, pilot, "/key")
        await pilot.press("escape")
        assert not app.prompt.password
        await submit(app, pilot, "/clear")
        assert "/key" not in log_text(app)


async def test_escape_interrupts_stream(conn, keyring_backend):
    client = FakeClient(["раз ", "два ", "три"], delay=0.3)
    app = make_app(conn, keyring_backend, client)
    async with app.run_test(size=SIZE) as pilot:
        await submit(app, pilot, "розкажи щось")
        await pilot.pause(0.4)
        await pilot.press("escape")
        await app.workers.wait_for_complete()
        await pilot.pause()
        assert "Перервано" in log_text(app)
        assert app.chat_history == []  # незавершена пара не потрапляє в історію
        assert not app.status.busy
