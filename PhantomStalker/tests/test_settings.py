import os

import pytest

from phantomstalker.services.settings import (
    DEFAULTS,
    KEYRING_API_KEY,
    KEYRING_SERVICE,
    SettingsService,
    load_dotenv,
)


def test_defaults_and_set(conn, keyring_backend):
    s = SettingsService(conn, keyring_backend)
    assert s.phantom_name == DEFAULTS["phantom_name"]
    s.set("phantom_name", "Каспер")
    assert SettingsService(conn, keyring_backend).phantom_name == "Каспер"


def test_api_key_lives_only_in_keyring(conn, keyring_backend):
    s = SettingsService(conn, keyring_backend)
    assert not s.has_api_key()
    s.set_api_key("sk-ant-test")
    assert keyring_backend.store[(KEYRING_SERVICE, KEYRING_API_KEY)] == "sk-ant-test"
    assert s.get_api_key() == "sk-ant-test"
    dumped = "\n".join(conn.iterdump())
    assert "sk-ant-test" not in dumped
    with pytest.raises(ValueError):
        s.set(KEYRING_API_KEY, "nope")
    s.clear_api_key()
    assert s.get_api_key() is None


def test_api_key_env_fallback(conn, keyring_backend, monkeypatch):
    monkeypatch.setenv("ANTHROPIC_API_KEY", "sk-env")
    assert SettingsService(conn, keyring_backend).get_api_key() == "sk-env"


def test_broken_keyring_falls_back(conn, monkeypatch):
    class Broken:
        def get_password(self, *a):
            raise RuntimeError("no backend")

    monkeypatch.setenv("ANTHROPIC_API_KEY", "sk-env")
    assert SettingsService(conn, Broken()).get_api_key() == "sk-env"  # type: ignore[arg-type]


def test_stale_after_days_validation(conn, keyring_backend):
    s = SettingsService(conn, keyring_backend)
    s.set("stale_after_days", "abc")
    assert s.stale_after_days == 30
    s.set("stale_after_days", "0")
    assert s.stale_after_days == 1


def test_load_dotenv(tmp_path, monkeypatch):
    monkeypatch.delenv("PS_TEST_A", raising=False)
    monkeypatch.setenv("PS_TEST_B", "kept")
    env = tmp_path / ".env"
    env.write_text('# коментар\nPS_TEST_A="hello"\nexport PS_TEST_B=overwritten\n', encoding="utf-8")
    load_dotenv(env)
    assert os.environ["PS_TEST_A"] == "hello"
    assert os.environ["PS_TEST_B"] == "kept"
