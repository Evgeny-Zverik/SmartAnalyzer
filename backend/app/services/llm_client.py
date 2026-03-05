from __future__ import annotations

import json
from typing import Any

from app.core.config import settings as app_settings
from app.utils.errors import raise_error


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
        client_kwargs["base_url"] = base_url.rstrip("/")

    return OpenAI(**client_kwargs), model


def analyze_document(text: str, overrides: dict[str, Any] | None = None) -> dict[str, Any]:
    opts = overrides or {}
    client, model = _build_openai_client(opts)
    prompt = f"""Analyze the following document and return a JSON object with exactly these keys (no other keys):
- "summary": string, brief summary of the document (2-5 sentences)
- "key_points": array of 3 to 10 strings, main points
- "risks": array of 0 to 10 strings, identified risks
- "important_dates": array of 0 to 10 objects, each with "date" (YYYY-MM-DD) and "description" (string). If no dates found, use []

IMPORTANT: Always respond in the same language as the document. If the document is in Russian, all text values in JSON must be in Russian.

Return only valid JSON, no markdown or explanation.

Document text:
---
{text[:50000]}
---"""

    try:
        response = client.chat.completions.create(
            model=model,
            messages=[{"role": "user", "content": prompt}],
            response_format={"type": "json_object"},
            temperature=0.2,
            timeout=60,
        )
    except Exception as e:
        raise_error(500, "LLM_ERROR", "Analysis failed. Try again.", {"detail": str(e)})

    content = response.choices[0].message.content
    if not content:
        raise_error(500, "LLM_ERROR", "Empty response from analysis service.", {})

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

    return data


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

    try:
        response = client.chat.completions.create(
            model=model,
            messages=[{"role": "user", "content": prompt}],
            response_format={"type": "json_object"},
            temperature=0.2,
            timeout=60,
        )
    except Exception as e:
        raise_error(500, "LLM_ERROR", "Contract analysis failed. Try again.", {"detail": str(e)})

    content = response.choices[0].message.content
    if not content:
        raise_error(500, "LLM_ERROR", "Empty response from analysis service.", {})

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
