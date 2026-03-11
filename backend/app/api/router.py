from fastapi import APIRouter

from app.api.v1 import analyses, auth, billing, documents, folders, plugins, tools, usage

api_router = APIRouter()
api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(folders.router, prefix="/folders", tags=["folders"])
api_router.include_router(documents.router, prefix="/documents", tags=["documents"])
api_router.include_router(tools.router, prefix="/tools", tags=["tools"])
api_router.include_router(plugins.router, prefix="/plugins", tags=["plugins"])
api_router.include_router(analyses.router, prefix="/analyses", tags=["analyses"])
api_router.include_router(usage.router, prefix="/usage", tags=["usage"])
api_router.include_router(billing.router, prefix="/billing", tags=["billing"])
