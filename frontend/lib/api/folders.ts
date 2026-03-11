import { apiFetch } from "@/lib/api/client";

export type FolderListItem = {
  id: number;
  name: string;
  type: "system" | "user";
  system_key: string | null;
  item_count: number;
  created_at: string;
};

export type FolderListResponse = {
  items: FolderListItem[];
};

export type FolderItem = {
  id: number;
  entity_type: "document" | "analysis";
  title: string;
  tool_slug?: string;
  status: string;
  created_at: string;
  document_id?: number;
  mime_type?: string;
  size_bytes?: number;
  folder_id?: number;
};

export type FolderItemsPagination = {
  page: number;
  page_size: number;
  total: number;
};

export type FolderItemsResponse = {
  items: FolderItem[];
  pagination: FolderItemsPagination;
};

export type ListFolderItemsParams = {
  q?: string;
  type?: "document" | "analysis";
  status?: string;
  page?: number;
  page_size?: number;
};

export async function listFolders(): Promise<FolderListResponse> {
  return apiFetch<FolderListResponse>("/api/v1/folders");
}

export async function createFolder(name: string): Promise<{ id: number; name: string; type: string; system_key: string | null; created_at: string }> {
  return apiFetch("/api/v1/folders", {
    method: "POST",
    body: JSON.stringify({ name }),
    headers: { "Content-Type": "application/json" },
  });
}

export async function updateFolder(id: number, name: string): Promise<{ id: number; name: string; type: string; system_key: string | null; created_at: string }> {
  return apiFetch(`/api/v1/folders/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ name }),
    headers: { "Content-Type": "application/json" },
  });
}

export async function deleteFolder(id: number): Promise<void> {
  return apiFetch(`/api/v1/folders/${id}`, { method: "DELETE" });
}

export async function listFolderItems(
  folderId: number,
  params: ListFolderItemsParams = {}
): Promise<FolderItemsResponse> {
  const searchParams: Record<string, string> = {};
  if (params.q) searchParams.q = params.q;
  if (params.type) searchParams.type = params.type;
  if (params.status) searchParams.status = params.status;
  if (params.page != null) searchParams.page = String(params.page);
  if (params.page_size != null) searchParams.page_size = String(params.page_size);
  return apiFetch<FolderItemsResponse>(`/api/v1/folders/${folderId}/items`, {
    params: searchParams,
  });
}
