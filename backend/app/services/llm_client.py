from __future__ import annotations

import json
import time
from typing import Any
from urllib.parse import urlsplit, urlunsplit

from app.core.logging import logger
from app.core.config import settings as app_settings
from app.utils.errors import raise_error


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
    model = (opts.get("model") or app_settings.openai_model).strip() or "gpt-4o-mini"
    base_url = (opts.get("base_url") or app_settings.openai_base_url).strip() or ""

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


def _build_openai_client(opts: dict[str, Any]) -> tuple:
    try:
        from openai import OpenAI
    except ImportError:
        raise_error(500, "INTERNAL_ERROR", "OpenAI client not available", {})

    base_url = (opts.get("base_url") or app_settings.openai_base_url).strip() or None
    api_key = (opts.get("api_key") or app_settings.openai_api_key).strip() or None
    model = (opts.get("model") or app_settings.openai_model).strip() or "gpt-4o-mini"

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

    client_kwargs: dict[str, Any] = {"api_key": api_key}
    if base_url:
        client_kwargs["base_url"] = _normalize_openai_base_url(base_url)

    return OpenAI(**client_kwargs), model


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


def _create_completion(client: Any, model: str, prompt: str, opts: dict[str, Any], operation: str) -> str:
    attempts = max(1, int(opts.get("max_retries") or app_settings.llm_max_retries))
    timeout = max(1, int(opts.get("timeout") or app_settings.llm_timeout_seconds))
    last_error: Exception | None = None

    for attempt in range(1, attempts + 1):
        try:
            request_kwargs: dict[str, Any] = {
                "model": model,
                "messages": [{"role": "user", "content": prompt}],
                "temperature": 0.2,
                "timeout": timeout,
            }
            response = client.chat.completions.create(**request_kwargs)
            content = _extract_message_content(response)
            if not content:
                raise_error(500, "LLM_ERROR", "Empty response from analysis service.", {})
            return content
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


def analyze_document(text: str, overrides: dict[str, Any] | None = None) -> dict[str, Any]:
    opts = overrides or {}
    client, model = _build_openai_client(opts)
    analysis_text = text[:50000]
    prompt = f"""Analyze the following document and return a JSON object with exactly these keys (no other keys):
- "summary": string, brief summary of the document (2-5 sentences)
- "key_points": array of 3 to 10 strings, main points
- "risks": array of 0 to 10 strings, identified risks
- "important_dates": array of 0 to 10 objects, each with "date" (YYYY-MM-DD) and "description" (string). If no dates found, use []
- "advanced_editor": object with:
  - "annotations": array of 0 to 20 objects
  - each annotation object must contain:
    - "type": exactly one of "risk" or "improvement"
    - "severity": exactly one of "low", "medium", "high"
    - "title": short label
    - "reason": short explanation of why this fragment is risky or can be improved
    - "suggested_rewrite": a concise replacement wording in the same language as the document
    - "exact_quote": exact substring copied verbatim from the document text. It must match the document text exactly so the client can anchor the annotation.

IMPORTANT: Always respond in the same language as the document. If the document is in Russian, all text values in JSON must be in Russian.
IMPORTANT: "exact_quote" must be copied character-for-character from the document text. Do not invent quotes and do not include fragments that are not present verbatim.

Return only valid JSON, no markdown or explanation.

Document text:
---
{analysis_text}
---"""

    content = _create_completion(client, model, prompt, opts, "analysis")

    try:
        data = json.loads(content)
    except json.JSONDecodeError as e:
        raise_error(500, "LLM_ERROR", "Invalid JSON from analysis service.", {"detail": str(e)})

    if not isinstance(data, dict):
        raise_error(500, "LLM_ERROR", "Analysis result must be an object.", {})

    summary = data.get("summary")
    if summary is None:
        data["summary"] = ""
    elif not isinstance(summary, str):
        data["summary"] = str(summary)

    key_points = data.get("key_points")
    if not isinstance(key_points, list):
        data["key_points"] = []
    else:
        data["key_points"] = [str(x) for x in key_points[:10]]

    risks = data.get("risks")
    if not isinstance(risks, list):
        data["risks"] = []
    else:
        data["risks"] = [str(x) for x in risks[:10]]

    important_dates = data.get("important_dates")
    if not isinstance(important_dates, list):
        data["important_dates"] = []
    else:
        out_dates = []
        for item in important_dates[:10]:
            if isinstance(item, dict) and "date" in item and "description" in item:
                out_dates.append({"date": str(item["date"])[:10], "description": str(item["description"])})
        data["important_dates"] = out_dates

    data["advanced_editor"] = _normalize_advanced_editor(data.get("advanced_editor"), analysis_text)

    return data


def stream_document_analysis_events(text: str, overrides: dict[str, Any] | None = None):
    opts = overrides or {}
    client, model = _build_openai_client(opts)
    analysis_text = text[:50000]
    chunks = _split_document_for_streaming(analysis_text)
    aggregated_annotations: list[dict[str, Any]] = []
    aggregated_key_points: list[str] = []
    aggregated_risks: list[str] = []
    aggregated_dates: list[dict[str, str]] = []
    used_ranges: list[tuple[int, int]] = []

    yield {
        "type": "progress",
        "stage": "analyze",
        "message": "Запускаем поэтапный AI-анализ документа.",
        "current": 0,
        "total": len(chunks),
    }

    for index, chunk in enumerate(chunks, start=1):
        yield {
            "type": "progress",
            "stage": "analyze",
            "message": f"Анализируем часть {index} из {len(chunks)}.",
            "current": index,
            "total": len(chunks),
        }
        chunk_payload = _analyze_document_chunk(client, model, chunk, opts, index, len(chunks), analysis_text)
        batch_annotations = _normalize_advanced_editor_for_stream(
            chunk_payload.get("annotations"),
            analysis_text,
            len(aggregated_annotations) + 1,
            used_ranges,
        )
        if batch_annotations:
            aggregated_annotations.extend(batch_annotations)
            used_ranges.extend((item["start_offset"], item["end_offset"]) for item in batch_annotations)
            for batch_start in range(0, len(batch_annotations), 2):
                yield {
                    "type": "annotations_batch",
                    "annotations": batch_annotations[batch_start:batch_start + 2],
                    "current": index,
                    "total": len(chunks),
                }

        aggregated_key_points = _merge_unique_strings(
            aggregated_key_points,
            [str(item) for item in chunk_payload.get("key_points", []) if str(item).strip()],
            10,
        )
        aggregated_risks = _merge_unique_strings(
            aggregated_risks,
            [str(item) for item in chunk_payload.get("risks", []) if str(item).strip()],
            10,
        )
        aggregated_dates = _merge_unique_dates(
            aggregated_dates,
            chunk_payload.get("important_dates", []),
            10,
        )

    yield {
        "type": "progress",
        "stage": "review",
        "message": "Делаем финальный полный проход по документу.",
        "current": len(chunks),
        "total": len(chunks),
    }

    final_result = analyze_document(analysis_text, overrides=opts)
    yield {"type": "final", "result": final_result}


def _split_document_for_streaming(text: str, chunk_size: int = 4000, overlap: int = 250) -> list[str]:
    source = text.strip()
    if not source:
        return [""]

    chunks: list[str] = []
    cursor = 0
    text_len = len(source)

    while cursor < text_len:
        target_end = min(text_len, cursor + chunk_size)
        end = target_end
        if end < text_len:
            for separator in ("\n\n", "\n", ". ", "; ", ", "):
                found = source.rfind(separator, cursor + max(1000, chunk_size // 2), target_end)
                if found != -1:
                    end = found + len(separator)
                    break
        if end <= cursor:
            end = min(text_len, cursor + chunk_size)

        chunk = source[cursor:end].strip()
        if chunk:
            chunks.append(chunk)
        if end >= text_len:
            break
        cursor = max(end - overlap, cursor + 1)

    return chunks or [source[:chunk_size]]


def _analyze_document_chunk(
    client: Any,
    model: str,
    chunk_text: str,
    opts: dict[str, Any],
    index: int,
    total: int,
    full_text: str,
) -> dict[str, Any]:
    prompt = f"""Analyze part {index} of {total} of the document and return a JSON object with exactly these keys:
- "key_points": array of 0 to 3 strings
- "risks": array of 0 to 3 strings
- "important_dates": array of 0 to 3 objects, each with "date" (YYYY-MM-DD) and "description" (string)
- "annotations": array of 0 to 3 objects

Each annotation object must contain:
- "type": exactly one of "risk" or "improvement"
- "severity": exactly one of "low", "medium", "high"
- "title": short label
- "reason": short explanation
- "suggested_rewrite": concise replacement wording in the same language as the document
- "exact_quote": exact substring copied verbatim from this chunk

IMPORTANT: Respond in the same language as the document.
IMPORTANT: "exact_quote" must be copied character-for-character from the chunk text.
IMPORTANT: Use only findings that are grounded in the provided chunk text.

Chunk text:
---
{chunk_text}
---"""
    content = _create_completion(client, model, prompt, opts, f"analysis chunk {index}/{total}")
    try:
        data = json.loads(content)
    except json.JSONDecodeError as e:
        raise_error(500, "LLM_ERROR", "Invalid JSON from analysis service.", {"detail": str(e)})
    if not isinstance(data, dict):
        raise_error(500, "LLM_ERROR", "Analysis result must be an object.", {})
    key_points = data.get("key_points")
    risks = data.get("risks")
    dates = data.get("important_dates")
    annotations = data.get("annotations")
    return {
        "key_points": [str(item) for item in key_points[:3]] if isinstance(key_points, list) else [],
        "risks": [str(item) for item in risks[:3]] if isinstance(risks, list) else [],
        "important_dates": [
            {"date": str(item.get("date", ""))[:10], "description": str(item.get("description", ""))}
            for item in dates[:3]
            if isinstance(item, dict)
        ] if isinstance(dates, list) else [],
        "annotations": annotations if isinstance(annotations, list) else [],
    }


def _normalize_advanced_editor_for_stream(
    annotations_raw: Any,
    full_text: str,
    start_idx: int,
    used_ranges: list[tuple[int, int]],
) -> list[dict[str, Any]]:
    if not isinstance(annotations_raw, list):
        return []
    annotations: list[dict[str, Any]] = []
    next_idx = start_idx
    local_used_ranges = list(used_ranges)
    for item in annotations_raw:
        normalized = _normalize_document_annotation(item, full_text, next_idx, local_used_ranges)
        if normalized is None:
            continue
        annotations.append(normalized)
        local_used_ranges.append((normalized["start_offset"], normalized["end_offset"]))
        next_idx += 1
        if len(annotations) >= 3:
            break
    return annotations


def _merge_unique_strings(existing: list[str], incoming: list[str], limit: int) -> list[str]:
    out = list(existing)
    normalized = {item.strip().lower() for item in out if item.strip()}
    for item in incoming:
        key = item.strip().lower()
        if not key or key in normalized:
            continue
        out.append(item)
        normalized.add(key)
        if len(out) >= limit:
            break
    return out[:limit]


def _merge_unique_dates(
    existing: list[dict[str, str]],
    incoming: list[dict[str, str]],
    limit: int,
) -> list[dict[str, str]]:
    out = list(existing)
    seen = {(item.get("date", ""), item.get("description", "").strip().lower()) for item in out}
    for item in incoming:
        if not isinstance(item, dict):
            continue
        date = str(item.get("date") or "")[:10]
        description = str(item.get("description") or "").strip()
        key = (date, description.lower())
        if (not date and not description) or key in seen:
            continue
        out.append({"date": date, "description": description})
        seen.add(key)
        if len(out) >= limit:
            break
    return out[:limit]


def _normalize_advanced_editor(raw: Any, full_text: str) -> dict[str, Any]:
    if not isinstance(full_text, str):
        full_text = str(full_text or "")

    annotations_raw = raw.get("annotations") if isinstance(raw, dict) else []
    if not isinstance(annotations_raw, list):
        annotations_raw = []

    annotations: list[dict[str, Any]] = []
    used_ranges: list[tuple[int, int]] = []

    for idx, item in enumerate(annotations_raw[:20], start=1):
        normalized = _normalize_document_annotation(item, full_text, idx, used_ranges)
        if normalized is not None:
            annotations.append(normalized)
            used_ranges.append((normalized["start_offset"], normalized["end_offset"]))

    return {"full_text": full_text, "annotations": annotations}


def _normalize_document_annotation(
    item: Any,
    full_text: str,
    idx: int,
    used_ranges: list[tuple[int, int]],
) -> dict[str, Any] | None:
    if not isinstance(item, dict):
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
        return None

    return {
        "id": f"ann-{idx}",
        "type": annotation_type,
        "severity": severity,
        "start_offset": start_offset,
        "end_offset": end_offset,
        "exact_quote": quote or full_text[start_offset:end_offset],
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

    matches: list[tuple[int, int]] = []
    cursor = 0
    while True:
        found = full_text.find(quote, cursor)
        if found == -1:
            break
        candidate = (found, found + len(quote))
        if candidate[0] < candidate[1] and not _ranges_overlap(candidate, used_ranges):
            matches.append(candidate)
        cursor = found + 1

    if not matches:
        return None

    if isinstance(preferred_start, int):
        matches.sort(key=lambda candidate: abs(candidate[0] - preferred_start))
    return matches[0]


def _is_word_char(char: str) -> bool:
    return char.isalnum() or char == "_"


def _expand_range_to_word_boundaries(
    full_text: str,
    start_offset: int,
    end_offset: int,
) -> tuple[int, int]:
    start = max(0, start_offset)
    end = min(len(full_text), end_offset)
    if start >= end:
        return start_offset, end_offset

    while start > 0 and _is_word_char(full_text[start]) and _is_word_char(full_text[start - 1]):
        start -= 1

    while end < len(full_text) and _is_word_char(full_text[end - 1]) and _is_word_char(full_text[end]):
        end += 1

    return start, end


def _ranges_overlap(candidate: tuple[int, int], existing: list[tuple[int, int]]) -> bool:
    for start, end in existing:
        if candidate[0] < end and candidate[1] > start:
            return True
    return False


def check_contract(text: str, overrides: dict[str, Any] | None = None) -> dict[str, Any]:
    opts = overrides or {}
    client, model = _build_openai_client(opts)
    prompt = f"""Analyze the following contract text and return a JSON object with exactly these keys (no other keys):
- "summary": string, brief summary of the contract (2-5 sentences)
- "risky_clauses": array of objects, each with "title" (string), "reason" (string), "severity" (exactly one of: low, medium, high). Use low/medium/high only.
- "penalties": array of objects, each with "trigger" (string), "amount_or_formula" (string)
- "obligations": array of objects, each with "party" (exactly one of: buyer, seller, client, contractor, other), "text" (string)
- "deadlines": array of objects, each with "date" (YYYY-MM-DD), "description" (string). If no dates, use []
- "checklist": array of 5 to 12 objects, each with "item" (string), "status" (exactly one of: ok, warn, missing), "note" (string). Checklist items are typical contract checks (signatures, dates, parties, liability limits, termination, etc.)

IMPORTANT: Always respond in the same language as the contract. If the contract is in Russian, all text values in JSON must be in Russian.

Return only valid JSON, no markdown or explanation.

Contract text:
---
{text[:50000]}
---"""

    content = _create_completion(client, model, prompt, opts, "contract analysis")

    try:
        data = json.loads(content)
    except json.JSONDecodeError as e:
        raise_error(500, "LLM_ERROR", "Invalid JSON from analysis service.", {"detail": str(e)})

    if not isinstance(data, dict):
        raise_error(500, "LLM_ERROR", "Analysis result must be an object.", {})

    data["summary"] = str(data.get("summary") or "").strip() or ""

    risky = data.get("risky_clauses")
    if not isinstance(risky, list):
        data["risky_clauses"] = []
    else:
        out_risky = []
        for item in risky[:30]:
            if isinstance(item, dict) and "title" in item and "reason" in item:
                sev = (item.get("severity") or "medium").lower()
                if sev not in ("low", "medium", "high"):
                    sev = "medium"
                out_risky.append({"title": str(item["title"]), "reason": str(item["reason"]), "severity": sev})
        data["risky_clauses"] = out_risky

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

    deadlines = data.get("deadlines")
    if not isinstance(deadlines, list):
        data["deadlines"] = []
    else:
        out_dates = []
        for item in deadlines[:20]:
            if isinstance(item, dict) and "date" in item and "description" in item:
                out_dates.append({"date": str(item["date"])[:10], "description": str(item["description"])})
        data["deadlines"] = out_dates

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

    return data


def extract_structured_data(text: str, overrides: dict[str, Any] | None = None) -> dict[str, Any]:
    opts = overrides or {}
    client, model = _build_openai_client(opts)
    prompt = f"""Extract structured data from the following document. Return a JSON object with exactly these keys (no other keys):
- "fields": array of 5 to 30 objects, each with "key" (string) and "value" (string). Extract key-value pairs (names, dates, amounts, identifiers, etc.).
- "tables": array of 0 to 3 objects, each with "name" (string) and "rows" (array of arrays of strings). Each table at most 20 rows. Represent tabular blocks as rows of cell values.
- "confidence": number between 0.3 and 0.9 indicating your confidence in the extraction.

IMPORTANT: Respond in the same language as the document. Return only valid JSON, no markdown or explanation.

Document text:
---
{text[:50000]}
---"""

    content = _create_completion(client, model, prompt, opts, "data extraction")

    try:
        data = json.loads(content)
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
