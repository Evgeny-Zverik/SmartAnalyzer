from __future__ import annotations

import logging
from contextvars import ContextVar
from typing import Any

logger = logging.getLogger(__name__)

_tokens_in: ContextVar[int] = ContextVar("llm_tokens_in", default=0)
_tokens_out: ContextVar[int] = ContextVar("llm_tokens_out", default=0)


def reset() -> None:
    _tokens_in.set(0)
    _tokens_out.set(0)


def add(prompt_tokens: int, completion_tokens: int) -> None:
    _tokens_in.set(_tokens_in.get() + max(0, int(prompt_tokens or 0)))
    _tokens_out.set(_tokens_out.get() + max(0, int(completion_tokens or 0)))


def capture_from_response(response: Any) -> None:
    try:
        usage = getattr(response, "usage", None)
        if usage is None:
            return
        prompt = getattr(usage, "prompt_tokens", 0) or 0
        completion = getattr(usage, "completion_tokens", 0) or 0
        add(int(prompt), int(completion))
    except Exception as exc:
        logger.debug("failed to capture llm token usage: %s", exc)


def snapshot() -> tuple[int, int]:
    return _tokens_in.get(), _tokens_out.get()


def pop() -> tuple[int, int]:
    tokens_in, tokens_out = snapshot()
    reset()
    return tokens_in, tokens_out
