from __future__ import annotations

from app.schemas.tools import DocumentAnalyzerResult
from app.services.llm_client import analyze_document, analyze_document_fast
from app.services.text_extraction import extract_advanced_editor_payload
from app.utils.errors import raise_error
from pydantic import ValidationError


def build_document_bundle(
    storage_path: str,
    mime_type: str,
    overrides: dict | None = None,
    edited_document: dict | None = None,
) -> tuple[DocumentAnalyzerResult, dict]:
    if edited_document and str(edited_document.get("full_text") or "").strip():
        editor_payload = {
            "full_text": edited_document["full_text"],
            "rich_content": edited_document.get("rich_content"),
            "source_format": edited_document.get("source_format") or "edited_document",
        }
    else:
        editor_payload = extract_advanced_editor_payload(storage_path, mime_type)
    text = editor_payload["full_text"]
    mode = str((overrides or {}).get("analysis_mode") or "fast").lower()
    raw = analyze_document(text, overrides=overrides) if mode == "deep" else analyze_document_fast(text, overrides=overrides)
    raw_advanced = raw.get("advanced_editor") if isinstance(raw, dict) else None
    if isinstance(raw_advanced, dict):
        raw_advanced["rich_content"] = editor_payload.get("rich_content")
        raw_advanced["source_format"] = editor_payload.get("source_format")
    try:
        result = DocumentAnalyzerResult.model_validate(raw)
    except ValidationError:
        raise_error(500, "LLM_ERROR", "Plugin result format invalid. Try again.", {})
    return result, editor_payload
