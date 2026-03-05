from fastapi import APIRouter

from app.api.v1 import auth, documents, tools, usage

api_router = APIRouter()
api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(documents.router, prefix="/documents", tags=["documents"])
api_router.include_router(tools.router, prefix="/tools", tags=["tools"])
api_router.include_router(usage.router, prefix="/usage", tags=["usage"])
