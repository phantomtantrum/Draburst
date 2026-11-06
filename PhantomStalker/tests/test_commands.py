from datetime import date, datetime

import pytest

from phantomstalker.core.commands import (
    AskSecret,
    Clear,
    CommandError,
    CommandProcessor,
    Confirm,
    Exit,
    Say,
    StreamAction,
    match_commands,
    mention_context,
    parse_add,
    parse_day,
    resolve_contact,
)
from phantomstalker.services.copilot import Action
from phantomstalker.services.crm import CRMRepository
from phantomstalker.services.settings import SettingsService

TODAY = date(2026, 11, 6)


@pytest.fixture
def env(conn, keyring_backend):
    crm = CRMRepository(conn)
    settings = SettingsService(conn, keyring_backend)
    last = {"text": ""}
    proc = CommandProcessor(crm, settings, lambda: last["text"], today=lambda: TODAY)
    return crm, settings, proc, last


def test_match_commands():
    assert [c.name for c in match_commands("/sh")] == ["shorter", "show"]
    assert match_commands("/zzz") == []
    assert len(match_commands("/")) > 10


def test_parse_add():
    assert parse_add("Олена Петренко @olena #друзі #гори любить каву") == (
        "Олена Петренко", "@olena", ["друзі", "гори"], "любить каву")
    assert parse_add("Максим") == ("Максим", "", [], "")
    with pytest.raises(CommandError):
        parse_add("@nobody")


def test_parse_day():
    assert parse_day("14.03") == date(2000, 3, 14)
    assert parse_day("29.02") == date(2000, 2, 29)
    assert parse_day("1995-03-14") == date(1995, 3, 14)
    with pytest.raises(CommandError):
        parse_day("31.02")


def test_resolve_contact_multiword_handle_and_prefix(env):
    crm, *_ = env
    crm.add_contact("Олена Петренко", "@olena")
    crm.add_contact("Максим")
    c, rest = resolve_contact(crm, "олена петренко любить каву")
    assert c.name == "Олена Петренко" and rest == "любить каву"
    assert resolve_contact(crm, "@olena привіт")[0].name == "Олена Петренко"
    assert resolve_contact(crm, "Мак")[0].name == "Максим"
    with pytest.raises(CommandError):
        resolve_contact(crm, "Ігор")


def test_unknown_command_suggests(env):
    *_, proc, _ = env
    out = proc.run("/shor")
    assert isinstance(out, Say) and out.kind == "error" and "/shorter" in out.details[0]


def test_people_flow(env):
    crm, _, proc, _ = env
    out = proc.run("/add Олена @olena #друзі любить каву")
    assert isinstance(out, Say) and out.kind == "ok" and out.react[0] == "contact_added"
    assert proc.run("/add олена").kind == "error"  # дубль
    assert "Олена" in proc.run("/people").details[0]
    assert proc.run("/note Олена працює дизайнеркою").kind == "ok"
    assert "працює дизайнеркою" in crm.list_contacts()[0].notes
    assert proc.run("/date Олена 14.03 День народження").kind == "ok"
    assert proc.run("/met Олена про відпустку").kind == "ok"
    card = proc.run("/show олена")
    joined = "\n".join(card.details)
    assert "День народження: 14.03" in joined and "любить каву" in joined and "про відпустку" in joined


def test_rm_needs_confirmation(env):
    crm, _, proc, _ = env
    proc.run("/add Олена")
    out = proc.run("/rm Олена")
    assert isinstance(out, Confirm)
    assert crm.list_contacts()  # ще не видалено
    assert out.on_yes().kind == "ok"
    assert crm.list_contacts() == []


def test_remind(env):
    crm, _, proc, _ = env
    assert "немає" in proc.run("/remind").title
    crm.add_contact("Олена", created_at=datetime(2026, 1, 1))
    assert "Олена" in proc.run("/remind").details[0]


def test_actions_use_text_or_last_output(env):
    *_, proc, last = env
    out = proc.run("/polish привіт як ти")
    assert isinstance(out, StreamAction) and out.request.action is Action.POLISH
    assert out.request.text == "привіт як ти"
    assert proc.run("/shorter").kind == "error"  # нема ні тексту, ні попередньої відповіді
    last["text"] = "Довгий текст відповіді"
    assert proc.run("/shorter").request.text == "Довгий текст відповіді"
    tr = proc.run("/translate англійська добрий день")
    assert tr.request.action is Action.TRANSLATE and tr.request.target_language == "англійська"
    assert proc.run("/reply").kind == "error"


def test_settings_commands(env, keyring_backend):
    _, settings, proc, _ = env
    assert proc.run("/name Каспер").kind == "ok"
    assert settings.phantom_name == "Каспер"
    proc.run("/tone коротко й тепло")
    assert settings.tone_profile == "коротко й тепло"
    ask = proc.run("/key")
    assert isinstance(ask, AskSecret)
    saved = ask.on_submit("sk-ant-x")
    assert saved.kind == "ok" and "sk-ant-x" not in saved.title + "".join(saved.details)
    assert settings.get_api_key() == "sk-ant-x"


def test_clear_exit_help(env):
    *_, proc, _ = env
    assert isinstance(proc.run("/clear"), Clear)
    assert isinstance(proc.run("/exit"), Exit)
    assert any("/polish" in line for line in proc.run("/help").details)


def test_mention_context(env):
    crm, *_ = env
    c = crm.add_contact("Олена", "@olena", ["друзі"], "любить каву")
    crm.add_contact("Максим", notes="секрет")
    ctx = mention_context(crm, "що подарувати @олена?", today=TODAY)
    assert "<contact>" in ctx and "любить каву" in ctx and "секрет" not in ctx
    assert mention_context(crm, "просто текст") == ""
    assert c.id
