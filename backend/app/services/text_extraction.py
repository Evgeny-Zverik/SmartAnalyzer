from __future__ import annotations

from pathlib import Path
from typing import Any

from app.utils.errors import raise_error

MAX_TEXT_LENGTH = 60_000
XLSX_MAX_SHEETS = 2
XLSX_MAX_ROWS = 200
XLSX_TABLE_MAX_ROWS = 20


def extract_text_from_pdf(path: str) -> str:
    try:
        from pypdf import PdfReader
    except ImportError:
        raise_error(500, "INTERNAL_ERROR", "PDF support not available", {})
    p = Path(path)
    if not p.exists():
        raise_error(400, "BAD_REQUEST", "File not found", {"path": path})
    try:
        reader = PdfReader(str(p))
        parts = []
        total = 0
        for page in reader.pages:
            if total >= MAX_TEXT_LENGTH:
                break
            text = page.extract_text() or ""
            remaining = MAX_TEXT_LENGTH - total
            if len(text) > remaining:
                text = text[:remaining]
            parts.append(text)
            total += len(text)
        raw = "".join(parts).strip()
        if not raw:
            raise_error(400, "BAD_REQUEST", "Cannot read text from document. The file may be empty or image-only.", {})
        return raw
    except Exception as e:
        raise_error(400, "BAD_REQUEST", "Cannot read text from document.", {"detail": str(e)})


def extract_text_from_docx(path: str) -> str:
    try:
        from docx import Document as DocxDocument
    except ImportError:
        raise_error(500, "INTERNAL_ERROR", "DOCX support not available", {})
    p = Path(path)
    if not p.exists():
        raise_error(400, "BAD_REQUEST", "File not found", {"path": path})
    try:
        doc = DocxDocument(str(p))
        parts = []
        for para in doc.paragraphs:
            if para.text:
                parts.append(para.text)
        for table in doc.tables:
            for row in table.rows:
                for cell in row.cells:
                    if cell.text:
                        parts.append(cell.text)
        raw = "\n".join(parts).strip()
        if len(raw) > MAX_TEXT_LENGTH:
            raw = raw[:MAX_TEXT_LENGTH]
        if not raw:
            raise_error(400, "BAD_REQUEST", "Cannot read text from document. The file may be empty.", {})
        return raw
    except Exception as e:
        raise_error(400, "BAD_REQUEST", "Cannot read text from document.", {"detail": str(e)})


def extract_text_from_xlsx(path: str) -> str:
    try:
        from openpyxl import load_workbook
    except ImportError:
        raise_error(500, "INTERNAL_ERROR", "XLSX support not available", {})
    p = Path(path)
    if not p.exists():
        raise_error(400, "BAD_REQUEST", "File not found", {"path": path})
    try:
        wb = load_workbook(str(p), read_only=True, data_only=True)
        parts: list[str] = []
        total = 0
        for idx, sheet in enumerate(wb.worksheets):
            if idx >= XLSX_MAX_SHEETS:
                break
            sheet_name = sheet.title
            row_count = 0
            for row in sheet.iter_rows(values_only=True):
                if row_count >= XLSX_MAX_ROWS or total >= MAX_TEXT_LENGTH:
                    break
                line = " ".join(str(c) if c is not None else "" for c in row).strip()
                if line:
                    parts.append(f"Sheet: {sheet_name} Row: {line}")
                    total += len(parts[-1]) + 1
                row_count += 1
        wb.close()
        raw = "\n".join(parts).strip()
        if not raw:
            raise_error(400, "BAD_REQUEST", "Cannot read text from XLSX. The file may be empty.", {})
        return raw[:MAX_TEXT_LENGTH]
    except Exception as e:
        raise_error(400, "BAD_REQUEST", "Cannot read text from document.", {"detail": str(e)})


def extract_tables_from_xlsx(path: str) -> list[dict[str, Any]]:
    try:
        from openpyxl import load_workbook
    except ImportError:
        return []
    p = Path(path)
    if not p.exists():
        return []
    try:
        wb = load_workbook(str(p), read_only=True, data_only=True)
        out: list[dict[str, Any]] = []
        for idx, sheet in enumerate(wb.worksheets):
            if idx >= 1:
                break
            rows: list[list[str]] = []
            for row_idx, row in enumerate(sheet.iter_rows(values_only=True)):
                if row_idx >= XLSX_TABLE_MAX_ROWS:
                    break
                rows.append([str(c) if c is not None else "" for c in row])
            if rows:
                out.append({"name": sheet.title or "Sheet 1", "rows": rows})
        wb.close()
        return out
    except Exception:
        return []


def extract_text(path: str, mime_type: str) -> str:
    if mime_type == "application/pdf":
        return extract_text_from_pdf(path)
    if mime_type == "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
        return extract_text_from_docx(path)
    if mime_type == "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet":
        return extract_text_from_xlsx(path)
    raise_error(
        400,
        "BAD_REQUEST",
        "Unsupported file type for text extraction. Use PDF, DOCX or XLSX.",
        {"mime_type": mime_type},
    )
