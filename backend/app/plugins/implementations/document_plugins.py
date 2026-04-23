from __future__ import annotations

from datetime import datetime, timezone

from app.plugins.base import PluginRunContext
from app.plugins.contracts import (
    ContentAnchor,
    PluginAction,
    PluginExecutionResult,
    PluginFinding,
    PluginManifest,
    PluginOverlay,
    PluginPanel,
    PluginSummary,
    PluginSummaryCounter,
)
from app.plugins.implementations.document_bundle import build_document_bundle


def _anchor_from_annotation(annotation) -> ContentAnchor:
    return ContentAnchor(
        target_type="document",
        text_range={"start": annotation.start_offset, "end": annotation.end_offset},
    )


def _get_bundle(context: PluginRunContext):
    """Get or compute the document bundle, caching in context for reuse."""
    bundle, editor_payload = build_document_bundle(
        context.document.storage_path,
        context.document.mime_type,
        db=context.db,
        user=context.user,
        overrides=None,
        edited_document=context.edited_document.model_dump() if context.edited_document else None,
        cached_bundle=context.shared_bundle,
        cancelled=context.cancelled,
    )
    if context.shared_bundle is None:
        context.shared_bundle = (bundle, editor_payload)
    return bundle, editor_payload

class KeyPointsPlugin:
    manifest = PluginManifest(
        id="key_points",
        version="1.0.0",
        name="Key Points",
        description="Собирает ключевые пункты документа.",
        category="analysis",
        supported_inputs=["pdf", "docx", "text"],
        required_plan="free",
        ui_slots=["right_sidebar", "inspector_panel", "bottom_panel"],
        capabilities=["analyze", "panel"],
        output_schema_version="1.0",
        auto_enable=True,
    )

    async def can_handle(self, context: PluginRunContext) -> bool:
        return context.input_type in self.manifest.supported_inputs

    async def run(self, context: PluginRunContext) -> PluginExecutionResult:
        started_at = datetime.now(timezone.utc)
        bundle, _ = _get_bundle(context)
        finished_at = datetime.now(timezone.utc)
        findings = [
            PluginFinding(
                id=f"{self.manifest.id}-{index}",
                type="key_point",
                title=point,
                description=point,
                metadata={"order": index + 1},
            )
            for index, point in enumerate(bundle.key_points)
        ]
        return PluginExecutionResult(
            plugin_id=self.manifest.id,
            plugin_version=self.manifest.version,
            status="completed",
            started_at=started_at,
            finished_at=finished_at,
            summary=PluginSummary(
                title="Key Points",
                short_text=f"Найдено {len(findings)} ключевых пунктов",
                counters=[PluginSummaryCounter(key="count", label="Count", value=len(findings))],
            ),
            findings=findings,
            panels=[
                PluginPanel(
                    id="key-points-list",
                    title="Key Points",
                    slot="bottom_panel",
                    panel_type="list",
                    data={"items": [finding.model_dump() for finding in findings]},
                )
            ],
            raw={"key_points": bundle.key_points},
        )


class DatesDeadlinesPlugin:
    manifest = PluginManifest(
        id="dates_deadlines",
        version="1.0.0",
        name="Dates & Deadlines",
        description="Извлекает даты, дедлайны и связанные контекстные заметки.",
        category="analysis",
        supported_inputs=["pdf", "docx", "text"],
        required_plan="free",
        ui_slots=["right_sidebar", "inspector_panel", "bottom_panel"],
        capabilities=["extract", "timeline", "panel"],
        output_schema_version="1.0",
        auto_enable=True,
    )

    async def can_handle(self, context: PluginRunContext) -> bool:
        return context.input_type in self.manifest.supported_inputs

    async def run(self, context: PluginRunContext) -> PluginExecutionResult:
        started_at = datetime.now(timezone.utc)
        bundle, _ = _get_bundle(context)
        finished_at = datetime.now(timezone.utc)
        findings = [
            PluginFinding(
                id=f"{self.manifest.id}-{index}",
                type="date",
                title=item.date,
                description=item.description,
                metadata={"date": item.date},
            )
            for index, item in enumerate(bundle.important_dates)
        ]
        return PluginExecutionResult(
            plugin_id=self.manifest.id,
            plugin_version=self.manifest.version,
            status="completed",
            started_at=started_at,
            finished_at=finished_at,
            summary=PluginSummary(
                title="Dates & Deadlines",
                short_text=f"Найдено {len(findings)} важных дат",
                counters=[PluginSummaryCounter(key="count", label="Dates", value=len(findings))],
            ),
            findings=findings,
            panels=[
                PluginPanel(
                    id="dates-list",
                    title="Dates & Deadlines",
                    slot="bottom_panel",
                    panel_type="timeline",
                    data={"items": [finding.model_dump() for finding in findings]},
                )
            ],
            raw={"important_dates": [item.model_dump() for item in bundle.important_dates]},
        )


class RiskAnalyzerPlugin:
    manifest = PluginManifest(
        id="risk_analyzer",
        version="1.0.0",
        name="Risk Analyzer",
        description="Находит рискованные формулировки и дает рекомендации по исправлению.",
        category="composite",
        supported_inputs=["pdf", "docx", "text"],
        required_plan="free",
        ui_slots=["right_sidebar", "document_overlay", "inspector_panel", "document_toolbar", "bottom_panel"],
        capabilities=["analyze", "highlight", "annotate", "suggest", "toolbar_action", "panel"],
        output_schema_version="1.0",
        auto_enable=True,
    )

    async def can_handle(self, context: PluginRunContext) -> bool:
        return context.input_type in self.manifest.supported_inputs

    async def run(self, context: PluginRunContext) -> PluginExecutionResult:
        started_at = datetime.now(timezone.utc)
        bundle, _ = _get_bundle(context)
        risk_annotations = [item for item in bundle.advanced_editor.annotations if item.type == "risk"]
        findings = [
            PluginFinding(
                id=annotation.id,
                type="risk",
                title=annotation.title,
                description=annotation.reason,
                severity=annotation.severity,
                confidence=0.8,
                anchor=_anchor_from_annotation(annotation),
                quote=annotation.exact_quote,
                suggestion=annotation.suggested_rewrite,
            )
            for annotation in risk_annotations
        ]
        overlays = [
            PluginOverlay(
                id=f"overlay-{annotation.id}",
                type="highlight",
                anchor=_anchor_from_annotation(annotation),
                label="Risk",
                severity=annotation.severity,
                color_token="risk",
                interactive=True,
                finding_id=annotation.id,
            )
            for annotation in risk_annotations
        ]
        finished_at = datetime.now(timezone.utc)
        return PluginExecutionResult(
            plugin_id=self.manifest.id,
            plugin_version=self.manifest.version,
            status="completed",
            started_at=started_at,
            finished_at=finished_at,
            summary=PluginSummary(
                title="Risks",
                short_text=f"Найдено {len(findings)} рискованных фрагментов",
                counters=[
                    PluginSummaryCounter(
                        key="high",
                        label="High",
                        value=len([item for item in findings if item.severity == "high"]),
                    ),
                    PluginSummaryCounter(
                        key="medium",
                        label="Medium",
                        value=len([item for item in findings if item.severity == "medium"]),
                    ),
                ],
            ),
            findings=findings,
            overlays=overlays,
            actions=[],
            panels=[
                PluginPanel(
                    id="risk-findings",
                    title="Risk Findings",
                    slot="bottom_panel",
                    panel_type="list",
                    data={"items": [finding.model_dump() for finding in findings]},
                )
            ],
            raw={"annotations": [item.model_dump() for item in risk_annotations]},
        )


class SuggestedEditsPlugin:
    manifest = PluginManifest(
        id="suggested_edits",
        version="1.0.0",
        name="Suggested Edits",
        description="Показывает фрагменты, которые стоит переписать, и готовые варианты текста.",
        category="composite",
        supported_inputs=["pdf", "docx", "text"],
        required_plan="free",
        ui_slots=["right_sidebar", "document_overlay", "inspector_panel", "document_toolbar", "bottom_panel"],
        capabilities=["suggest", "annotate", "highlight", "toolbar_action", "panel"],
        output_schema_version="1.0",
        auto_enable=True,
    )

    async def can_handle(self, context: PluginRunContext) -> bool:
        return context.input_type in self.manifest.supported_inputs

    async def run(self, context: PluginRunContext) -> PluginExecutionResult:
        started_at = datetime.now(timezone.utc)
        bundle, _ = _get_bundle(context)
        improvement_annotations = [item for item in bundle.advanced_editor.annotations if item.type == "improvement"]
        findings = [
            PluginFinding(
                id=annotation.id,
                type="suggestion",
                title=annotation.title,
                description=annotation.reason,
                severity=annotation.severity,
                anchor=_anchor_from_annotation(annotation),
                quote=annotation.exact_quote,
                suggestion=annotation.suggested_rewrite,
            )
            for annotation in improvement_annotations
        ]
        overlays = [
            PluginOverlay(
                id=f"overlay-{annotation.id}",
                type="underline",
                anchor=_anchor_from_annotation(annotation),
                label="Improvement",
                severity=annotation.severity,
                color_token="suggestion",
                interactive=True,
                finding_id=annotation.id,
            )
            for annotation in improvement_annotations
        ]
        finished_at = datetime.now(timezone.utc)
        return PluginExecutionResult(
            plugin_id=self.manifest.id,
            plugin_version=self.manifest.version,
            status="completed",
            started_at=started_at,
            finished_at=finished_at,
            summary=PluginSummary(
                title="Suggested Edits",
                short_text=f"Найдено {len(findings)} мест для улучшения",
                counters=[PluginSummaryCounter(key="count", label="Count", value=len(findings))],
            ),
            findings=findings,
            overlays=overlays,
            actions=[],
            panels=[
                PluginPanel(
                    id="suggested-edits",
                    title="Suggested Edits",
                    slot="bottom_panel",
                    panel_type="list",
                    data={"items": [finding.model_dump() for finding in findings]},
                )
            ],
            raw={"annotations": [item.model_dump() for item in improvement_annotations]},
        )
