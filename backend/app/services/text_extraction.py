from pathlib import Path

from app.utils.errors import raise_error

MAX_TEXT_LENGTH = 60_000


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


def extract_text(path: str, mime_type: str) -> str:
    if mime_type == "application/pdf":
        return extract_text_from_pdf(path)
    if mime_type == "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
        return extract_text_from_docx(path)
    raise_error(400, "BAD_REQUEST", "Unsupported file type for text extraction. Use PDF or DOCX.", {"mime_type": mime_type})
