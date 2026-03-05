from fastapi import APIRouter, Depends
from pydantic import ValidationError
from sqlalchemy.orm import Session

from app.core.security import get_current_user
from app.db.session import get_db
from app.models.document import Document
from app.models.document_analysis import DocumentAnalysis
from app.models.user import User
from app.services.usage import assert_can_run, log_run
from app.services.text_extraction import extract_text, extract_tables_from_xlsx
from app.services.llm_client import analyze_document, check_contract, extract_structured_data
from app.utils.errors import raise_error
from app.schemas.tools import (
    ChecklistItem,
    ContractCheckerRunResponse,
    ContractCheckerResult,
    DataExtractorRunResponse,
    DataExtractorResult,
    DateItem,
    DocumentAnalyzerRunResponse,
    DocumentAnalyzerResult,
    FieldItem,
    ObligationItem,
    PenaltyItem,
    RecommendationItem,
    RequirementItem,
    ComplianceItem,
    RiskAnalyzerRunResponse,
    RiskAnalyzerResult,
    RiskDriverItem,
    RiskItem,
    RiskyClauseItem,
    TableItem,
    TenderAnalyzerRunResponse,
    TenderAnalyzerResult,
    ToolRunRequest,
)

router = APIRouter()


def _get_document_for_user(db: Session, document_id: int, user_id: int) -> Document:
    doc = db.query(Document).filter(Document.id == document_id, Document.user_id == user_id).first()
    if not doc:
        raise_error(404, "NOT_FOUND", "Document not found", {"document_id": document_id})
    return doc


def _save_analysis(db: Session, user_id: int, document_id: int, tool_slug: str, result: dict) -> int:
    row = DocumentAnalysis(
        user_id=user_id,
        document_id=document_id,
        tool_slug=tool_slug,
        result_json=result,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return row.id


def _stub_document_analyzer(analysis_id: int) -> DocumentAnalyzerRunResponse:
    return DocumentAnalyzerRunResponse(
        analysis_id=analysis_id,
        tool_slug="document-analyzer",
        result=DocumentAnalyzerResult(
            summary="Stub summary",
            key_points=["Stub point"],
            risks=[],
            important_dates=[DateItem(date="2026-03-05", description="Stub date")],
        ),
    )


def _stub_contract_checker(analysis_id: int) -> ContractCheckerRunResponse:
    return ContractCheckerRunResponse(
        analysis_id=analysis_id,
        tool_slug="contract-checker",
        result=ContractCheckerResult(
            summary="Stub summary",
            risky_clauses=[RiskyClauseItem(title="Stub", reason="Stub", severity="low")],
            penalties=[PenaltyItem(trigger="Stub", amount_or_formula="Stub")],
            obligations=[ObligationItem(party="buyer", text="Stub")],
            deadlines=[DateItem(date="2026-03-05", description="Stub")],
            checklist=[ChecklistItem(item="Stub", status="ok", note="")],
        ),
    )


def _stub_data_extractor(analysis_id: int) -> DataExtractorRunResponse:
    return DataExtractorRunResponse(
        analysis_id=analysis_id,
        tool_slug="data-extractor",
        result=DataExtractorResult(
            fields=[FieldItem(key="stub", value="stub")],
            tables=[TableItem(name="Table 1", rows=[["c1", "c2"], ["v1", "v2"]])],
            confidence=0.0,
        ),
    )


def _stub_tender_analyzer(analysis_id: int) -> TenderAnalyzerRunResponse:
    return TenderAnalyzerRunResponse(
        analysis_id=analysis_id,
        tool_slug="tender-analyzer",
        result=TenderAnalyzerResult(
            summary="Stub summary",
            requirements=[RequirementItem(id="REQ-1", text="Stub", type="doc")],
            compliance_checklist=[ComplianceItem(item="Stub", status="required", note="")],
            deadlines=[DateItem(date="2026-03-05", description="Stub")],
            risks=[RiskItem(title="Stub", severity="low", reason="Stub")],
        ),
    )


def _stub_risk_analyzer(analysis_id: int) -> RiskAnalyzerRunResponse:
    return RiskAnalyzerRunResponse(
        analysis_id=analysis_id,
        tool_slug="risk-analyzer",
        result=RiskAnalyzerResult(
            risk_score=0,
            confidence=0.0,
            key_risks=[RiskItem(title="Stub", severity="low", reason="Stub")],
            risk_drivers=[RiskDriverItem(driver="Stub", impact="low", evidence="Stub")],
            recommendations=[RecommendationItem(action="Stub", priority="low", note="")],
        ),
    )


@router.post("/document-analyzer/run", response_model=DocumentAnalyzerRunResponse)
def run_document_analyzer(
    body: ToolRunRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    assert_can_run(db, current_user, "document-analyzer")
    doc = _get_document_for_user(db, body.document_id, current_user.id)
    text = extract_text(doc.storage_path, doc.mime_type)
    overrides = body.llm_config.model_dump(exclude_none=True) if body.llm_config else None
    raw_result = analyze_document(text, overrides=overrides)
    try:
        result = DocumentAnalyzerResult.model_validate(raw_result)
    except ValidationError:
        raise_error(500, "LLM_ERROR", "Analysis result format invalid. Try again.", {})
    analysis_id = _save_analysis(
        db, current_user.id, body.document_id, "document-analyzer", result.model_dump()
    )
    log_run(db, current_user.id, "document-analyzer")
    return DocumentAnalyzerRunResponse(analysis_id=analysis_id, tool_slug="document-analyzer", result=result)


@router.post("/contract-checker/run", response_model=ContractCheckerRunResponse)
def run_contract_checker(
    body: ToolRunRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    assert_can_run(db, current_user, "contract-checker")
    doc = _get_document_for_user(db, body.document_id, current_user.id)
    text = extract_text(doc.storage_path, doc.mime_type)
    overrides = body.llm_config.model_dump(exclude_none=True) if body.llm_config else None
    raw_result = check_contract(text, overrides=overrides)
    try:
        result = ContractCheckerResult.model_validate(raw_result)
    except ValidationError:
        raise_error(500, "LLM_INVALID_RESPONSE", "Contract analysis result format invalid. Try again.", {})
    analysis_id = _save_analysis(
        db, current_user.id, body.document_id, "contract-checker", result.model_dump()
    )
    log_run(db, current_user.id, "contract-checker")
    return ContractCheckerRunResponse(analysis_id=analysis_id, tool_slug="contract-checker", result=result)


@router.post("/data-extractor/run", response_model=DataExtractorRunResponse)
def run_data_extractor(
    body: ToolRunRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    assert_can_run(db, current_user, "data-extractor")
    doc = _get_document_for_user(db, body.document_id, current_user.id)
    text = extract_text(doc.storage_path, doc.mime_type)
    xlsx_tables: list[dict] = []
    if doc.mime_type == "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet":
        xlsx_tables = extract_tables_from_xlsx(doc.storage_path)
    overrides = body.llm_config.model_dump(exclude_none=True) if body.llm_config else None
    raw_result = extract_structured_data(text, overrides=overrides)
    if xlsx_tables:
        existing = raw_result.get("tables") or []
        raw_result["tables"] = xlsx_tables + existing[: max(0, 3 - len(xlsx_tables))]
    try:
        result = DataExtractorResult.model_validate(raw_result)
    except ValidationError:
        raise_error(500, "LLM_INVALID_RESPONSE", "Data extraction result format invalid. Try again.", {})
    analysis_id = _save_analysis(
        db, current_user.id, body.document_id, "data-extractor", result.model_dump()
    )
    log_run(db, current_user.id, "data-extractor")
    return DataExtractorRunResponse(analysis_id=analysis_id, tool_slug="data-extractor", result=result)


@router.post("/tender-analyzer/run", response_model=TenderAnalyzerRunResponse)
def run_tender_analyzer(
    body: ToolRunRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _get_document_for_user(db, body.document_id, current_user.id)
    stub = _stub_tender_analyzer(analysis_id=0)
    analysis_id = _save_analysis(
        db, current_user.id, body.document_id, "tender-analyzer", stub.result.model_dump()
    )
    return TenderAnalyzerRunResponse(analysis_id=analysis_id, tool_slug=stub.tool_slug, result=stub.result)


@router.post("/risk-analyzer/run", response_model=RiskAnalyzerRunResponse)
def run_risk_analyzer(
    body: ToolRunRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _get_document_for_user(db, body.document_id, current_user.id)
    stub = _stub_risk_analyzer(analysis_id=0)
    analysis_id = _save_analysis(
        db, current_user.id, body.document_id, "risk-analyzer", stub.result.model_dump()
    )
    return RiskAnalyzerRunResponse(analysis_id=analysis_id, tool_slug=stub.tool_slug, result=stub.result)
