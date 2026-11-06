from datetime import date, datetime

import pytest

from phantomstalker.services.crm import CRMRepository, ImportantDate, humanize_days, parse_user_date


@pytest.fixture
def crm(conn) -> CRMRepository:
    return CRMRepository(conn)


def test_add_get_list_contact(crm):
    c = crm.add_contact("Олена", "@olena", ["друзі", " робота "], "любить каву")
    assert c.id > 0
    assert c.tags == ["друзі", "робота"]
    assert crm.get_contact(c.id).notes == "любить каву"
    assert [x.name for x in crm.list_contacts()] == ["Олена"]


def test_empty_name_rejected(crm):
    with pytest.raises(ValueError):
        crm.add_contact("   ")


def test_search(crm):
    crm.add_contact("Олена", tags=["друзі"])
    crm.add_contact("Максим", notes="колега з Києва")
    assert [c.name for c in crm.list_contacts("КИЄВА")] == ["Максим"]  # регістр кирилиці
    assert [c.name for c in crm.list_contacts("друзі")] == ["Олена"]


def test_update_and_delete_cascade(crm):
    c = crm.add_contact("Олена")
    crm.add_important_date(c.id, "ДН", date(1995, 3, 14))
    crm.mark_contacted(c.id, summary="кава")
    updated = crm.update_contact(c.id, handle="@o", tags=["сім'я"])
    assert updated.handle == "@o" and updated.tags == ["сім'я"] and updated.name == "Олена"
    crm.delete_contact(c.id)
    assert crm.list_contacts() == []
    assert crm.list_important_dates() == []
    with pytest.raises(KeyError):
        crm.get_contact(c.id)


def test_mark_contacted_logs_interaction(crm):
    c = crm.add_contact("Олена")
    when = datetime(2026, 11, 1, 18, 30)
    c = crm.mark_contacted(c.id, when=when, channel="telegram", summary="про відпустку")
    assert c.last_contacted_at == when
    assert c.days_since_contact(date(2026, 11, 6)) == 5
    (item,) = crm.list_interactions(c.id)
    assert item.channel == "telegram" and item.summary == "про відпустку"


def test_next_occurrence_recurring_and_leap_day():
    d = ImportantDate(1, 1, "ДН", date(1995, 3, 14), recurring=True)
    assert d.next_occurrence(date(2026, 3, 1)) == date(2026, 3, 14)
    assert d.next_occurrence(date(2026, 3, 15)) == date(2027, 3, 14)
    leap = ImportantDate(2, 1, "ДН", date(2000, 2, 29))
    assert leap.next_occurrence(date(2026, 1, 1)) == date(2026, 2, 28)
    once = ImportantDate(3, 1, "Весілля", date(2026, 5, 1), recurring=False)
    assert once.next_occurrence(date(2026, 6, 1)) is None


def test_reminders(crm):
    today = date(2026, 11, 6)
    olena = crm.add_contact("Олена", created_at=datetime(2026, 1, 1))
    max_ = crm.add_contact("Максим", created_at=datetime(2026, 1, 1))
    crm.mark_contacted(max_.id, when=datetime(2026, 11, 5))
    crm.add_important_date(max_.id, "День народження", date(1990, 11, 8))
    crm.add_important_date(olena.id, "Річниця", date(2020, 12, 25))  # поза горизонтом

    reminders = crm.reminders(today, stale_after_days=30, horizon_days=7)
    assert [r.kind for r in reminders] == ["date", "stale"]
    assert "Максим" in reminders[0].text and "через 2 дн." in reminders[0].text
    assert reminders[1].contact.id == olena.id


def test_save_draft(crm):
    crm.save_draft("привіт", "Привіт!", "polish")
    assert crm.count_drafts() == 1


def test_parse_user_date_and_humanize():
    assert parse_user_date("2026-03-14") == date(2026, 3, 14)
    assert parse_user_date("14.03.2026") == date(2026, 3, 14)
    with pytest.raises(ValueError):
        parse_user_date("завтра")
    assert humanize_days(None) == "ще не було"
    assert humanize_days(0) == "сьогодні"
    assert humanize_days(5) == "5 дн. тому"
