from __future__ import annotations

import sys
from pathlib import Path

from fastapi import FastAPI, File, Header, HTTPException, UploadFile

ROOT_DIR = Path(__file__).resolve().parent.parent
BACKEND_DIR = ROOT_DIR / "backend"
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app.core.config import settings  # noqa: E402
from app.services.ocr import recognize_handwriting_bytes  # noqa: E402

app = FastAPI(title="SmartAnalyzer OCR Service", version="1.0.0")
settings.ocr_backend = "local"


def _authorize(authorization: str | None) -> None:
    expected = str(settings.ocr_service_api_key or "").strip()
    if not expected:
        return
    if authorization != f"Bearer {expected}":
        raise HTTPException(status_code=401, detail="Unauthorized")


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/ocr/recognize")
async def recognize(
    file: UploadFile = File(...),
    authorization: str | None = Header(default=None),
) -> dict[str, str]:
    _authorize(authorization)
    content = await file.read()
    result = recognize_handwriting_bytes(content, file.content_type or "application/octet-stream")
    return {"text": str(result.get("recognized_text") or "")}
