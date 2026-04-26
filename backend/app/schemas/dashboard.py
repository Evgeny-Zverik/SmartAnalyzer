from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel


class DashboardCounts(BaseModel):
    documents: int
    analyses: int
    folders: int
    analyses_7d: int
    analyses_30d: int


class DashboardRecentAnalysis(BaseModel):
    analysis_id: int
    tool_slug: str
    status: str
    document_id: int
    filename: str
    created_at: datetime


class DashboardRecentDocument(BaseModel):
    document_id: int
    filename: str
    mime_type: str
    size_bytes: int
    created_at: datetime
    has_analysis: bool


class DashboardActivityPoint(BaseModel):
    date: str
    count: int


class DashboardToolBreakdown(BaseModel):
    tool_slug: str
    count: int


class DashboardLedgerEntry(BaseModel):
    id: int
    amount: int
    balance_after: int
    reason: str
    reference: str | None
    created_at: datetime


class DashboardSummaryResponse(BaseModel):
    plan: str
    credit_balance: int
    credits_spent_today: int
    credits_spent_7d: int
    counts: DashboardCounts
    recent_analyses: list[DashboardRecentAnalysis]
    pending_documents: list[DashboardRecentDocument]
    activity_30d: list[DashboardActivityPoint]
    tool_breakdown: list[DashboardToolBreakdown]
    recent_ledger: list[DashboardLedgerEntry]
