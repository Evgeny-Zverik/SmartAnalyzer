from __future__ import annotations

import json
import subprocess
import tempfile
from pathlib import Path

from app.core.encryption import decrypt
from app.utils.errors import raise_error

IMAGE_MIME_TYPES = {"image/png", "image/jpeg", "image/jpg", "image/heic", "image/heif"}
VISION_OCR_SCRIPT = Path(__file__).with_name("vision_ocr.swift")


def _read_decrypted_bytes(path: str) -> bytes:
    file_path = Path(path)
    if not file_path.exists():
        raise_error(400, "BAD_REQUEST", "File not found", {"path": path})
    return decrypt(file_path.read_bytes())


def recognize_handwriting(path: str, mime_type: str) -> dict:
    if mime_type not in IMAGE_MIME_TYPES:
        raise_error(
            400,
            "BAD_REQUEST",
            "Handwriting recognition currently supports PNG and JPEG images.",
            {"mime_type": mime_type},
        )

    if not VISION_OCR_SCRIPT.exists():
        raise_error(500, "OCR_UNAVAILABLE", "OCR script is missing on the server.", {})

    content = _read_decrypted_bytes(path)
    suffix = Path(path).suffix or ".png"

    try:
        with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
            tmp.write(content)
            tmp_path = Path(tmp.name)
    except OSError as exc:
        raise_error(500, "OCR_TEMPFILE_ERROR", "Cannot prepare OCR input file.", {"detail": str(exc)})

    try:
        proc = subprocess.run(
            ["/usr/bin/swift", str(VISION_OCR_SCRIPT), str(tmp_path)],
            capture_output=True,
            text=True,
            timeout=120,
            check=False,
        )
    except subprocess.TimeoutExpired:
        raise_error(504, "OCR_TIMEOUT", "Handwriting recognition timed out.", {})
    except OSError as exc:
        raise_error(500, "OCR_UNAVAILABLE", "Cannot start OCR engine.", {"detail": str(exc)})
    finally:
        tmp_path.unlink(missing_ok=True)

    output = (proc.stdout or "").strip()
    error_output = (proc.stderr or "").strip()

    if proc.returncode != 0:
        detail = error_output or output or f"swift exited with code {proc.returncode}"
        raise_error(500, "OCR_FAILED", "Handwriting recognition failed.", {"detail": detail})

    try:
        data = json.loads(output)
    except json.JSONDecodeError as exc:
        raise_error(500, "OCR_INVALID_RESPONSE", "OCR returned invalid JSON.", {"detail": str(exc)})

    if not isinstance(data, dict):
        raise_error(500, "OCR_INVALID_RESPONSE", "OCR result must be an object.", {})

    return {
        "recognized_text": str(data.get("recognized_text") or "").strip(),
        "confidence": float(data.get("confidence") or 0.0),
        "page_count": int(data.get("page_count") or 0),
        "lines": [
            {
                "text": str(item.get("text") or "").strip(),
                "confidence": float(item.get("confidence") or 0.0),
            }
            for item in data.get("lines", [])
            if isinstance(item, dict) and str(item.get("text") or "").strip()
        ],
    }
