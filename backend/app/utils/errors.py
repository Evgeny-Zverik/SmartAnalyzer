from fastapi import HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse


def raise_error(status_code: int, error: str, message: str, details: dict | None = None) -> None:
    raise ApiError(status_code=status_code, error=error, message=message, details=details or {})


class ApiError(Exception):
    def __init__(
        self,
        *,
        status_code: int,
        error: str,
        message: str,
        details: dict | None = None,
    ):
        self.status_code = status_code
        self.error = error
        self.message = message
        self.details = details or {}


_STATUS_TO_ERROR: dict[int, str] = {
    400: "BAD_REQUEST",
    401: "UNAUTHORIZED",
    403: "FORBIDDEN",
    404: "NOT_FOUND",
    409: "CONFLICT",
    413: "PAYLOAD_TOO_LARGE",
    422: "VALIDATION_ERROR",
    429: "LIMIT_REACHED",
    500: "INTERNAL_ERROR",
}


def _error_response(status_code: int, error: str, message: str, details: dict) -> JSONResponse:
    return JSONResponse(
        status_code=status_code,
        content={"error": error, "message": message, "details": details},
        media_type="application/json; charset=utf-8",
    )


def api_error_handler(request: Request, exc: ApiError) -> JSONResponse:
    return _error_response(exc.status_code, exc.error, exc.message, exc.details)


def http_exception_handler(request: Request, exc: HTTPException) -> JSONResponse:
    status_code = exc.status_code
    error = _STATUS_TO_ERROR.get(status_code, "ERROR")
    if isinstance(exc.detail, dict):
        message = exc.detail.get("message", str(exc.detail))
        details = {k: v for k, v in exc.detail.items() if k != "message"}
    else:
        message = str(exc.detail) if exc.detail else "Error"
        details = {}
    return _error_response(status_code, error, message, details)


def validation_exception_handler(request: Request, exc: RequestValidationError) -> JSONResponse:
    details = {"fields": exc.errors()}
    return _error_response(422, "VALIDATION_ERROR", "Validation failed", details)


def generic_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    return _error_response(
        500,
        "INTERNAL_ERROR",
        "An unexpected error occurred",
        {},
    )
