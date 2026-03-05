import json
import os
from typing import Any

from app.utils.errors import raise_error


def analyze_document(text: str, overrides: dict[str, Any] | None = None) -> dict[str, Any]:
    opts = overrides or {}
    api_key = opts.get("api_key") or os.environ.get("OPENAI_API_KEY")
    if not api_key or not str(api_key).strip():
        raise_error(
            500,
            "CONFIG_ERROR",
            "API key is not set. Set OPENAI_API_KEY in env or in LLM settings.",
            {},
        )
    try:
        from openai import OpenAI
    except ImportError:
        raise_error(500, "INTERNAL_ERROR", "OpenAI client not available", {})

    client_kwargs: dict[str, Any] = {"api_key": api_key}
    if opts.get("base_url"):
        client_kwargs["base_url"] = opts["base_url"].rstrip("/")
    client = OpenAI(**client_kwargs)
    model = opts.get("model") or os.environ.get("OPENAI_MODEL", "gpt-4o-mini")
    prompt = f"""Analyze the following document and return a JSON object with exactly these keys (no other keys):
- "summary": string, brief summary of the document (2-5 sentences)
- "key_points": array of 3 to 10 strings, main points
- "risks": array of 0 to 10 strings, identified risks
- "important_dates": array of 0 to 10 objects, each with "date" (YYYY-MM-DD) and "description" (string). If no dates found, use []

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
