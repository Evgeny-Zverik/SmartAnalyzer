from __future__ import annotations

from pathlib import Path

from app.models.document import Document
from app.plugins.contracts import InputType


def detect_document_input_type(document: Document) -> InputType:
    mime = (document.mime_type or "").lower()
    suffix = Path(document.filename or "").suffix.lower()
    if "pdf" in mime or suffix == ".pdf":
        return "pdf"
    if "wordprocessingml" in mime or suffix == ".docx":
        return "docx"
    if "spreadsheet" in mime or suffix == ".xlsx":
        return "spreadsheet"
    return "text"


def plan_satisfies(plan: str, required_plan: str) -> bool:
    order = {"free": 0, "pro": 1, "enterprise": 2}
    return order.get(plan, 0) >= order.get(required_plan, 0)
