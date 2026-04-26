from __future__ import annotations

import asyncio
import threading
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session

from app.core.logging import logger
from app.core.security import get_current_user
from app.db.session import get_db
from app.features.service import get_resolved_feature_state_for_plugin, get_resolved_plugin_feature_states
from app.models.document import Document
from app.models.plugin_execution import PluginExecution
from app.models.user import User
from app.models.workspace_enabled_plugin import WorkspaceEnabledPlugin
from app.plugins.base import CancelledException, PluginRunContext
from app.plugins.helpers import detect_document_input_type, plan_satisfies
from app.plugins.registry import get_registered_plugin, list_registered_plugins
from app.schemas.plugins import (
    BatchRunPluginRequest,
    BatchRunPluginResponse,
    BatchRunPluginResponseItem,
    PluginAvailabilityItem,
    PluginExecutionResponse,
    RunPluginRequest,
    RunPluginResponse,
    TogglePluginRequest,
    TogglePluginResponse,
    WorkspacePluginItem,
    WorkspacePluginResultsResponse,
)
from app.services.folders import ensure_user_system_folders
from app.services.usage import assert_can_run, log_run
from app.utils.errors import raise_error

router = APIRouter()


def _get_document_for_user(db: Session, document_id: int, user_id: int) -> Document:
    doc = db.query(Document).filter(Document.id == document_id, Document.user_id == user_id).first()
    if not doc:
        raise_error(404, "NOT_FOUND", "Document not found", {"document_id": document_id})
    return doc


def _build_workspace_item(
    plugin,
    user: User,
    doc: Document,
    enabled_rows: dict[str, WorkspaceEnabledPlugin],
    execution_rows: dict[str, PluginExecution],
) -> WorkspacePluginItem:
    input_type = detect_document_input_type(doc)
    compatible = input_type in plugin.manifest.supported_inputs
    locked = compatible and not plan_satisfies(user.plan, plugin.manifest.required_plan)
    enabled = enabled_rows.get(plugin.manifest.id).is_enabled if plugin.manifest.id in enabled_rows else plugin.manifest.auto_enable
    execution = execution_rows.get(plugin.manifest.id)
    if not compatible:
        state = "disabled"
    elif locked:
        state = "locked"
    elif execution and execution.status in {"queued", "running", "completed", "partial", "failed"}:
        state = execution.status
    elif enabled:
        state = "enabled"
    else:
        state = "disabled"

    latest_result = None
    if execution and execution.result_json:
        latest_result = execution.result_json
    return WorkspacePluginItem(
        manifest=plugin.manifest,
        compatible=compatible,
        enabled=enabled and compatible and not locked,
        state=state,
        latest_execution_id=execution.id if execution else None,
        latest_result=latest_result,
    )


def _load_workspace_state(db: Session, user_id: int, document_id: int) -> tuple[dict[str, WorkspaceEnabledPlugin], dict[str, PluginExecution]]:
    enabled_rows = {
        row.plugin_id: row
        for row in db.query(WorkspaceEnabledPlugin)
        .filter(
            WorkspaceEnabledPlugin.user_id == user_id,
            WorkspaceEnabledPlugin.workspace_type == "document",
            WorkspaceEnabledPlugin.workspace_entity_id == document_id,
        )
        .all()
    }
    executions = (
        db.query(PluginExecution)
        .filter(PluginExecution.user_id == user_id, PluginExecution.document_id == document_id)
        .order_by(PluginExecution.created_at.desc())
        .all()
    )
    latest_by_plugin: dict[str, PluginExecution] = {}
    for row in executions:
        latest_by_plugin.setdefault(row.plugin_id, row)
    return enabled_rows, latest_by_plugin


@router.get("", response_model=list[PluginAvailabilityItem])
def list_plugins(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    feature_states = get_resolved_plugin_feature_states(db, current_user)
    items: list[PluginAvailabilityItem] = []
    for plugin in list_registered_plugins():
        feature_state = feature_states.get(plugin.manifest.id)
        if feature_state is None:
            continue
        if not feature_state.user_enabled or not feature_state.parent_enabled:
            continue
        items.append(
            PluginAvailabilityItem(
                manifest=plugin.manifest,
                feature_key=feature_state.key,
                parent_feature_key=feature_state.parent_key,
                available_for_plan=feature_state.available_for_plan,
                user_enabled=feature_state.user_enabled,
                effective_enabled=feature_state.effective_enabled,
                blocked_reason=feature_state.blocked_reason,
            )
        )
    return items


@router.get("/executions/{execution_id}", response_model=PluginExecutionResponse)
def get_plugin_execution(
    execution_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    row = (
        db.query(PluginExecution)
        .filter(PluginExecution.id == execution_id, PluginExecution.user_id == current_user.id)
        .first()
    )
    if not row:
        raise_error(404, "NOT_FOUND", "Plugin execution not found", {"execution_id": execution_id})
    return PluginExecutionResponse(
        execution_id=row.id,
        plugin_id=row.plugin_id,
        state=row.status,
        result=row.result_json,
        error=row.error_json,
    )


@router.get("/workspaces/documents/{document_id}/plugins", response_model=list[WorkspacePluginItem])
def get_workspace_plugins(
    document_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    ensure_user_system_folders(db, current_user.id)
    doc = _get_document_for_user(db, document_id, current_user.id)
    enabled_rows, execution_rows = _load_workspace_state(db, current_user.id, doc.id)
    feature_states = get_resolved_plugin_feature_states(db, current_user)
    return [
        _build_workspace_item(plugin, current_user, doc, enabled_rows, execution_rows)
        for plugin in list_registered_plugins()
        if feature_states.get(plugin.manifest.id) is not None
        if feature_states[plugin.manifest.id].user_enabled and feature_states[plugin.manifest.id].parent_enabled
        if detect_document_input_type(doc) in plugin.manifest.supported_inputs
    ]


@router.get("/workspaces/documents/{document_id}/plugin-results", response_model=WorkspacePluginResultsResponse)
def get_workspace_plugin_results(
    document_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    ensure_user_system_folders(db, current_user.id)
    doc = _get_document_for_user(db, document_id, current_user.id)
    enabled_rows, execution_rows = _load_workspace_state(db, current_user.id, doc.id)
    feature_states = get_resolved_plugin_feature_states(db, current_user)
    items = [
        _build_workspace_item(plugin, current_user, doc, enabled_rows, execution_rows)
        for plugin in list_registered_plugins()
        if feature_states.get(plugin.manifest.id) is not None
        if feature_states[plugin.manifest.id].user_enabled and feature_states[plugin.manifest.id].parent_enabled
        if detect_document_input_type(doc) in plugin.manifest.supported_inputs
    ]
    return WorkspacePluginResultsResponse(document_id=doc.id, items=items)


@router.post("/workspaces/documents/{document_id}/plugins/{plugin_id}/toggle", response_model=TogglePluginResponse)
def toggle_workspace_plugin(
    document_id: int,
    plugin_id: str,
    body: TogglePluginRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    ensure_user_system_folders(db, current_user.id)
    doc = _get_document_for_user(db, document_id, current_user.id)
    plugin = get_registered_plugin(plugin_id)
    if not plugin:
        raise_error(404, "NOT_FOUND", "Plugin not found", {"plugin_id": plugin_id})
    input_type = detect_document_input_type(doc)
    if input_type not in plugin.manifest.supported_inputs:
        raise_error(400, "PLUGIN_INCOMPATIBLE", "Plugin is not compatible with this document.", {"plugin_id": plugin_id})
    feature_state = get_resolved_feature_state_for_plugin(db, current_user, plugin_id)
    if feature_state is None or not feature_state.user_enabled or not feature_state.parent_enabled:
        raise_error(403, "FEATURE_DISABLED", "Plugin is disabled in settings.", {"plugin_id": plugin_id})
    locked = not plan_satisfies(current_user.plan, plugin.manifest.required_plan)
    if locked and body.enabled:
        raise_error(403, "PLUGIN_LOCKED", "Plugin requires a higher plan.", {"plugin_id": plugin_id})

    row = (
        db.query(WorkspaceEnabledPlugin)
        .filter(
            WorkspaceEnabledPlugin.user_id == current_user.id,
            WorkspaceEnabledPlugin.workspace_type == "document",
            WorkspaceEnabledPlugin.workspace_entity_id == document_id,
            WorkspaceEnabledPlugin.plugin_id == plugin_id,
        )
        .first()
    )
    if row:
        row.is_enabled = body.enabled
    else:
        row = WorkspaceEnabledPlugin(
            user_id=current_user.id,
            workspace_type="document",
            workspace_entity_id=document_id,
            plugin_id=plugin_id,
            is_enabled=body.enabled,
        )
        db.add(row)
    db.commit()
    return TogglePluginResponse(
        plugin_id=plugin_id,
        enabled=body.enabled,
        state="enabled" if body.enabled else "disabled",
    )


@router.post("/workspaces/documents/{document_id}/plugins/{plugin_id}/run", response_model=RunPluginResponse)
def run_workspace_plugin(
    document_id: int,
    plugin_id: str,
    body: RunPluginRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    ensure_user_system_folders(db, current_user.id)
    doc = _get_document_for_user(db, document_id, current_user.id)
    plugin = get_registered_plugin(plugin_id)
    if not plugin:
        raise_error(404, "NOT_FOUND", "Plugin not found", {"plugin_id": plugin_id})
    input_type = detect_document_input_type(doc)
    if input_type not in plugin.manifest.supported_inputs:
        raise_error(400, "PLUGIN_INCOMPATIBLE", "Plugin is not compatible with this document.", {"plugin_id": plugin_id})
    feature_state = get_resolved_feature_state_for_plugin(db, current_user, plugin_id)
    if feature_state is None or not feature_state.user_enabled or not feature_state.parent_enabled:
        raise_error(403, "FEATURE_DISABLED", "Plugin is disabled in settings.", {"plugin_id": plugin_id})
    if not plan_satisfies(current_user.plan, plugin.manifest.required_plan):
        raise_error(403, "PLUGIN_LOCKED", "Plugin requires a higher plan.", {"plugin_id": plugin_id})

    assert_can_run(db, current_user, plugin_id)

    execution = PluginExecution(
        user_id=current_user.id,
        document_id=document_id,
        plugin_id=plugin.manifest.id,
        plugin_version=plugin.manifest.version,
        status="queued",
    )
    db.add(execution)
    db.commit()
    db.refresh(execution)

    started_at = datetime.now(timezone.utc)
    execution.started_at = started_at
    execution.status = "running"
    db.commit()

    context = PluginRunContext(
        db=db,
        user=current_user,
        document=doc,
        input_type=input_type,
        edited_document=body.edited_document,
    )

    try:
        if not asyncio.run(plugin.can_handle(context)):
            raise_error(400, "PLUGIN_INCOMPATIBLE", "Plugin rejected this workspace input.", {"plugin_id": plugin_id})
        result = asyncio.run(plugin.run(context))
        finished_at = result.finished_at or datetime.now(timezone.utc)
        execution.status = result.status
        execution.finished_at = finished_at
        execution.duration_ms = int((finished_at - started_at).total_seconds() * 1000)
        execution.result_json = result.model_dump(mode="json")
        execution.error_json = None
        db.commit()
        log_run(db, current_user, plugin_id)
        return RunPluginResponse(
            execution_id=execution.id,
            plugin_id=plugin_id,
            state=execution.status,
            result=execution.result_json,
        )
    except Exception as exc:
        finished_at = datetime.now(timezone.utc)
        execution.status = "failed"
        execution.finished_at = finished_at
        execution.duration_ms = int((finished_at - started_at).total_seconds() * 1000)
        execution.error_json = {"code": "PLUGIN_RUN_FAILED", "message": str(exc)}
        db.commit()
        raise


@router.post("/workspaces/documents/{document_id}/plugins/run-all", response_model=BatchRunPluginResponse)
async def run_all_workspace_plugins(
    document_id: int,
    body: BatchRunPluginRequest,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    ensure_user_system_folders(db, current_user.id)
    doc = _get_document_for_user(db, document_id, current_user.id)
    input_type = detect_document_input_type(doc)
    enabled_rows, execution_rows = _load_workspace_state(db, current_user.id, doc.id)
    feature_states = get_resolved_plugin_feature_states(db, current_user)

    plugins_to_run = []
    for plugin in list_registered_plugins():
        feature_state = feature_states.get(plugin.manifest.id)
        if feature_state is None:
            continue
        if not feature_state.user_enabled or not feature_state.parent_enabled:
            continue
        if input_type not in plugin.manifest.supported_inputs:
            continue
        if not plan_satisfies(current_user.plan, plugin.manifest.required_plan):
            continue
        if body.plugin_ids:
            if plugin.manifest.id not in body.plugin_ids:
                continue
        else:
            enabled = enabled_rows.get(plugin.manifest.id)
            if enabled and not enabled.is_enabled:
                continue
            if not enabled and not plugin.manifest.auto_enable:
                continue
        plugins_to_run.append(plugin)

    cancelled = threading.Event()

    shared_context = PluginRunContext(
        db=db,
        user=current_user,
        document=doc,
        input_type=input_type,
        edited_document=body.edited_document,
        cancelled=cancelled,
    )

    def _run_plugins_sync() -> list[BatchRunPluginResponseItem]:
        items: list[BatchRunPluginResponseItem] = []
        for plugin in plugins_to_run:
            if cancelled.is_set():
                break

            assert_can_run(db, current_user, plugin.manifest.id)

            execution = PluginExecution(
                user_id=current_user.id,
                document_id=document_id,
                plugin_id=plugin.manifest.id,
                plugin_version=plugin.manifest.version,
                status="running",
            )
            db.add(execution)
            db.commit()
            db.refresh(execution)

            started_at = datetime.now(timezone.utc)
            execution.started_at = started_at
            db.commit()

            try:
                if not asyncio.run(plugin.can_handle(shared_context)):
                    execution.status = "failed"
                    execution.finished_at = datetime.now(timezone.utc)
                    execution.error_json = {"code": "PLUGIN_INCOMPATIBLE", "message": "Plugin rejected input."}
                    db.commit()
                    items.append(BatchRunPluginResponseItem(
                        execution_id=execution.id, plugin_id=plugin.manifest.id,
                        state="failed", error=execution.error_json,
                    ))
                    continue

                result = asyncio.run(plugin.run(shared_context))
                finished_at = result.finished_at or datetime.now(timezone.utc)
                execution.status = result.status
                execution.finished_at = finished_at
                execution.duration_ms = int((finished_at - started_at).total_seconds() * 1000)
                execution.result_json = result.model_dump(mode="json")
                execution.error_json = None
                db.commit()
                log_run(db, current_user, plugin.manifest.id)
                items.append(BatchRunPluginResponseItem(
                    execution_id=execution.id, plugin_id=plugin.manifest.id,
                    state=execution.status, result=execution.result_json,
                ))
            except CancelledException:
                finished_at = datetime.now(timezone.utc)
                execution.status = "failed"
                execution.finished_at = finished_at
                execution.duration_ms = int((finished_at - started_at).total_seconds() * 1000)
                execution.error_json = {"code": "CANCELLED", "message": "Cancelled by client"}
                db.commit()
                items.append(BatchRunPluginResponseItem(
                    execution_id=execution.id, plugin_id=plugin.manifest.id,
                    state="failed", error=execution.error_json,
                ))
                break
            except Exception as exc:
                finished_at = datetime.now(timezone.utc)
                execution.status = "failed"
                execution.finished_at = finished_at
                execution.duration_ms = int((finished_at - started_at).total_seconds() * 1000)
                execution.error_json = {"code": "PLUGIN_RUN_FAILED", "message": str(exc)}
                db.commit()
                items.append(BatchRunPluginResponseItem(
                    execution_id=execution.id, plugin_id=plugin.manifest.id,
                    state="failed", error=execution.error_json,
                ))
        return items

    async def _poll_disconnect():
        while True:
            await asyncio.sleep(0.5)
            if await request.is_disconnected():
                logger.info("Client disconnected, cancelling plugin run for document %s", document_id)
                cancelled.set()
                return

    loop = asyncio.get_event_loop()
    run_task = loop.run_in_executor(None, _run_plugins_sync)
    poll_task = asyncio.ensure_future(_poll_disconnect())

    try:
        items = await run_task
    finally:
        poll_task.cancel()

    return BatchRunPluginResponse(items=items)
