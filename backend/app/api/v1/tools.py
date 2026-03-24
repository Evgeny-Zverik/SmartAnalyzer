import json

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from pydantic import ValidationError
from sqlalchemy.orm import Session

from app.core.security import get_current_user
from app.db.session import get_db
from app.features.document_analyzer_anonymization import anonymize_text_for_llm
from app.features.document_analyzer_encryption import encode_document_analysis_result
from app.features.service import get_resolved_feature_state
from app.models.document import Document
from app.models.document_analysis import DocumentAnalysis
from app.models.user import User
from app.services.folders import ensure_user_system_folders, resolve_analysis_folder
from app.services.ocr import recognize_handwriting
from app.services.case_law_search import build_case_law_stub_result, search_case_law
from app.services.usage import assert_can_run, log_run
from app.services.text_extraction import extract_advanced_editor_payload, extract_text, extract_tables_from_xlsx
from app.services.llm_client import (
    analyze_document_fast,
    check_spelling,
    check_contract,
    compare_documents_detailed,
    extract_structured_data,
    simplify_legal_text,
    stream_document_analysis_events,
)
from app.utils.errors import raise_error
from app.utils.errors import ApiError
from app.schemas.tools import (
    ChecklistItem,
    ContractCheckerRunResponse,
    ContractCheckerResult,
    DataExtractorRunResponse,
    DataExtractorResult,
    DateItem,
    DocumentAdvancedEditorResult,
    DocumentAnnotationItem,
    DocumentAnalyzerRunResponse,
    DocumentAnalyzerPrepareResponse,
    DocumentAnalyzerResult,
    FieldItem,
    HandwritingRecognitionRunResponse,
    HandwritingRecognitionResult,
    LegalTextSimplifierRunResponse,
    LegalTextSimplifierResult,
    ObligationItem,
    PenaltyItem,
    RecommendationItem,
    RiskAnalyzerRunResponse,
    RiskAnalyzerResult,
    RiskDriverItem,
    RiskItem,
    RiskyClauseItem,
    TableItem,
    TenderAnalyzerChatRequest,
    TenderAnalyzerChatResponse,
    TenderAnalyzerRunResponse,
    TenderAnalyzerResult,
    SpellingCheckerRunResponse,
    SpellingCheckerResult,
    ToolRunRequest,
)

router = APIRouter()


def _assert_feature_enabled(db: Session, user: User, feature_key: str) -> None:
    state = get_resolved_feature_state(db, user, feature_key)
    if state is None or not state.effective_enabled:
        raise_error(403, "FEATURE_DISABLED", "Feature is disabled in settings.", {"feature_key": feature_key})


def _get_document_for_user(db: Session, document_id: int, user_id: int) -> Document:
    doc = db.query(Document).filter(Document.id == document_id, Document.user_id == user_id).first()
    if not doc:
        raise_error(404, "NOT_FOUND", "Document not found", {"document_id": document_id})
    return doc


def _encrypt_result(result: dict, db: Session, user: User) -> dict:
    """Wrap analysis result in the encryption envelope managed by the feature module."""
    raw = json.dumps(result, ensure_ascii=False)
    return encode_document_analysis_result(db=db, user=user, raw_json=raw)


def _save_analysis(
    db: Session,
    user: User,
    user_id: int,
    document_id: int,
    tool_slug: str,
    result: dict,
    folder_id: int | None,
    status: str = "completed",
) -> int:
    row = DocumentAnalysis(
        user_id=user_id,
        document_id=document_id,
        folder_id=folder_id,
        tool_slug=tool_slug,
        status=status,
        result_json=_encrypt_result(result, db, user),
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
            advanced_editor=DocumentAdvancedEditorResult(
                full_text="Stub document text.",
                annotations=[
                    DocumentAnnotationItem(
                        id="ann-1",
                        type="risk",
                        severity="medium",
                        start_offset=0,
                        end_offset=4,
                        exact_quote="Stub",
                        title="Stub annotation",
                        reason="Stub reason",
                        suggested_rewrite="Stub rewrite",
                    )
                ],
            ),
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
            summary="Документы описывают один и тот же предмет, но расходятся по срокам, объему и распределению ответственности.",
            left_document_summary="Документ A фиксирует исходные условия сделки и базовые обязанности сторон.",
            right_document_summary="Документ B описывает альтернативную версию условий с уточненными сроками и иным распределением рисков.",
            common_points=["Оба документа посвящены одному процессу.", "Оба содержат обязательства сторон."],
            differences=["Изменены сроки исполнения.", "Перераспределена ответственность сторон."],
            relation_assessment="Документы связаны между собой и выглядят как разные версии одного договорного набора.",
            are_documents_related=True,
        ),
    )


def _stub_tender_analyzer(analysis_id: int) -> TenderAnalyzerRunResponse:
    return TenderAnalyzerRunResponse(
        analysis_id=analysis_id,
        tool_slug="tender-analyzer",
        result=build_case_law_stub_result("практика по коммерческому спору Москва и Санкт-Петербург"),
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


@router.post("/document-analyzer/prepare", response_model=DocumentAnalyzerPrepareResponse)
def prepare_document_analyzer(
    body: ToolRunRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _assert_feature_enabled(db, current_user, "document_analyzer")
    ensure_user_system_folders(db, current_user.id)
    doc = _get_document_for_user(db, body.document_id, current_user.id)
    editor_payload = extract_advanced_editor_payload(doc.storage_path, doc.mime_type)
    return DocumentAnalyzerPrepareResponse(
        document_id=doc.id,
        tool_slug="document-analyzer",
        advanced_editor=DocumentAdvancedEditorResult(
            full_text=editor_payload["full_text"],
            annotations=[],
            rich_content=editor_payload.get("rich_content"),
            source_format=editor_payload.get("source_format"),
        ),
    )


@router.post("/document-analyzer/run", response_model=DocumentAnalyzerRunResponse)
def run_document_analyzer(
    body: ToolRunRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _assert_feature_enabled(db, current_user, "document_analyzer")
    ensure_user_system_folders(db, current_user.id)
    assert_can_run(db, current_user, "document-analyzer")
    doc = _get_document_for_user(db, body.document_id, current_user.id)
    if body.edited_document and body.edited_document.full_text.strip():
        editor_payload = {
            "full_text": body.edited_document.full_text,
            "rich_content": body.edited_document.rich_content,
            "source_format": body.edited_document.source_format or "edited_document",
        }
    else:
        editor_payload = extract_advanced_editor_payload(doc.storage_path, doc.mime_type)
    text = anonymize_text_for_llm(db=db, user=current_user, text=editor_payload["full_text"])
    overrides = body.llm_config.model_dump(exclude_none=True) if body.llm_config else None
    raw_result = analyze_document_fast(text, overrides=overrides)
    raw_advanced = raw_result.get("advanced_editor") if isinstance(raw_result, dict) else None
    if isinstance(raw_advanced, dict):
        raw_advanced["rich_content"] = editor_payload.get("rich_content")
        raw_advanced["source_format"] = editor_payload.get("source_format")
    try:
        result = DocumentAnalyzerResult.model_validate(raw_result)
    except ValidationError:
        raise_error(500, "LLM_ERROR", "Analysis result format invalid. Try again.", {})
    folder = resolve_analysis_folder(
        db,
        current_user.id,
        body.folder_id,
        tool_slug="document-analyzer",
        fallback_folder_id=doc.folder_id,
    )
    analysis_id = _save_analysis(
        db,
        current_user,
        current_user.id,
        body.document_id,
        "document-analyzer",
        result.model_dump(),
        folder.id,
    )
    log_run(db, current_user.id, "document-analyzer")
    return DocumentAnalyzerRunResponse(analysis_id=analysis_id, tool_slug="document-analyzer", result=result)


@router.post("/document-analyzer/stream")
def stream_document_analyzer(
    body: ToolRunRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _assert_feature_enabled(db, current_user, "document_analyzer")
    ensure_user_system_folders(db, current_user.id)
    assert_can_run(db, current_user, "document-analyzer")
    doc = _get_document_for_user(db, body.document_id, current_user.id)
    if body.edited_document and body.edited_document.full_text.strip():
        editor_payload = {
            "full_text": body.edited_document.full_text,
            "rich_content": body.edited_document.rich_content,
            "source_format": body.edited_document.source_format or "edited_document",
        }
    else:
        editor_payload = extract_advanced_editor_payload(doc.storage_path, doc.mime_type)
    text = anonymize_text_for_llm(db=db, user=current_user, text=editor_payload["full_text"])
    overrides = body.llm_config.model_dump(exclude_none=True) if body.llm_config else None
    folder = resolve_analysis_folder(
        db,
        current_user.id,
        body.folder_id,
        tool_slug="document-analyzer",
        fallback_folder_id=doc.folder_id,
    )

    def event_stream():
        final_result: DocumentAnalyzerResult | None = None
        try:
            for event in stream_document_analysis_events(text, overrides=overrides):
                if event.get("type") == "final":
                    raw_result = event.get("result") or {}
                    raw_advanced = raw_result.get("advanced_editor") if isinstance(raw_result, dict) else None
                    if isinstance(raw_advanced, dict):
                        raw_advanced["rich_content"] = editor_payload.get("rich_content")
                        raw_advanced["source_format"] = editor_payload.get("source_format")
                    final_result = DocumentAnalyzerResult.model_validate(raw_result)
                    analysis_id = _save_analysis(
                        db,
                        current_user,
                        current_user.id,
                        body.document_id,
                        "document-analyzer",
                        final_result.model_dump(),
                        folder.id,
                    )
                    log_run(db, current_user.id, "document-analyzer")
                    payload = {
                        "type": "final",
                        "analysis_id": analysis_id,
                        "tool_slug": "document-analyzer",
                        "result": final_result.model_dump(),
                    }
                    yield f"data: {json.dumps(payload, ensure_ascii=False)}\n\n"
                    continue
                yield f"data: {json.dumps(event, ensure_ascii=False)}\n\n"
        except Exception as e:
            message = str(e)
            if isinstance(e, ApiError):
                message = e.message
            elif not message:
                message = "Streaming analysis failed."
            payload = {"type": "error", "message": message}
            yield f"data: {json.dumps(payload, ensure_ascii=False)}\n\n"

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.post("/contract-checker/run", response_model=ContractCheckerRunResponse)
def run_contract_checker(
    body: ToolRunRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _assert_feature_enabled(db, current_user, "contract_checker")
    ensure_user_system_folders(db, current_user.id)
    assert_can_run(db, current_user, "contract-checker")
    doc = _get_document_for_user(db, body.document_id, current_user.id)
    text = extract_text(doc.storage_path, doc.mime_type)
    overrides = body.llm_config.model_dump(exclude_none=True) if body.llm_config else None
    raw_result = check_contract(text, overrides=overrides)
    try:
        result = ContractCheckerResult.model_validate(raw_result)
    except ValidationError:
        raise_error(500, "LLM_INVALID_RESPONSE", "Contract analysis result format invalid. Try again.", {})
    folder = resolve_analysis_folder(
        db,
        current_user.id,
        body.folder_id,
        tool_slug="contract-checker",
        fallback_folder_id=doc.folder_id,
    )
    analysis_id = _save_analysis(
        db,
        current_user,
        current_user.id,
        body.document_id,
        "contract-checker",
        result.model_dump(),
        folder.id,
    )
    log_run(db, current_user.id, "contract-checker")
    return ContractCheckerRunResponse(analysis_id=analysis_id, tool_slug="contract-checker", result=result)


@router.post("/data-extractor/run", response_model=DataExtractorRunResponse)
def run_data_extractor(
    body: ToolRunRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _assert_feature_enabled(db, current_user, "data_extractor")
    ensure_user_system_folders(db, current_user.id)
    assert_can_run(db, current_user, "data-extractor")
    doc = _get_document_for_user(db, body.document_id, current_user.id)
    compare_doc_id = body.compare_document_id
    if compare_doc_id is None:
        raise_error(400, "BAD_REQUEST", "Second document is required for comparison.", {"compare_document_id": None})
    compare_doc = _get_document_for_user(db, compare_doc_id, current_user.id)
    left_text = extract_text(doc.storage_path, doc.mime_type)
    right_text = extract_text(compare_doc.storage_path, compare_doc.mime_type)
    overrides = body.llm_config.model_dump(exclude_none=True) if body.llm_config else None
    raw_result = compare_documents_detailed(left_text, right_text, overrides=overrides)
    try:
        result = DataExtractorResult.model_validate(raw_result)
    except ValidationError:
        raise_error(500, "LLM_INVALID_RESPONSE", "Document comparison result format invalid. Try again.", {})
    folder = resolve_analysis_folder(
        db,
        current_user.id,
        body.folder_id,
        tool_slug="data-extractor",
        fallback_folder_id=doc.folder_id,
    )
    analysis_id = _save_analysis(
        db,
        current_user,
        current_user.id,
        body.document_id,
        "data-extractor",
        result.model_dump(),
        folder.id,
    )
    log_run(db, current_user.id, "data-extractor")
    return DataExtractorRunResponse(analysis_id=analysis_id, tool_slug="data-extractor", result=result)


@router.post("/handwriting-recognition/run", response_model=HandwritingRecognitionRunResponse)
def run_handwriting_recognition(
    body: ToolRunRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _assert_feature_enabled(db, current_user, "handwriting_recognition")
    ensure_user_system_folders(db, current_user.id)
    assert_can_run(db, current_user, "handwriting-recognition")
    doc = _get_document_for_user(db, body.document_id, current_user.id)
    raw_result = recognize_handwriting(doc.storage_path, doc.mime_type)
    try:
        result = HandwritingRecognitionResult.model_validate(raw_result)
    except ValidationError:
        raise_error(500, "OCR_INVALID_RESPONSE", "Handwriting recognition result format invalid. Try again.", {})
    folder = resolve_analysis_folder(
        db,
        current_user.id,
        body.folder_id,
        tool_slug="handwriting-recognition",
        fallback_folder_id=doc.folder_id,
    )
    analysis_id = _save_analysis(
        db,
        current_user,
        current_user.id,
        body.document_id,
        "handwriting-recognition",
        result.model_dump(),
        folder.id,
    )
    log_run(db, current_user.id, "handwriting-recognition")
    return HandwritingRecognitionRunResponse(
        analysis_id=analysis_id,
        tool_slug="handwriting-recognition",
        result=result,
    )


@router.post("/legal-text-simplifier/run", response_model=LegalTextSimplifierRunResponse)
def run_legal_text_simplifier(
    body: ToolRunRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _assert_feature_enabled(db, current_user, "legal_text_simplifier")
    ensure_user_system_folders(db, current_user.id)
    assert_can_run(db, current_user, "legal-text-simplifier")
    doc = _get_document_for_user(db, body.document_id, current_user.id)
    text = extract_text(doc.storage_path, doc.mime_type)
    overrides = body.llm_config.model_dump(exclude_none=True) if body.llm_config else None
    raw_result = simplify_legal_text(text, overrides=overrides)
    try:
        result = LegalTextSimplifierResult.model_validate(raw_result)
    except ValidationError:
        raise_error(500, "LLM_INVALID_RESPONSE", "Simplified text result format invalid. Try again.", {})
    folder = resolve_analysis_folder(
        db,
        current_user.id,
        body.folder_id,
        tool_slug="legal-text-simplifier",
        fallback_folder_id=doc.folder_id,
    )
    analysis_id = _save_analysis(
        db,
        current_user,
        current_user.id,
        body.document_id,
        "legal-text-simplifier",
        result.model_dump(),
        folder.id,
    )
    log_run(db, current_user.id, "legal-text-simplifier")
    return LegalTextSimplifierRunResponse(
        analysis_id=analysis_id,
        tool_slug="legal-text-simplifier",
        result=result,
    )


@router.post("/spelling-checker/run", response_model=SpellingCheckerRunResponse)
def run_spelling_checker(
    body: ToolRunRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _assert_feature_enabled(db, current_user, "spelling_checker")
    ensure_user_system_folders(db, current_user.id)
    assert_can_run(db, current_user, "spelling-checker")
    doc = _get_document_for_user(db, body.document_id, current_user.id)
    text = extract_text(doc.storage_path, doc.mime_type)
    overrides = body.llm_config.model_dump(exclude_none=True) if body.llm_config else None
    raw_result = check_spelling(text, overrides=overrides)
    try:
        result = SpellingCheckerResult.model_validate(raw_result)
    except ValidationError:
        raise_error(500, "LLM_INVALID_RESPONSE", "Spelling check result format invalid. Try again.", {})
    folder = resolve_analysis_folder(
        db,
        current_user.id,
        body.folder_id,
        tool_slug="spelling-checker",
        fallback_folder_id=doc.folder_id,
    )
    analysis_id = _save_analysis(
        db,
        current_user,
        current_user.id,
        body.document_id,
        "spelling-checker",
        result.model_dump(),
        folder.id,
    )
    log_run(db, current_user.id, "spelling-checker")
    return SpellingCheckerRunResponse(
        analysis_id=analysis_id,
        tool_slug="spelling-checker",
        result=result,
    )


@router.post("/tender-analyzer/run", response_model=TenderAnalyzerRunResponse)
def run_tender_analyzer(
    body: ToolRunRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _assert_feature_enabled(db, current_user, "tender_analyzer")
    ensure_user_system_folders(db, current_user.id)
    assert_can_run(db, current_user, "tender-analyzer")
    doc = _get_document_for_user(db, body.document_id, current_user.id)
    stub = _stub_tender_analyzer(analysis_id=0)
    folder = resolve_analysis_folder(
        db,
        current_user.id,
        body.folder_id,
        tool_slug="tender-analyzer",
        fallback_folder_id=doc.folder_id,
    )
    analysis_id = _save_analysis(
        db,
        current_user,
        current_user.id,
        body.document_id,
        "tender-analyzer",
        stub.result.model_dump(),
        folder.id,
    )
    log_run(db, current_user.id, "tender-analyzer")
    return TenderAnalyzerRunResponse(analysis_id=analysis_id, tool_slug=stub.tool_slug, result=stub.result)


@router.post("/tender-analyzer/chat", response_model=TenderAnalyzerChatResponse)
def run_tender_analyzer_chat(
    body: TenderAnalyzerChatRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _assert_feature_enabled(db, current_user, "tender_analyzer")
    assert_can_run(db, current_user, "tender-analyzer")
    query = body.query.strip()
    if not query:
        raise_error(400, "BAD_REQUEST", "Query is required.", {"query": ""})
    result = search_case_law(query, allow_related_regions=body.allow_related_regions)
    log_run(db, current_user.id, "tender-analyzer")
    return TenderAnalyzerChatResponse(tool_slug="tender-analyzer", result=result)


@router.post("/risk-analyzer/run", response_model=RiskAnalyzerRunResponse)
def run_risk_analyzer(
    body: ToolRunRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _assert_feature_enabled(db, current_user, "risk_analyzer")
    ensure_user_system_folders(db, current_user.id)
    doc = _get_document_for_user(db, body.document_id, current_user.id)
    stub = _stub_risk_analyzer(analysis_id=0)
    folder = resolve_analysis_folder(
        db,
        current_user.id,
        body.folder_id,
        tool_slug="risk-analyzer",
        fallback_folder_id=doc.folder_id,
    )
    analysis_id = _save_analysis(
        db,
        current_user,
        current_user.id,
        body.document_id,
        "risk-analyzer",
        stub.result.model_dump(),
        folder.id,
    )
    return RiskAnalyzerRunResponse(analysis_id=analysis_id, tool_slug=stub.tool_slug, result=stub.result)
