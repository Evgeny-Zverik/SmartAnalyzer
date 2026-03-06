from __future__ import annotations

import os

os.environ.setdefault("NO_PROXY", "localhost,127.0.0.1,0.0.0.0")

from fastapi import FastAPI, HTTPException
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware

from app.api.router import api_router
from app.db.session import check_database_connection
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
app.add_middleware(
    CORSMiddleware,
    allow_origins=[],
    allow_origin_regex=r"^https?://(localhost|127\.0\.0\.1)(:\d+)?$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(api_router, prefix="/api/v1", tags=["api"])


@app.get("/health")
def health() -> dict[str, object]:
    db_ok = check_database_connection()
    status = "ok" if db_ok else "degraded"
    if not db_ok:
        logger.warning("Health check degraded: database connection is unavailable")
    return {
        "status": status,
        "checks": {
            "api": "ok",
            "database": "ok" if db_ok else "unavailable",
        },
    }
