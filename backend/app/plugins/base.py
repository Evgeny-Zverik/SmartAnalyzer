from __future__ import annotations

from dataclasses import dataclass
from typing import Protocol

from sqlalchemy.orm import Session

from app.models.document import Document
from app.models.user import User
from app.plugins.contracts import InputType, PluginExecutionResult, PluginManifest
from app.schemas.tools import EditedDocumentPayload, LlmConfigOptional


@dataclass
class PluginRunContext:
    db: Session
    user: User
    document: Document
    input_type: InputType
    llm_config: LlmConfigOptional | None = None
    edited_document: EditedDocumentPayload | None = None


class SmartAnalyzerPlugin(Protocol):
    manifest: PluginManifest

    async def can_handle(self, context: PluginRunContext) -> bool: ...

    async def run(self, context: PluginRunContext) -> PluginExecutionResult: ...
