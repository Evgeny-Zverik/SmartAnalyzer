import { apiFetch } from "@/lib/api/client";

export type DashboardCounts = {
  documents: number;
  analyses: number;
  folders: number;
  analyses_7d: number;
  analyses_30d: number;
};

export type DashboardRecentAnalysis = {
  analysis_id: number;
  tool_slug: string;
  status: string;
  document_id: number;
  filename: string;
  created_at: string;
};

export type DashboardRecentDocument = {
  document_id: number;
  filename: string;
  mime_type: string;
  size_bytes: number;
  created_at: string;
  has_analysis: boolean;
};

export type DashboardActivityPoint = {
  date: string;
  count: number;
};

export type DashboardToolBreakdown = {
  tool_slug: string;
  count: number;
};

export type DashboardLedgerEntry = {
  id: number;
  amount: number;
  balance_after: number;
  reason: string;
  reference: string | null;
  created_at: string;
};

export type DashboardSummary = {
  plan: string;
  credit_balance: number;
  credits_spent_today: number;
  credits_spent_7d: number;
  counts: DashboardCounts;
  recent_analyses: DashboardRecentAnalysis[];
  pending_documents: DashboardRecentDocument[];
  activity_30d: DashboardActivityPoint[];
  tool_breakdown: DashboardToolBreakdown[];
  recent_ledger: DashboardLedgerEntry[];
};

export async function getDashboardSummary(): Promise<DashboardSummary> {
  return apiFetch<DashboardSummary>("/api/v1/dashboard/summary");
}
