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
    risky_clauses: list["RiskyClauseItem"] = []
    penalties: list["PenaltyItem"] = []
    obligations: list["ObligationItem"] = []
    checklist: list["ChecklistItem"] = []
    legal_basis: list[str] = []
    overall_risk_score: int = 0


class RiskyClauseItem(BaseModel):
    title: str
    reason: str
    severity: str
    legal_basis: str = ""
    evidence_quote: str = ""
    source_status: str = "unconfirmed"


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



class FieldItem(BaseModel):
    key: str
    value: str


class TableItem(BaseModel):
    name: str
    rows: list[list[str]]


class DataExtractorResult(BaseModel):
    summary: str
    left_document_summary: str
    right_document_summary: str
    common_points: list[str]
    differences: list[str]
    relation_assessment: str
    are_documents_related: bool


class OCRBoundingBox(BaseModel):
    x: int
    y: int
    width: int
    height: int


class OCRLineItem(BaseModel):
    text: str
    confidence: float
    model_id: str | None = None
    page_index: int = 0
    field_name: str | None = None
    source: str | None = None
    needs_review: bool = False
    bbox: OCRBoundingBox | None = None


class HandwritingRecognitionResult(BaseModel):
    recognized_text: str
    confidence: float
    page_count: int
    template_id: str | None = None
    ocr_model_id: str | None = None
    needs_review_count: int = 0
    lines: list[OCRLineItem]


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


class CourtPositionItem(BaseModel):
    court: str
    position: str
    relevance: str
    region_match: str = "unknown"  # "match" | "other" | "unknown"


class CaseLawReferenceItem(BaseModel):
    title: str
    citation: str
    url: str
    takeaway: str
    region_match: str = "unknown"  # "match" | "other" | "unknown"
    amount_rub: int | None = None  # максимальная сумма в рублях, обнаруженная в снипете


class TenderAnalyzerResult(BaseModel):
    query: str
    summary: str
    search_scope: str
    dispute_overview: str
    regions: list[str]
    court_positions: list[CourtPositionItem]
    cited_cases: list[CaseLawReferenceItem]
    legal_basis: list[str]
    practical_takeaways: list[str]
    follow_up_prompt: str
    data_source: str = "live"
    related_region_notice: str = ""
    requested_regions: list[str] = []


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


class LegalTextSimplifierResult(BaseModel):
    summary: str
    plain_language_text: str
    key_points: list[str]


class SpellingCorrectionItem(BaseModel):
    original: str
    corrected: str
    reason: str


class SpellingCheckerResult(BaseModel):
    summary: str
    original_text: str
    corrected_text: str
    corrections: list[SpellingCorrectionItem]


class LlmConfigOptional(BaseModel):
    base_url: str | None = None
    api_key: str | None = None
    model: str | None = None
    compression_level: str | None = None
    analysis_mode: str | None = None


class EditedDocumentPayload(BaseModel):
    full_text: str
    rich_content: dict[str, Any] | None = None
    source_format: str | None = None


class ToolRunRequest(BaseModel):
    document_id: int
    compare_document_id: int | None = None
    folder_id: int | None = None
    llm_config: LlmConfigOptional | None = None
    edited_document: EditedDocumentPayload | None = None


class TenderAnalyzerChatRequest(BaseModel):
    query: str
    allow_related_regions: bool = False


class DocumentAnalyzerRunResponse(BaseModel):
    analysis_id: int
    tool_slug: str
    result: DocumentAnalyzerResult


class DocumentAnalyzerPrepareResponse(BaseModel):
    document_id: int
    tool_slug: str
    advanced_editor: DocumentAdvancedEditorResult



class DataExtractorRunResponse(BaseModel):
    analysis_id: int
    tool_slug: str
    result: DataExtractorResult


class HandwritingRecognitionRunResponse(BaseModel):
    analysis_id: int
    tool_slug: str
    result: HandwritingRecognitionResult


class TenderAnalyzerRunResponse(BaseModel):
    analysis_id: int
    tool_slug: str
    result: TenderAnalyzerResult


class TenderAnalyzerChatResponse(BaseModel):
    tool_slug: str
    result: TenderAnalyzerResult


class RiskAnalyzerRunResponse(BaseModel):
    analysis_id: int
    tool_slug: str
    result: RiskAnalyzerResult


class LegalTextSimplifierRunResponse(BaseModel):
    analysis_id: int
    tool_slug: str
    result: LegalTextSimplifierResult


class SpellingCheckerRunResponse(BaseModel):
    analysis_id: int
    tool_slug: str
    result: SpellingCheckerResult
