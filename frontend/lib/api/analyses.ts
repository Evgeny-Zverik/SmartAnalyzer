import { apiFetch } from "@/lib/api/client";

export type AnalysisListItem = {
  analysis_id: number;
  tool_slug: string;
  document_id: number;
  filename: string;
  created_at: string;
};

export type AnalysisListResponse = {
  items: AnalysisListItem[];
  total: number;
  limit: number;
  offset: number;
};

export type AnalysisDetail = {
  analysis_id: number;
  tool_slug: string;
  document: { document_id: number; filename: string };
  created_at: string;
  result: Record<string, unknown>;
};

export type ListAnalysesParams = {
  limit?: number;
  offset?: number;
  toolSlug?: string;
  q?: string;
};

export async function listAnalyses(params: ListAnalysesParams = {}): Promise<AnalysisListResponse> {
  const searchParams: Record<string, string> = {};
  if (params.limit != null) searchParams.limit = String(params.limit);
  if (params.offset != null) searchParams.offset = String(params.offset);
  if (params.toolSlug) searchParams.tool_slug = params.toolSlug;
  if (params.q) searchParams.q = params.q;
  return apiFetch<AnalysisListResponse>("/api/v1/analyses", { params: searchParams });
}

export async function getAnalysis(id: number): Promise<AnalysisDetail> {
  return apiFetch<AnalysisDetail>(`/api/v1/analyses/${id}`);
}

export type AnalysisRecentItem = {
  analysis_id: number;
  tool_slug: string;
  filename: string;
  created_at: string;
};

export async function getRecentAnalyses(limit = 20): Promise<AnalysisRecentItem[]> {
  return apiFetch<AnalysisRecentItem[]>("/api/v1/analyses/recent", {
    params: { limit: String(limit) },
  });
}
