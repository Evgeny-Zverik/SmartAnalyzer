from fastapi import FastAPI

from app.api.router import api_router

app = FastAPI(title="SmartAnalyzer API")
app.include_router(api_router, prefix="/api/v1", tags=["api"])


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}
