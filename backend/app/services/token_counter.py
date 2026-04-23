from __future__ import annotations

import logging
import threading
from typing import Any

logger = logging.getLogger(__name__)

_state = threading.local()


def _get() -> tuple[int, int]:
    return getattr(_state, "tokens_in", 0), getattr(_state, "tokens_out", 0)


def reset() -> None:
    _state.tokens_in = 0
    _state.tokens_out = 0


def add(prompt_tokens: int, completion_tokens: int) -> None:
    tin, tout = _get()
    _state.tokens_in = tin + max(0, int(prompt_tokens or 0))
    _state.tokens_out = tout + max(0, int(completion_tokens or 0))


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
    return _get()


def pop() -> tuple[int, int]:
    tokens_in, tokens_out = _get()
    reset()
    return tokens_in, tokens_out
