from __future__ import annotations

import json
import math
import re
import time
from typing import Any
from urllib.parse import urlsplit, urlunsplit

from openai import OpenAI

from app.core.logging import logger
from app.core.config import settings as app_settings
from app.services import token_counter
from app.utils.errors import raise_error

_client_cache: dict[tuple[str | None, str | None], OpenAI] = {}

MAX_SOURCE_CONTEXT_CHARS = 50000
COMPRESSION_LEVELS = {"off", "safe", "aggressive"}
TASK_KEYWORDS: dict[str, tuple[str, ...]] = {
    "analysis": (
        "risk",
        "срок",
        "обяз",
        "штраф",
        "liability",
        "penalty",
        "terminate",
        "termination",
        "payment",
        "invoice",
        "deadline",
        "date",
        "дата",
    ),
    "contract": (
        "agreement",
        "contract",
        "party",
        "обяз",
        "штраф",
        "penalty",
        "liability",
        "termination",
        "governing law",
        "срок",
        "payment",
        "confidential",
    ),
    "extraction": (
        "invoice",
        "total",
        "amount",
        "sum",
        "номер",
        "дата",
        "inn",
        "kpp",
        "iban",
        "swift",
        "email",
        "phone",
        "address",
    ),
}


def _is_llm_unavailable_error(e: Exception) -> bool:
    msg = str(e).lower()
    return any(
        s in msg
        for s in (
            "connection refused",
            "connection error",
            "connecterror",
            "timed out",
            "timeout",
            "name or service not known",
            "nodename nor servname provided",
            "temporary failure in name resolution",
        )
    )


def _summarize_llm_error(e: Exception, opts: dict[str, Any]) -> tuple[str, str]:
    message = str(e).strip()
    normalized = message.lower()
    model = (app_settings.openai_model or "").strip() or "gpt-4o-mini"
    base_url = (app_settings.openai_base_url or "").strip() or ""

    if _is_llm_unavailable_error(e):
        hint = (
            f"LLM service is unavailable at {base_url}. "
            "Start the service (for example, Ollama) or check OPENAI_API_KEY / OPENAI_BASE_URL."
        ).strip()
        return "LLM_UNAVAILABLE", hint

    if "404" in normalized and "model" in normalized:
        return "LLM_MODEL_NOT_FOUND", f"Model '{model}' was not found in the LLM service. Check the selected model name."

    if "model" in normalized and "not found" in normalized:
        return "LLM_MODEL_NOT_FOUND", f"Model '{model}' was not found in the LLM service. Check the selected model name."

    if "404" in normalized and "/v1" in normalized:
        return "LLM_BAD_BASE_URL", f"LLM endpoint was not found at {base_url}. Check that Base URL ends with /v1."

    if "unauthorized" in normalized or "invalid api key" in normalized or "incorrect api key" in normalized:
        return "LLM_AUTH_ERROR", "LLM authorization failed. Check the API key in LLM settings."

    if "rate limit" in normalized or "429" in normalized:
        return "LLM_RATE_LIMIT", "LLM rate limit exceeded. Retry later or use another model/provider."

    if message:
        short = message if len(message) <= 240 else f"{message[:237]}..."
        return "LLM_ERROR", f"LLM request failed: {short}"

    return "LLM_ERROR", "LLM request failed. Check LLM settings and try again."


def _build_openai_client(opts: dict[str, Any]) -> tuple[OpenAI, str]:
    # base_url / api_key / model are taken exclusively from environment settings.
    # Any user-supplied overrides for these fields are ignored.
    base_url = (app_settings.openai_base_url or "").strip() or None
    api_key = (app_settings.openai_api_key or "").strip() or None
    model = (app_settings.openai_model or "").strip() or "gpt-4o-mini"

    if not api_key:
        if base_url:
            api_key = "ollama"
        else:
            raise_error(
                500,
                "CONFIG_ERROR",
                "API key is not set. Set OPENAI_API_KEY in env or in LLM settings.",
                {},
            )

    normalized_url = _normalize_openai_base_url(base_url) if base_url else None
    cache_key = (normalized_url, api_key)
    client = _client_cache.get(cache_key)
    if client is None:
        client_kwargs: dict[str, Any] = {"api_key": api_key}
        if normalized_url:
            client_kwargs["base_url"] = normalized_url
        client = OpenAI(**client_kwargs)
        _client_cache[cache_key] = client

    return client, model


def _normalize_openai_base_url(base_url: str) -> str:
    normalized = base_url.strip().rstrip("/")
    if not normalized:
        return normalized

    parsed = urlsplit(normalized)
    path = parsed.path.rstrip("/")
    if not path:
        path = "/v1"
    elif not path.endswith("/v1"):
        path = f"{path}/v1"
    return urlunsplit((parsed.scheme, parsed.netloc, path, parsed.query, parsed.fragment))


def _extract_message_content(response: Any) -> str | None:
    choices = getattr(response, "choices", None)
    if isinstance(choices, list) and choices:
        first = choices[0]
        message = getattr(first, "message", None)
        if message is not None:
            content = getattr(message, "content", None)
            if isinstance(content, str) and content.strip():
                return content.strip()
        text = getattr(first, "text", None)
        if isinstance(text, str) and text.strip():
            return text.strip()

    # Some OpenAI-compatible backends expose a plain dict-like payload.
    if hasattr(response, "model_dump"):
        payload = response.model_dump()
    elif isinstance(response, dict):
        payload = response
    else:
        payload = None

    if isinstance(payload, dict):
        raw_choices = payload.get("choices")
        if isinstance(raw_choices, list) and raw_choices:
            first = raw_choices[0]
            if isinstance(first, dict):
                message = first.get("message")
                if isinstance(message, dict):
                    content = message.get("content")
                    if isinstance(content, str) and content.strip():
                        return content.strip()
                text = first.get("text")
                if isinstance(text, str) and text.strip():
                    return text.strip()

    return None


def _coerce_json_payload(content: str) -> str:
    raw = content.strip()
    if not raw:
        return raw

    fenced = re.match(r"^```(?:json)?\s*([\s\S]*?)\s*```$", raw, flags=re.IGNORECASE)
    if fenced:
        return fenced.group(1).strip()

    start = raw.find("{")
    end = raw.rfind("}")
    if start != -1 and end != -1 and end > start:
        candidate = raw[start : end + 1].strip()
        if candidate:
            return candidate

    return raw


def _normalize_compression_level(opts: dict[str, Any]) -> str:
    raw_level = opts.get("compression_level")
    if raw_level is None:
        analysis_mode = str(opts.get("analysis_mode") or "").strip().lower()
        if analysis_mode == "fast":
            raw_level = "aggressive"
        elif analysis_mode == "deep":
            raw_level = "safe"
    level = str(raw_level or "safe").strip().lower()
    return level if level in COMPRESSION_LEVELS else "safe"


def _split_context_blocks(text: str) -> list[str]:
    normalized = re.sub(r"\r\n?", "\n", text).strip()
    if not normalized:
        return []

    rough_blocks = re.split(r"\n{2,}", normalized)
    blocks: list[str] = []
    for rough_block in rough_blocks:
        block = re.sub(r"[ \t]+", " ", rough_block).strip()
        if not block:
            continue
        if len(block) <= 1200:
            blocks.append(block)
            continue
        sentences = re.split(r"(?<=[\.\!\?\n;:])\s+", block)
        current: list[str] = []
        current_len = 0
        for sentence in sentences:
            sentence = sentence.strip()
            if not sentence:
                continue
            extra = len(sentence) + (1 if current else 0)
            if current and current_len + extra > 900:
                blocks.append(" ".join(current))
                current = [sentence]
                current_len = len(sentence)
            else:
                current.append(sentence)
                current_len += extra
        if current:
            blocks.append(" ".join(current))
    return blocks


def _split_text_for_copyedit(text: str, max_chars: int = 3500) -> list[str]:
    normalized = re.sub(r"\r\n?", "\n", text).strip()
    if not normalized:
        return []

    paragraphs = re.split(r"\n{2,}", normalized)
    chunks: list[str] = []
    current: list[str] = []
    current_len = 0

    for paragraph in paragraphs:
        piece = paragraph.strip()
        if not piece:
            continue

        if len(piece) > max_chars:
            if current:
                chunks.append("\n\n".join(current))
                current = []
                current_len = 0
            for start in range(0, len(piece), max_chars):
                part = piece[start : start + max_chars].strip()
                if part:
                    chunks.append(part)
            continue

        extra = len(piece) + (2 if current else 0)
        if current and current_len + extra > max_chars:
            chunks.append("\n\n".join(current))
            current = [piece]
            current_len = len(piece)
        else:
            current.append(piece)
            current_len += extra

    if current:
        chunks.append("\n\n".join(current))
    return chunks


def _tokenize_for_retrieval(text: str) -> list[str]:
    return re.findall(r"[a-zA-Zа-яА-Я0-9_]{2,}", text.lower())


def _build_retrieval_query(task: str) -> list[str]:
    keywords = TASK_KEYWORDS.get(task, ())
    terms: list[str] = []
    seen: set[str] = set()
    for keyword in keywords:
        for token in _tokenize_for_retrieval(keyword):
            if token in seen:
                continue
            seen.add(token)
            terms.append(token)
    return terms


def _score_context_block(
    block: str,
    task: str,
    index: int,
    total: int,
    query_terms: list[str],
    document_frequencies: dict[str, int],
    average_block_length: float,
) -> float:
    lowered = block.lower()
    tokens = _tokenize_for_retrieval(block)
    token_count = max(1, len(tokens))
    token_freqs: dict[str, int] = {}
    for token in tokens:
        token_freqs[token] = token_freqs.get(token, 0) + 1

    bm25_score = 0.0
    total_docs = max(total, 1)
    k1 = 1.5
    b = 0.75
    normalization = k1 * (1 - b + b * (token_count / max(average_block_length, 1.0)))
    for term in query_terms:
        freq = token_freqs.get(term, 0)
        if not freq:
            continue
        doc_freq = document_frequencies.get(term, 0)
        idf = math.log(1 + (total_docs - doc_freq + 0.5) / (doc_freq + 0.5))
        bm25_score += idf * ((freq * (k1 + 1)) / (freq + normalization))

    digits = len(re.findall(r"\d", block))
    date_hits = len(re.findall(r"\b\d{1,2}[./-]\d{1,2}[./-]\d{2,4}\b|\b\d{4}-\d{2}-\d{2}\b", block))
    money_hits = len(re.findall(r"(?:\$|€|₽|руб|usd|eur|\b\d+[.,]?\d*\s*%)", lowered))
    heading_bonus = 1.5 if re.search(r"^[A-ZА-Я0-9][^a-zа-я]{0,40}$", block.strip()) else 0.0
    colon_bonus = 1.0 if ":" in block else 0.0
    boundary_bonus = 1.5 if index in {0, 1, max(0, total - 1), max(0, total - 2)} else 0.0
    density_bonus = min(len(block), 900) / 300
    return (
        bm25_score * 3.0
        + min(digits, 20) * 0.15
        + date_hits * 2.0
        + money_hits * 1.2
        + heading_bonus
        + colon_bonus
        + boundary_bonus
        + density_bonus
    )


def _select_ranked_blocks(blocks: list[str], task: str, target_chars: int) -> list[str]:
    if not blocks:
        return []
    if sum(len(block) for block in blocks) <= target_chars:
        return blocks

    total = len(blocks)
    tokenized_blocks = [_tokenize_for_retrieval(block) for block in blocks]
    average_block_length = (
        sum(len(tokens) for tokens in tokenized_blocks) / total if total else 1.0
    )
    query_terms = _build_retrieval_query(task)
    document_frequencies: dict[str, int] = {}
    for tokens in tokenized_blocks:
        for term in set(tokens):
            document_frequencies[term] = document_frequencies.get(term, 0) + 1
    ranked = sorted(
        range(total),
        key=lambda idx: _score_context_block(
            blocks[idx],
            task,
            idx,
            total,
            query_terms,
            document_frequencies,
            average_block_length,
        ),
        reverse=True,
    )

    selected: set[int] = set()
    budget = 0
    for idx in ranked:
        size = len(blocks[idx])
        if budget >= target_chars and selected:
            break
        selected.add(idx)
        budget += size

    ordered = [blocks[idx] for idx in sorted(selected)]
    return ordered


def _build_compressed_context(text: str, task: str, level: str, include_verbatim: bool) -> str:
    source = text.strip()[:MAX_SOURCE_CONTEXT_CHARS]
    if not source:
        return source
    if level == "off":
        return source

    blocks = _split_context_blocks(source)
    if not blocks:
        return source

    digest_budget = 18000 if level == "safe" else 10000
    evidence_budget = 14000 if level == "safe" else 7000
    digest_blocks = _select_ranked_blocks(blocks, task, digest_budget)

    if not digest_blocks:
        return source

    if not include_verbatim:
        return "\n\n".join(digest_blocks)

    evidence_blocks = _select_ranked_blocks(blocks, task, evidence_budget)
    digest_section = "\n\n".join(
        f"[{idx}] {block}" for idx, block in enumerate(digest_blocks, start=1)
    )
    evidence_section = "\n\n".join(
        f"[{idx}] {block}" for idx, block in enumerate(evidence_blocks, start=1)
    )
    return (
        "COMPRESSED CONTEXT\n"
        "Use this section for global reasoning and prioritization.\n"
        f"{digest_section}\n\n"
        "VERBATIM EVIDENCE\n"
        "Use exact quotes only from this section.\n"
        f"{evidence_section}"
    )


def _prepare_context_bundle(text: str, task: str, level: str, include_verbatim: bool) -> dict[str, Any]:
    source = text.strip()[:MAX_SOURCE_CONTEXT_CHARS]
    blocks = _split_context_blocks(source) if source else []
    if not source:
        return {
            "source": "",
            "context": "",
            "level": level,
            "task": task,
            "block_count": 0,
            "digest_blocks": [],
            "evidence_blocks": [],
            "selected_previews": [],
        }
    if level == "off" or not blocks:
        previews = [source[:280]] if source else []
        return {
            "source": source,
            "context": source,
            "level": level,
            "task": task,
            "block_count": len(blocks),
            "digest_blocks": blocks,
            "evidence_blocks": blocks if include_verbatim else [],
            "selected_previews": previews,
        }

    digest_budget = 18000 if level == "safe" else 10000
    evidence_budget = 14000 if level == "safe" else 7000
    digest_blocks = _select_ranked_blocks(blocks, task, digest_budget)
    evidence_blocks = _select_ranked_blocks(blocks, task, evidence_budget) if include_verbatim else []
    context = _build_compressed_context(source, task, level, include_verbatim)
    selected_previews = [(block[:280] + ("..." if len(block) > 280 else "")) for block in digest_blocks[:5]]
    return {
        "source": source,
        "context": context,
        "level": level,
        "task": task,
        "block_count": len(blocks),
        "digest_blocks": digest_blocks,
        "evidence_blocks": evidence_blocks,
        "selected_previews": selected_previews,
    }


def _detect_document_language(text: str) -> str:
    sample = text[:4000]
    if not sample.strip():
        return "unknown"
    cyrillic = len(re.findall(r"[А-Яа-яЁё]", sample))
    latin = len(re.findall(r"[A-Za-z]", sample))
    if cyrillic > latin * 1.5:
        return "ru"
    if latin > cyrillic * 1.5:
        return "en"
    return "mixed"


def _language_requirement(text: str) -> str:
    language = _detect_document_language(text)
    if language == "ru":
        return (
            "DOCUMENT LANGUAGE: Russian.\n"
            "LANGUAGE REQUIREMENT: Every string value in the JSON response must be in Russian.\n"
            "LANGUAGE REQUIREMENT: English output is invalid unless it is part of an exact verbatim quote copied from the document."
        )
    if language == "en":
        return (
            "DOCUMENT LANGUAGE: English.\n"
            "LANGUAGE REQUIREMENT: Every string value in the JSON response must be in English."
        )
    return (
        "DOCUMENT LANGUAGE: Mixed or unclear.\n"
        "LANGUAGE REQUIREMENT: Use the dominant language of the document for all generated string values."
    )


def _normalize_legal_fields(data: dict[str, Any]) -> None:
    """Normalize optional legal fields returned by the LLM for contract/legal documents."""
    risky = data.get("risky_clauses")
    if not isinstance(risky, list):
        data["risky_clauses"] = []
    else:
        out = []
        for item in risky[:30]:
            if isinstance(item, dict) and "title" in item and "reason" in item:
                sev = (item.get("severity") or "medium").lower()
                if sev not in ("low", "medium", "high"):
                    sev = "medium"
                source_st = (item.get("source_status") or "unconfirmed").lower()
                if source_st not in ("confirmed", "partial", "unconfirmed"):
                    source_st = "unconfirmed"
                out.append({
                    "title": str(item["title"]),
                    "reason": str(item["reason"]),
                    "severity": sev,
                    "legal_basis": str(item.get("legal_basis") or ""),
                    "evidence_quote": str(item.get("evidence_quote") or "")[:200],
                    "source_status": source_st,
                })
        data["risky_clauses"] = out

    penalties = data.get("penalties")
    if not isinstance(penalties, list):
        data["penalties"] = []
    else:
        data["penalties"] = [
            {"trigger": str(p.get("trigger", "")), "amount_or_formula": str(p.get("amount_or_formula", ""))}
            for p in penalties[:30]
            if isinstance(p, dict)
        ]

    obligations = data.get("obligations")
    if not isinstance(obligations, list):
        data["obligations"] = []
    else:
        parties = ("buyer", "seller", "client", "contractor", "other")
        out_obl = []
        for item in obligations[:30]:
            if isinstance(item, dict) and "text" in item:
                party = (item.get("party") or "other").lower()
                if party not in parties:
                    party = "other"
                out_obl.append({"party": party, "text": str(item["text"])})
        data["obligations"] = out_obl

    checklist = data.get("checklist")
    if not isinstance(checklist, list):
        data["checklist"] = []
    else:
        statuses = ("ok", "warn", "missing")
        out_check = []
        for item in checklist[:12]:
            if isinstance(item, dict) and "item" in item:
                st = (item.get("status") or "missing").lower()
                if st not in statuses:
                    st = "missing"
                out_check.append({"item": str(item["item"]), "status": st, "note": str(item.get("note") or "")})
        data["checklist"] = out_check

    legal_basis = data.get("legal_basis")
    if not isinstance(legal_basis, list):
        data["legal_basis"] = []
    else:
        data["legal_basis"] = [str(item) for item in legal_basis[:20] if isinstance(item, str)]

    risk_score = data.get("overall_risk_score")
    if isinstance(risk_score, (int, float)):
        data["overall_risk_score"] = max(0, min(100, int(risk_score)))
    else:
        data["overall_risk_score"] = 0


def analyze_document_fast(
    text: str,
    overrides: dict[str, Any] | None = None,
    cancelled: "threading.Event | None" = None,
) -> dict[str, Any]:
    import threading

    opts = overrides or {}
    client, model = _build_openai_client(opts)
    raw_text = text[:MAX_SOURCE_CONTEXT_CHARS]
    compression_level = _normalize_compression_level(opts)
    if len(raw_text) <= 6000 and compression_level == "off":
        analysis_context = raw_text
    else:
        bundle = _prepare_context_bundle(raw_text, "analysis", compression_level, include_verbatim=True)
        analysis_context = bundle["context"]
    language_rule = _language_requirement(raw_text)
    prompt = f"""Analyze the document. Return JSON only, no markdown.
{language_rule}

ALWAYS return these keys:
- "summary" (2-4 sentences)
- "key_points" (3-8 strings)
- "risks" (5-12 strings, brief risk descriptions)
- "important_dates" (0-8 objects with "date" YYYY-MM-DD and "description")
- "advanced_editor": {{"annotations": [4-12 objects with "type" ("risk"|"improvement"), "severity" ("low"|"medium"|"high"), "title", "reason", "suggested_rewrite", "exact_quote"]}}

"exact_quote" must be copied verbatim from the document.

If the document is a contract, agreement, or legal document, ALSO return these keys (otherwise omit them or return empty arrays):
- "risky_clauses": array of objects with "title", "reason", "severity" (low|medium|high), "legal_basis" (specific law article, e.g. "ст. 450.1 ГК РФ" — use "" if unknown), "evidence_quote" (verbatim quote, max 150 chars), "source_status" ("confirmed"|"partial"|"unconfirmed")
- "penalties": array of objects with "trigger", "amount_or_formula"
- "obligations": array of objects with "party" (buyer|seller|client|contractor|other), "text"
- "checklist": 5-12 objects with "item", "status" (ok|warn|missing), "note". Typical checks: signatures, dates, parties, liability limits, termination, governing law, etc.
- "legal_basis": array of strings listing applicable laws and regulations (e.g. ["ст. 309 ГК РФ — надлежащее исполнение обязательств"])
- "overall_risk_score": integer 0-100

CRITICAL: For risky_clauses, every clause MUST include a legal_basis reference to a specific law article when possible. If you cannot cite a specific article, set source_status to "unconfirmed".

Document:
---
{analysis_context}
---"""
    content = _create_completion(client, model, prompt, opts, "fast analysis", cancelled=cancelled)
    try:
        data = json.loads(_coerce_json_payload(content))
    except json.JSONDecodeError as e:
        raise_error(500, "LLM_ERROR", "Invalid JSON from analysis service.", {"detail": str(e)})
    if not isinstance(data, dict):
        raise_error(500, "LLM_ERROR", "Analysis result must be an object.", {})

    data["summary"] = str(data.get("summary") or "").strip()
    key_points = data.get("key_points")
    data["key_points"] = [str(x) for x in key_points[:12]] if isinstance(key_points, list) else []
    risks = data.get("risks")
    data["risks"] = [str(x) for x in risks[:12]] if isinstance(risks, list) else []
    important_dates = data.get("important_dates")
    if not isinstance(important_dates, list):
        data["important_dates"] = []
    else:
        data["important_dates"] = [
            {"date": str(item.get("date", ""))[:10], "description": str(item.get("description", ""))}
            for item in important_dates[:8]
            if isinstance(item, dict)
        ]
    data["advanced_editor"] = _normalize_advanced_editor(data.get("advanced_editor"), raw_text)
    _normalize_legal_fields(data)
    return data


def _create_completion(
    client: Any,
    model: str,
    prompt: str,
    opts: dict[str, Any],
    operation: str,
    cancelled: "threading.Event | None" = None,
) -> str:
    import threading

    from app.plugins.base import CancelledException

    attempts = max(1, int(opts.get("max_retries") or app_settings.llm_max_retries))
    timeout = max(1, int(opts.get("timeout") or app_settings.llm_timeout_seconds))
    last_error: Exception | None = None
    if client is None or not model:
        client, model = _build_openai_client(opts)

    for attempt in range(1, attempts + 1):
        if cancelled is not None and cancelled.is_set():
            raise CancelledException("LLM request cancelled by client")
        try:
            request_kwargs: dict[str, Any] = {
                "model": model,
                "messages": [{"role": "user", "content": prompt}],
                "temperature": 0,
                "timeout": timeout,
            }
            max_tokens = opts.get("max_tokens")
            if isinstance(max_tokens, int) and max_tokens > 0:
                request_kwargs["max_tokens"] = max_tokens
            response = client.chat.completions.create(**request_kwargs)
            token_counter.capture_from_response(response)
            if cancelled is not None and cancelled.is_set():
                raise CancelledException("LLM request cancelled by client")
            content = _extract_message_content(response)
            if not content:
                raise_error(500, "LLM_ERROR", "Empty response from analysis service.", {})
            return content
        except CancelledException:
            raise
        except Exception as e:
            last_error = e
            retryable = _is_llm_unavailable_error(e)
            logger.warning(
                "LLM %s attempt %s/%s failed: %s",
                operation,
                attempt,
                attempts,
                str(e),
            )
            if not retryable or attempt >= attempts:
                break
            time.sleep(min(attempt, 2))

    assert last_error is not None
    error_code, hint = _summarize_llm_error(last_error, opts)
    status_code = 503 if error_code == "LLM_UNAVAILABLE" else 500
    raise_error(status_code, error_code, hint, {"detail": str(last_error), "operation": operation})


def stream_document_analysis_events(text: str, overrides: dict[str, Any] | None = None):
    opts = overrides or {}
    client, model = _build_openai_client(opts)
    raw_text = text[:MAX_SOURCE_CONTEXT_CHARS]
    compression_level = _normalize_compression_level(opts)
    if len(raw_text) <= 6000 and compression_level == "off":
        analysis_context = raw_text
    else:
        bundle = _prepare_context_bundle(raw_text, "analysis", compression_level, include_verbatim=True)
        analysis_context = bundle["context"]

    language_rule = _language_requirement(raw_text)
    prompt = f"""Analyze the document. Return JSON only, no markdown.
{language_rule}

ALWAYS return these keys:
- "summary" (2-4 sentences)
- "key_points" (3-8 strings)
- "risks" (5-12 strings, brief risk descriptions)
- "important_dates" (0-8 objects with "date" YYYY-MM-DD and "description")
- "advanced_editor": {{"annotations": [4-12 objects with "type" ("risk"|"improvement"), "severity" ("low"|"medium"|"high"), "title", "reason", "suggested_rewrite", "exact_quote"]}}

"exact_quote" must be copied verbatim from the document.

If the document is a contract, agreement, or legal document, ALSO return these keys (otherwise omit them or return empty arrays):
- "risky_clauses": array of objects with "title", "reason", "severity" (low|medium|high), "legal_basis" (specific law article, e.g. "ст. 450.1 ГК РФ" — use "" if unknown), "evidence_quote" (verbatim quote, max 150 chars), "source_status" ("confirmed"|"partial"|"unconfirmed")
- "penalties": array of objects with "trigger", "amount_or_formula"
- "obligations": array of objects with "party" (buyer|seller|client|contractor|other), "text"
- "checklist": 5-12 objects with "item", "status" (ok|warn|missing), "note". Typical checks: signatures, dates, parties, liability limits, termination, governing law, etc.
- "legal_basis": array of strings listing applicable laws and regulations (e.g. ["ст. 309 ГК РФ — надлежащее исполнение обязательств"])
- "overall_risk_score": integer 0-100

CRITICAL: For risky_clauses, every clause MUST include a legal_basis reference to a specific law article when possible. If you cannot cite a specific article, set source_status to "unconfirmed".

Document:
---
{analysis_context}
---"""

    yield {
        "type": "progress",
        "stage": "analyze",
        "message": "Анализируем документ.",
        "current": 1,
        "total": 1,
    }

    timeout = max(1, int(opts.get("timeout") or app_settings.llm_timeout_seconds))
    collected = []
    try:
        stream = client.chat.completions.create(
            model=model,
            messages=[{"role": "user", "content": prompt}],
            temperature=0,
            timeout=timeout,
            stream=True,
            stream_options={"include_usage": True},
        )
        for chunk in stream:
            if getattr(chunk, "usage", None):
                token_counter.capture_from_response(chunk)
            if chunk.choices:
                delta = chunk.choices[0].delta
                if delta and delta.content:
                    collected.append(delta.content)
    except Exception as e:
        error_code, hint = _summarize_llm_error(e, opts)
        status_code = 503 if error_code == "LLM_UNAVAILABLE" else 500
        raise_error(status_code, error_code, hint, {"detail": str(e), "operation": "fast analysis"})

    content = "".join(collected)
    if not content:
        raise_error(500, "LLM_ERROR", "Empty response from analysis service.", {})

    try:
        data = json.loads(_coerce_json_payload(content))
    except json.JSONDecodeError as e:
        raise_error(500, "LLM_ERROR", "Invalid JSON from analysis service.", {"detail": str(e)})
    if not isinstance(data, dict):
        raise_error(500, "LLM_ERROR", "Analysis result must be an object.", {})

    data["summary"] = str(data.get("summary") or "").strip()
    key_points = data.get("key_points")
    data["key_points"] = [str(x) for x in key_points[:12]] if isinstance(key_points, list) else []
    risks = data.get("risks")
    data["risks"] = [str(x) for x in risks[:12]] if isinstance(risks, list) else []
    important_dates = data.get("important_dates")
    if not isinstance(important_dates, list):
        data["important_dates"] = []
    else:
        data["important_dates"] = [
            {"date": str(item.get("date", ""))[:10], "description": str(item.get("description", ""))}
            for item in important_dates[:8]
            if isinstance(item, dict) and ("date" in item or "description" in item)
        ]
    data["advanced_editor"] = _normalize_advanced_editor(data.get("advanced_editor"), raw_text)
    _normalize_legal_fields(data)

    yield {"type": "final", "result": data}


def _normalize_advanced_editor(raw: Any, full_text: str) -> dict[str, Any]:
    if not isinstance(full_text, str):
        full_text = str(full_text or "")

    annotations_raw = raw.get("annotations") if isinstance(raw, dict) else []
    if not isinstance(annotations_raw, list):
        annotations_raw = []

    annotations: list[dict[str, Any]] = []
    used_ranges: list[tuple[int, int]] = []

    logger.info("[advanced_editor] raw annotations count: %d, full_text length: %d", len(annotations_raw), len(full_text))

    for idx, item in enumerate(annotations_raw[:20], start=1):
        normalized = _normalize_document_annotation(item, full_text, idx, used_ranges)
        if normalized is not None:
            annotations.append(normalized)
            used_ranges.append((normalized["start_offset"], normalized["end_offset"]))

    logger.info("[advanced_editor] normalized annotations count: %d (from %d raw)", len(annotations), len(annotations_raw))
    return {"full_text": full_text, "annotations": annotations}


def _normalize_document_annotation(
    item: Any,
    full_text: str,
    idx: int,
    used_ranges: list[tuple[int, int]],
) -> dict[str, Any] | None:
    if not isinstance(item, dict):
        logger.warning("[annotation %s] skipped: not a dict", idx)
        return None

    quote = str(item.get("exact_quote") or "").strip()
    start = item.get("start_offset")
    end = item.get("end_offset")

    start_offset: int | None = None
    end_offset: int | None = None

    if isinstance(start, int) and isinstance(end, int):
        if 0 <= start < end <= len(full_text):
            start_offset = start
            end_offset = end
            if quote and full_text[start_offset:end_offset] != quote:
                start_offset = None
                end_offset = None

    if start_offset is None or end_offset is None:
        anchored = _find_annotation_range(full_text, quote, used_ranges, preferred_start=start)
        if anchored is None:
            logger.warning("[annotation %s] skipped: quote not found in text. quote=%r (len=%d), full_text_len=%d", idx, quote[:80], len(quote), len(full_text))
            return None
        start_offset, end_offset = anchored

    start_offset, end_offset = _expand_range_to_word_boundaries(full_text, start_offset, end_offset)

    annotation_type = str(item.get("type") or "improvement").lower()
    if annotation_type not in ("risk", "improvement"):
        annotation_type = "improvement"

    severity = str(item.get("severity") or "medium").lower()
    if severity not in ("low", "medium", "high"):
        severity = "medium"

    title = str(item.get("title") or "").strip()
    reason = str(item.get("reason") or "").strip()
    suggested_rewrite = str(item.get("suggested_rewrite") or "").strip()
    if not title or not reason or not suggested_rewrite:
        logger.warning("[annotation %s] skipped: missing fields. title=%r, reason=%r, suggested_rewrite=%r", idx, bool(title), bool(reason), bool(suggested_rewrite))
        return None

    return {
        "id": f"ann-{idx}",
        "type": annotation_type,
        "severity": severity,
        "start_offset": start_offset,
        "end_offset": end_offset,
        "exact_quote": full_text[start_offset:end_offset],
        "title": title,
        "reason": reason,
        "suggested_rewrite": suggested_rewrite,
    }


def _find_annotation_range(
    full_text: str,
    quote: str,
    used_ranges: list[tuple[int, int]],
    preferred_start: int | None = None,
) -> tuple[int, int] | None:
    quote = quote.strip()
    if not quote:
        return None

    def collect_matches(haystack: str, needle: str) -> list[tuple[int, int]]:
        matches: list[tuple[int, int]] = []
        cursor = 0
        while True:
            found = haystack.find(needle, cursor)
            if found == -1:
                break
            candidate = (found, found + len(quote))
            if candidate[0] < candidate[1] and not _ranges_overlap(candidate, used_ranges):
                matches.append(candidate)
            cursor = found + 1
        return matches

    matches = collect_matches(full_text, quote)
    if not matches:
        matches = collect_matches(full_text.lower(), quote.lower())

    if not matches:
        # Fuzzy fallback: normalize whitespace and try again
        normalized_text = re.sub(r"\s+", " ", full_text)
        normalized_quote = re.sub(r"\s+", " ", quote)
        if normalized_quote:
            # Build a mapping from normalized positions back to original positions
            orig_positions: list[int] = []
            ni = 0
            for oi, ch in enumerate(full_text):
                if ni < len(normalized_text) and normalized_text[ni] == ch:
                    orig_positions.append(oi)
                    ni += 1
                elif ch in (" ", "\t", "\n", "\r", "\xa0"):
                    continue
                else:
                    orig_positions.append(oi)
                    ni += 1

            norm_matches = collect_matches(normalized_text.lower(), normalized_quote.lower())
            for ns, ne in norm_matches:
                os_ = orig_positions[ns] if ns < len(orig_positions) else 0
                oe = (orig_positions[min(ne, len(orig_positions) - 1)] + 1) if ne > 0 and orig_positions else len(full_text)
                candidate = (os_, oe)
                if candidate[0] < candidate[1] and not _ranges_overlap(candidate, used_ranges):
                    matches.append(candidate)
                    break

    if not matches:
        # Last resort: try matching by first 60 chars of the quote
        short = re.sub(r"\s+", " ", quote[:60]).strip().lower()
        if len(short) >= 20:
            pos = re.sub(r"\s+", " ", full_text).lower().find(short)
            if pos != -1:
                # Approximate: use the position in original text
                approx_start = full_text.lower().find(short[:30])
                if approx_start == -1:
                    approx_start = max(0, pos)
                approx_end = min(len(full_text), approx_start + len(quote))
                candidate = (approx_start, approx_end)
                if not _ranges_overlap(candidate, used_ranges):
                    matches.append(candidate)

    if not matches:
        return None

    if isinstance(preferred_start, int):
        matches.sort(key=lambda candidate: abs(candidate[0] - preferred_start))
    return matches[0]


_INVISIBLE_CHARS = frozenset(
    "\u00ad\u200b\u200c\u200d\u200e\u200f\u2060\u2061\u2062\u2063\u2064\ufeff"
)


def _is_word_char(char: str) -> bool:
    return char.isalnum() or char == "_"


def _is_word_or_invisible(char: str) -> bool:
    return char.isalnum() or char == "_" or char in _INVISIBLE_CHARS


def _expand_range_to_word_boundaries(
    full_text: str,
    start_offset: int,
    end_offset: int,
) -> tuple[int, int]:
    start = max(0, start_offset)
    end = min(len(full_text), end_offset)
    if start >= end:
        return start_offset, end_offset

    while start > 0 and _is_word_or_invisible(full_text[start]) and _is_word_or_invisible(full_text[start - 1]):
        start -= 1

    while end < len(full_text) and _is_word_or_invisible(full_text[end - 1]) and _is_word_or_invisible(full_text[end]):
        end += 1

    return start, end


def _ranges_overlap(candidate: tuple[int, int], existing: list[tuple[int, int]]) -> bool:
    for start, end in existing:
        if candidate[0] < end and candidate[1] > start:
            return True
    return False


def simplify_legal_text(text: str, overrides: dict[str, Any] | None = None) -> dict[str, Any]:
    opts = overrides or {}
    client, model = _build_openai_client(opts)
    source_text = text[:MAX_SOURCE_CONTEXT_CHARS]
    context_bundle = _prepare_context_bundle(
        source_text,
        "analysis",
        _normalize_compression_level(opts),
        include_verbatim=False,
    )
    simplification_context = context_bundle["context"]
    language_rule = _language_requirement(source_text)
    prompt = f"""Simplify the legal document for a non-lawyer reader and return a JSON object with exactly these keys:
- "summary": string, a short plain-language summary in 2-4 sentences
- "plain_language_text": string, a readable retelling of the document in simple language without legal jargon where possible
- "key_points": array of 3 to 8 short strings with the main ideas, obligations, risks, deadlines, or consequences

{language_rule}
IMPORTANT: Keep the meaning of the source text. Do not invent facts that are missing from the document.
IMPORTANT: Explain legal terms in simpler words instead of copying complex wording when possible.
IMPORTANT: Return only valid JSON, no markdown or explanation.

Document:
---
{simplification_context}
---"""

    content = _create_completion(client, model, prompt, opts, "legal text simplification")

    try:
        data = json.loads(_coerce_json_payload(content))
    except json.JSONDecodeError as e:
        raise_error(500, "LLM_ERROR", "Invalid JSON from analysis service.", {"detail": str(e)})

    if not isinstance(data, dict):
        raise_error(500, "LLM_ERROR", "Analysis result must be an object.", {})

    data["summary"] = str(data.get("summary") or "").strip()
    data["plain_language_text"] = str(data.get("plain_language_text") or "").strip()
    key_points = data.get("key_points")
    data["key_points"] = [str(x).strip() for x in key_points[:8] if str(x).strip()] if isinstance(key_points, list) else []
    return data


def check_spelling(text: str, overrides: dict[str, Any] | None = None) -> dict[str, Any]:
    opts = overrides or {}
    source_text = text[:MAX_SOURCE_CONTEXT_CHARS]
    language = _detect_document_language(source_text)
    language_rule = _language_requirement(source_text)
    chunks = _split_text_for_copyedit(source_text, max_chars=3200)
    if not chunks:
        return {
            "summary": "Текст пустой или не содержит читаемых фрагментов." if language == "ru" else "The text is empty or has no readable content.",
            "original_text": source_text.strip(),
            "corrected_text": "",
            "corrections": [],
        }

    corrected_chunks: list[str] = []
    all_corrections: list[dict[str, str]] = []

    for index, chunk in enumerate(chunks, start=1):
        chunk_opts = dict(opts)
        chunk_opts["compression_level"] = "off"
        chunk_opts["max_tokens"] = max(700, min(2200, len(chunk) // 2 + 280))
        prompt = f"""Proofread this text fragment and return a JSON object with exactly these keys:
- "corrected_text": string, the corrected version of the fragment
- "corrections": array of 0 to 3 objects, each with:
  - "original": string
  - "corrected": string
  - "reason": string

{language_rule}
IMPORTANT: Preserve wording and structure where possible.
IMPORTANT: Fix spelling, punctuation, obvious grammar and typography mistakes only.
IMPORTANT: Do not rewrite the style aggressively.
IMPORTANT: Return only valid JSON, no markdown or explanation.
IMPORTANT: This is fragment {index} of {len(chunks)}.

Fragment:
---
{chunk}
---"""

        content = _create_completion(None, "", prompt, chunk_opts, f"spelling check chunk {index}")

        try:
            data = json.loads(_coerce_json_payload(content))
        except json.JSONDecodeError as e:
            raise_error(500, "LLM_ERROR", "Invalid JSON from analysis service.", {"detail": str(e)})

        if not isinstance(data, dict):
            raise_error(500, "LLM_ERROR", "Analysis result must be an object.", {})

        corrected_text = str(data.get("corrected_text") or "").strip()
        corrected_chunks.append(corrected_text or chunk)

        corrections = data.get("corrections")
        if isinstance(corrections, list):
            for item in corrections:
                if not isinstance(item, dict):
                    continue
                corrected = str(item.get("corrected") or "").strip()
                original = str(item.get("original") or "").strip()
                reason = str(item.get("reason") or "").strip()
                if corrected and len(all_corrections) < 12:
                    all_corrections.append(
                        {
                            "original": original,
                            "corrected": corrected,
                            "reason": reason,
                        }
                    )

    changed_count = len(all_corrections)
    if language == "en":
        summary = (
            "The text was proofread. No significant spelling or punctuation issues were found."
            if changed_count == 0
            else f"The text was proofread and cleaned up. {changed_count} key spelling or punctuation fixes were highlighted."
        )
    else:
        summary = (
            "Текст проверен. Существенных орфографических и пунктуационных ошибок не найдено."
            if changed_count == 0
            else f"Текст проверен и очищен. Выделено {changed_count} ключевых орфографических или пунктуационных исправлений."
        )

    return {
        "summary": summary,
        "original_text": source_text.strip(),
        "corrected_text": "\n\n".join(corrected_chunks).strip(),
        "corrections": all_corrections,
    }


def extract_structured_data(text: str, overrides: dict[str, Any] | None = None) -> dict[str, Any]:
    opts = overrides or {}
    client, model = _build_openai_client(opts)
    extraction_bundle = _prepare_context_bundle(
        text[:MAX_SOURCE_CONTEXT_CHARS],
        "extraction",
        _normalize_compression_level(opts),
        include_verbatim=True,
    )
    extraction_context = extraction_bundle["context"]
    language_rule = _language_requirement(text)
    prompt = f"""Extract structured data from the document. Return a JSON object with exactly these keys:
- "fields": array of 5 to 30 objects, each with "key" (string) and "value" (string). Extract key-value pairs (names, dates, amounts, identifiers, etc.).
- "tables": array of 0 to 3 objects, each with "name" (string) and "rows" (array of arrays of strings). Each table at most 20 rows. Represent tabular blocks as rows of cell values.
- "confidence": number between 0.3 and 0.9 indicating your confidence in the extraction.

{language_rule}
IMPORTANT: Follow the language requirement strictly for field names, field values, table names and textual cells whenever they are generated by the model.
Return only valid JSON, no markdown or explanation.

Document text:
---
{extraction_context}
---"""

    content = _create_completion(client, model, prompt, opts, "data extraction")

    try:
        data = json.loads(_coerce_json_payload(content))
    except json.JSONDecodeError as e:
        raise_error(500, "LLM_ERROR", "Invalid JSON from extraction service.", {"detail": str(e)})

    if not isinstance(data, dict):
        raise_error(500, "LLM_ERROR", "Extraction result must be an object.", {})

    fields = data.get("fields")
    if not isinstance(fields, list):
        data["fields"] = []
    else:
        out_fields = []
        for item in fields[:30]:
            if isinstance(item, dict) and "key" in item and "value" in item:
                out_fields.append({"key": str(item["key"]), "value": str(item["value"])})
        data["fields"] = out_fields

    tables = data.get("tables")
    if not isinstance(tables, list):
        data["tables"] = []
    else:
        out_tables = []
        for t in tables[:3]:
            if isinstance(t, dict) and "name" in t and "rows" in t:
                rows = t["rows"]
                if not isinstance(rows, list):
                    rows = []
                out_rows = []
                for row in rows[:20]:
                    if isinstance(row, list):
                        out_rows.append([str(c) for c in row])
                out_tables.append({"name": str(t["name"]), "rows": out_rows})
        data["tables"] = out_tables

    conf = data.get("confidence")
    if isinstance(conf, (int, float)):
        data["confidence"] = max(0.0, min(1.0, float(conf)))
    else:
        data["confidence"] = 0.5

    return data


def compare_documents_detailed(
    left_text: str,
    right_text: str,
    overrides: dict[str, Any] | None = None,
) -> dict[str, Any]:
    opts = overrides or {}
    client, model = _build_openai_client(opts)
    compression_level = _normalize_compression_level(opts)
    left_source = left_text[:MAX_SOURCE_CONTEXT_CHARS]
    right_source = right_text[:MAX_SOURCE_CONTEXT_CHARS]
    left_bundle = _prepare_context_bundle(left_source, "contract", compression_level, include_verbatim=False)
    right_bundle = _prepare_context_bundle(right_source, "contract", compression_level, include_verbatim=False)
    language_rule = _language_requirement(f"{left_source}\n\n{right_source}")
    prompt = f"""Compare two documents. Return JSON only, no markdown.
{language_rule}

Return a JSON object with exactly these keys:
- "summary": 1-2 detailed paragraphs about what both documents are about and the overall comparison outcome.
- "left_document_summary": 1 detailed paragraph about document A.
- "right_document_summary": 1 detailed paragraph about document B.
- "common_points": array of 0 to 8 strings describing major overlaps in subject, structure, obligations, terms or process.
- "differences": array of 4 to 12 strings describing the most important differences in meaning, scope, dates, obligations, risks, parties or commercial terms.
- "relation_assessment": 1 detailed paragraph stating whether these documents are versions of the same matter, adjacent documents in one process, or completely unrelated. If they are about different matters, say this directly.
- "are_documents_related": boolean.

Be concrete. Do not invent overlap if there is none.

Document A:
---
{left_bundle["context"]}
---

Document B:
---
{right_bundle["context"]}
---"""

    content = _create_completion(client, model, prompt, opts, "document comparison")

    try:
        data = json.loads(_coerce_json_payload(content))
    except json.JSONDecodeError as e:
        raise_error(500, "LLM_ERROR", "Invalid JSON from comparison service.", {"detail": str(e)})

    if not isinstance(data, dict):
        raise_error(500, "LLM_ERROR", "Comparison result must be an object.", {})

    data["summary"] = str(data.get("summary") or "").strip()
    data["left_document_summary"] = str(data.get("left_document_summary") or "").strip()
    data["right_document_summary"] = str(data.get("right_document_summary") or "").strip()
    common_points = data.get("common_points")
    data["common_points"] = [str(x).strip() for x in common_points[:8]] if isinstance(common_points, list) else []
    differences = data.get("differences")
    data["differences"] = [str(x).strip() for x in differences[:12]] if isinstance(differences, list) else []
    data["relation_assessment"] = str(data.get("relation_assessment") or "").strip()
    data["are_documents_related"] = bool(data.get("are_documents_related"))
    return data
