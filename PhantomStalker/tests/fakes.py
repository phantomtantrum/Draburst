"""Фейковий клієнт Anthropic, що імітує `client.beta.messages.stream(...)`."""

from __future__ import annotations

import asyncio
from types import SimpleNamespace
from typing import Any


class FakeStream:
    def __init__(self, chunks: list[str], stop_reason: str, delay: float = 0.0) -> None:
        self._chunks = chunks
        self._stop_reason = stop_reason
        self._delay = delay

    async def __aenter__(self) -> FakeStream:
        return self

    async def __aexit__(self, *exc: object) -> None:
        return None

    @property
    def text_stream(self):
        async def gen():
            for chunk in self._chunks:
                if self._delay:
                    await asyncio.sleep(self._delay)
                yield chunk

        return gen()

    async def get_final_message(self) -> Any:
        return SimpleNamespace(stop_reason=self._stop_reason, content=[])


class FakeClient:
    def __init__(self, chunks: list[str] | None = None, stop_reason: str = "end_turn",
                 error: Exception | None = None, delay: float = 0.0) -> None:
        self._delay = delay
        self.calls: list[dict[str, Any]] = []
        self._chunks = chunks if chunks is not None else ["Привіт", "! Як ти?"]
        self._stop_reason = stop_reason
        self._error = error
        self.beta = SimpleNamespace(messages=SimpleNamespace(stream=self._stream))

    def _stream(self, **kwargs: Any) -> FakeStream:
        self.calls.append(kwargs)
        if self._error is not None:
            raise self._error
        return FakeStream(self._chunks, self._stop_reason, self._delay)
