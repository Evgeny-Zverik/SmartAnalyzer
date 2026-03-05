from fastapi import FastAPI, HTTPException
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware

from app.api.router import api_router
from app.utils.errors import (
    ApiError,
    api_error_handler,
    generic_exception_handler,
    http_exception_handler,
    validation_exception_handler,
)

app = FastAPI(title="SmartAnalyzer API", version="1.0.0")
app.add_exception_handler(ApiError, api_error_handler)
app.add_exception_handler(HTTPException, http_exception_handler)
app.add_exception_handler(RequestValidationError, validation_exception_handler)
app.add_exception_handler(Exception, generic_exception_handler)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(api_router, prefix="/api/v1", tags=["api"])


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}
