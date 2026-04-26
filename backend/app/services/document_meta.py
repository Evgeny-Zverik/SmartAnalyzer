from __future__ import annotations

import io
from pathlib import Path

from app.core.encryption import decrypt


def _read_decrypted(path: str) -> bytes:
    p = Path(path)
    if not p.exists():
        return b""
    return decrypt(p.read_bytes())


def count_document_pages(storage_path: str, mime_type: str) -> int | None:
    """Return page count for a document, or None if not determinable cheaply.

    Counts pages for PDFs (via fitz/pypdf) and treats single-image files as 1 page.
    Returns None for DOCX/XLSX/text formats where "pages" depend on rendering.
    """
    mime = (mime_type or "").lower()
    try:
        if mime == "application/pdf" or storage_path.lower().endswith(".pdf"):
            data = _read_decrypted(storage_path)
            if not data:
                return None
            try:
                import fitz  # type: ignore

                with fitz.open(stream=data, filetype="pdf") as doc:
                    return doc.page_count
            except Exception:
                try:
                    from pypdf import PdfReader

                    return len(PdfReader(io.BytesIO(data)).pages)
                except Exception:
                    return None
        if mime.startswith("image/"):
            return 1
    except Exception:
        return None
    return None
