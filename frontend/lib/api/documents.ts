import { apiFetch } from "@/lib/api/client";

export type DocumentUploadResponse = {
  document_id: number;
  folder_id: number | null;
  filename: string;
  mime_type: string;
  size_bytes: number;
  created_at: string;
};

export type UploadDocumentOptions = {
  folderId?: number | null;
  signal?: AbortSignal;
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

export async function uploadDocument(
  file: File,
  options?: UploadDocumentOptions
): Promise<DocumentUploadResponse> {
  const { folderId, signal } = options ?? {};
  const form = new FormData();
  form.append("file", file);
  if (folderId != null) form.append("folder_id", String(folderId));
  return apiFetch<DocumentUploadResponse>("/api/v1/documents/upload", {
    method: "POST",
    body: form,
    signal,
  });
}

export async function moveDocument(documentId: number, folderId: number): Promise<void> {
  return apiFetch(`/api/v1/documents/${documentId}/move`, {
    method: "POST",
    body: JSON.stringify({ folder_id: folderId }),
    headers: { "Content-Type": "application/json" },
  });
}
