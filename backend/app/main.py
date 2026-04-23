from __future__ import annotations

import os
import sys
import threading
from datetime import datetime, timezone
from pathlib import Path

os.environ.setdefault("NO_PROXY", "localhost,127.0.0.1,0.0.0.0")

from fastapi import FastAPI, HTTPException
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware

from app.api.router import api_router
from app.core.config import settings
from app.db.session import check_database_connection
from app.services import token_counter
from app.utils.errors import (
    ApiError,
    api_error_handler,
    generic_exception_handler,
    http_exception_handler,
    validation_exception_handler,
)
from app.core.logging import logger

app = FastAPI(title="SmartAnalyzer API", version="1.0.0")
app.add_exception_handler(ApiError, api_error_handler)
app.add_exception_handler(HTTPException, http_exception_handler)
app.add_exception_handler(RequestValidationError, validation_exception_handler)
app.add_exception_handler(Exception, generic_exception_handler)
_cors_origins = [
    o.strip() for o in settings.cors_allow_origins.split(",") if o.strip()
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_origin_regex=r"^https?://(localhost|127\.0\.0\.1)(:\d+)?$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(api_router, prefix="/api/v1", tags=["api"])


@app.middleware("http")
async def reset_token_counter(request, call_next):
    token_counter.reset()
    return await call_next(request)


def _check_storage() -> dict[str, object]:
    path = Path(settings.storage_path)
    try:
        path.mkdir(parents=True, exist_ok=True)
        writable = os.access(path, os.W_OK)
        return {
            "status": "ok" if writable else "degraded",
            "path": str(path),
            "exists": path.exists(),
            "writable": writable,
        }
    except Exception as exc:
        logger.warning("Storage health check failed: %s", exc)
        return {
            "status": "down",
            "path": str(path),
            "exists": path.exists(),
            "writable": False,
            "detail": str(exc),
        }


def _check_configuration() -> dict[str, object]:
    jwt_ok = settings.jwt_secret != "change_me" and bool(settings.jwt_secret.strip())
    openai_ok = bool(settings.openai_api_key.strip())
    status = "ok" if jwt_ok else "degraded"
    return {
        "status": status,
        "environment": settings.env,
        "jwt_configured": jwt_ok,
        "openai_configured": openai_ok,
        "max_upload_bytes": settings.max_upload_bytes,
        "model": settings.openai_model,
    }


def _restart_backend_process() -> None:
    os.execv(sys.executable, [sys.executable, *sys.argv])


@app.get("/health")
def health() -> dict[str, object]:
    db_ok = check_database_connection()
    storage = _check_storage()
    configuration = _check_configuration()
    checks = {
        "api": {"status": "ok"},
        "database": {"status": "ok" if db_ok else "unavailable"},
        "storage": storage,
        "configuration": configuration,
    }
    overall_status = "ok"
    if not db_ok or storage["status"] == "down":
        overall_status = "degraded"
    if not db_ok:
        logger.warning("Health check degraded: database connection is unavailable")
    return {
        "status": overall_status,
        "checked_at": datetime.now(timezone.utc).isoformat(),
        "service": {
            "name": "SmartAnalyzer API",
            "version": app.version,
            "environment": settings.env,
        },
        "checks": checks,
    }


@app.post("/system/restart/backend", status_code=202)
def restart_backend() -> dict[str, str]:
    timer = threading.Timer(0.25, _restart_backend_process)
    timer.daemon = True
    timer.start()
    return {"status": "accepted", "message": "Backend restart scheduled"}
