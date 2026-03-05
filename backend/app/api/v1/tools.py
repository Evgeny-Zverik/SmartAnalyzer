from fastapi import APIRouter, Depends

from app.core.security import get_current_user
from app.models.user import User
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
):
    return _stub_document_analyzer(analysis_id=1)


@router.post("/contract-checker/run", response_model=ContractCheckerRunResponse)
def run_contract_checker(
    body: ToolRunRequest,
    current_user: User = Depends(get_current_user),
):
    return _stub_contract_checker(analysis_id=1)


@router.post("/data-extractor/run", response_model=DataExtractorRunResponse)
def run_data_extractor(
    body: ToolRunRequest,
    current_user: User = Depends(get_current_user),
):
    return _stub_data_extractor(analysis_id=1)


@router.post("/tender-analyzer/run", response_model=TenderAnalyzerRunResponse)
def run_tender_analyzer(
    body: ToolRunRequest,
    current_user: User = Depends(get_current_user),
):
    return _stub_tender_analyzer(analysis_id=1)


@router.post("/risk-analyzer/run", response_model=RiskAnalyzerRunResponse)
def run_risk_analyzer(
    body: ToolRunRequest,
    current_user: User = Depends(get_current_user),
):
    return _stub_risk_analyzer(analysis_id=1)
