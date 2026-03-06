import { apiFetch } from "@/lib/api/client";

export type DocumentUploadResponse = {
  document_id: number;
  filename: string;
  mime_type: string;
  size_bytes: number;
  created_at: string;
};

export type DocumentListItem = {
  document_id: number;
  filename: string;
  created_at: string;
};

export type DocumentListResponse = {
  items: DocumentListItem[];
  total: number;
  limit: number;
  offset: number;
};

export type ListDocumentsParams = {
  limit?: number;
  offset?: number;
  q?: string;
};

export async function listDocuments(params: ListDocumentsParams = {}): Promise<DocumentListResponse> {
  const searchParams: Record<string, string> = {};
  if (params.limit != null) searchParams.limit = String(params.limit);
  if (params.offset != null) searchParams.offset = String(params.offset);
  if (params.q) searchParams.q = params.q;
  return apiFetch<DocumentListResponse>("/api/v1/documents", { params: searchParams });
}

export async function uploadDocument(file: File, signal?: AbortSignal): Promise<DocumentUploadResponse> {
  const form = new FormData();
  form.append("file", file);
  return apiFetch<DocumentUploadResponse>("/api/v1/documents/upload", {
    method: "POST",
    body: form,
    signal,
  });
}
