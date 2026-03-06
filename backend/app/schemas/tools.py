from __future__ import annotations

from typing import Any

from pydantic import BaseModel


class DateItem(BaseModel):
    date: str
    description: str


class DocumentAnnotationItem(BaseModel):
    id: str
    type: str
    severity: str
    start_offset: int
    end_offset: int
    exact_quote: str
    title: str
    reason: str
    suggested_rewrite: str


class DocumentAdvancedEditorResult(BaseModel):
    full_text: str
    annotations: list[DocumentAnnotationItem]
    rich_content: dict[str, Any] | None = None
    source_format: str | None = None


class DocumentAnalyzerResult(BaseModel):
    summary: str
    key_points: list[str]
    risks: list[str]
    important_dates: list[DateItem]
    advanced_editor: DocumentAdvancedEditorResult


class RiskyClauseItem(BaseModel):
    title: str
    reason: str
    severity: str


class PenaltyItem(BaseModel):
    trigger: str
    amount_or_formula: str


class ObligationItem(BaseModel):
    party: str
    text: str


class ChecklistItem(BaseModel):
    item: str
    status: str
    note: str


class ContractCheckerResult(BaseModel):
    summary: str
    risky_clauses: list[RiskyClauseItem]
    penalties: list[PenaltyItem]
    obligations: list[ObligationItem]
    deadlines: list[DateItem]
    checklist: list[ChecklistItem]


class FieldItem(BaseModel):
    key: str
    value: str


class TableItem(BaseModel):
    name: str
    rows: list[list[str]]


class DataExtractorResult(BaseModel):
    fields: list[FieldItem]
    tables: list[TableItem]
    confidence: float


class RequirementItem(BaseModel):
    id: str
    text: str
    type: str


class ComplianceItem(BaseModel):
    item: str
    status: str
    note: str


class RiskItem(BaseModel):
    title: str
    severity: str
    reason: str


class TenderAnalyzerResult(BaseModel):
    summary: str
    requirements: list[RequirementItem]
    compliance_checklist: list[ComplianceItem]
    deadlines: list[DateItem]
    risks: list[RiskItem]


class RiskDriverItem(BaseModel):
    driver: str
    impact: str
    evidence: str


class RecommendationItem(BaseModel):
    action: str
    priority: str
    note: str


class RiskAnalyzerResult(BaseModel):
    risk_score: int
    confidence: float
    key_risks: list[RiskItem]
    risk_drivers: list[RiskDriverItem]
    recommendations: list[RecommendationItem]


class LlmConfigOptional(BaseModel):
    base_url: str | None = None
    api_key: str | None = None
    model: str | None = None


class ToolRunRequest(BaseModel):
    document_id: int
    llm_config: LlmConfigOptional | None = None


class DocumentAnalyzerRunResponse(BaseModel):
    analysis_id: int
    tool_slug: str
    result: DocumentAnalyzerResult


class ContractCheckerRunResponse(BaseModel):
    analysis_id: int
    tool_slug: str
    result: ContractCheckerResult


class DataExtractorRunResponse(BaseModel):
    analysis_id: int
    tool_slug: str
    result: DataExtractorResult


class TenderAnalyzerRunResponse(BaseModel):
    analysis_id: int
    tool_slug: str
    result: TenderAnalyzerResult


class RiskAnalyzerRunResponse(BaseModel):
    analysis_id: int
    tool_slug: str
    result: RiskAnalyzerResult
