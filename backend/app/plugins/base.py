from __future__ import annotations

import threading
from dataclasses import dataclass, field
from typing import Any, Protocol

from sqlalchemy.orm import Session

from app.models.document import Document
from app.models.user import User
from app.plugins.contracts import InputType, PluginExecutionResult, PluginManifest
from app.schemas.tools import EditedDocumentPayload, LlmConfigOptional


class CancelledException(Exception):
    """Raised when a plugin run is cancelled due to client disconnect."""


@dataclass
class PluginRunContext:
    db: Session
    user: User
    document: Document
    input_type: InputType
    llm_config: LlmConfigOptional | None = None
    edited_document: EditedDocumentPayload | None = None
    shared_bundle: Any | None = None
    cancelled: threading.Event | None = None


class SmartAnalyzerPlugin(Protocol):
    manifest: PluginManifest

    async def can_handle(self, context: PluginRunContext) -> bool: ...

    async def run(self, context: PluginRunContext) -> PluginExecutionResult: ...
