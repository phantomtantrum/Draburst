import anthropic
import httpx2
import pytest

from phantomstalker.services.copilot import (
    DEFAULT_MODEL,
    FALLBACK_BETA,
    Action,
    CopilotError,
    CopilotRefusal,
    CopilotRequest,
    CopilotService,
    build_system_prompt,
    build_user_prompt,
)
from tests.fakes import FakeClient


def service(client: FakeClient, **kw) -> CopilotService:
    return CopilotService(api_key="sk-test", client_factory=lambda _key: client, **kw)


async def collect(svc: CopilotService, req: CopilotRequest) -> str:
    return "".join([chunk async for chunk in svc.stream(req)])


def test_system_prompt_carries_name_tone_and_bounds():
    prompt = build_system_prompt("Каспер", "коротко й тепло")
    assert "Каспер" in prompt
    assert "коротко й тепло" in prompt
    assert "impersonate" in prompt and "spam" in prompt


@pytest.mark.parametrize("action", list(Action))
def test_user_prompt_wraps_text(action):
    prompt = build_user_prompt(CopilotRequest(action, "  привіт  ", target_language="English"))
    assert "<text>\nпривіт\n</text>" in prompt
    if action is Action.TRANSLATE:
        assert "English" in prompt


def test_translate_uses_default_language_when_empty():
    prompt = build_user_prompt(CopilotRequest(Action.TRANSLATE, "hi"), default_language="українська")
    assert "українська" in prompt


def test_context_is_included():
    prompt = build_user_prompt(CopilotRequest(Action.REPLY, "hi", context="колега"))
    assert "<context>\nколега\n</context>" in prompt


async def test_stream_yields_chunks_and_sends_expected_params():
    client = FakeClient(["Привіт", "! Як ти?"])
    svc = service(client, phantom_name="Каспер", tone_profile="тепло")
    out = await collect(svc, CopilotRequest(Action.POLISH, "привіт як ти"))
    assert out == "Привіт! Як ти?"
    (call,) = client.calls
    assert call["model"] == DEFAULT_MODEL
    assert call["betas"] == [FALLBACK_BETA]
    assert call["fallbacks"] == "default"
    assert call["output_config"] == {"effort": "low"}
    assert "Каспер" in call["system"]
    assert call["messages"][0]["role"] == "user"
    assert "привіт як ти" in call["messages"][0]["content"]


async def test_empty_text_raises_without_calling_api():
    client = FakeClient()
    with pytest.raises(CopilotError):
        await collect(service(client), CopilotRequest(Action.POLISH, "   "))
    assert client.calls == []


async def test_refusal_raises():
    client = FakeClient(["…"], stop_reason="refusal")
    with pytest.raises(CopilotRefusal):
        await collect(service(client), CopilotRequest(Action.POLISH, "x"))


async def test_max_tokens_appends_marker():
    client = FakeClient(["довгий текст"], stop_reason="max_tokens")
    out = await collect(service(client), CopilotRequest(Action.POLISH, "x"))
    assert out.endswith("[…відповідь обрізано]")


def _status_error(cls, status: int) -> Exception:
    request = httpx2.Request("POST", "https://api.anthropic.com/v1/messages")
    response = httpx2.Response(status, request=request)
    return cls("boom", response=response, body=None)


@pytest.mark.parametrize(
    ("error", "fragment"),
    [
        (lambda: _status_error(anthropic.AuthenticationError, 401), "Ключ API"),
        (lambda: _status_error(anthropic.RateLimitError, 429), "Забагато запитів"),
        (lambda: _status_error(anthropic.InternalServerError, 500), "500"),
        (lambda: anthropic.APIConnectionError(
            request=httpx2.Request("POST", "https://api.anthropic.com")), "з'єднання"),
    ],
)
async def test_api_errors_become_friendly(error, fragment):
    client = FakeClient(error=error())
    with pytest.raises(CopilotError, match=fragment):
        await collect(service(client), CopilotRequest(Action.POLISH, "x"))
