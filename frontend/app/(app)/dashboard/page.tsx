"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import { FoldersSidebar } from "@/components/dashboard/FoldersSidebar";
import { FolderContentTable } from "@/components/dashboard/FolderContentTable";
import { CreateFolderDialog } from "@/components/dashboard/CreateFolderDialog";
import { RenameFolderDialog } from "@/components/dashboard/RenameFolderDialog";
import { DeleteFolderConfirm } from "@/components/dashboard/DeleteFolderConfirm";
import { AnalysisModal } from "@/components/analyses/AnalysisModal";
import { getToken } from "@/lib/auth/token";
import { isUnauthorized } from "@/lib/api/errors";
import { logout as authLogout, me, type User } from "@/lib/api/auth";
import { getUsageStatus, type UsageStatus } from "@/lib/api/usage";
import {
  listFolders,
  listFolderItems,
  createFolder,
  updateFolder,
  deleteFolder,
  type FolderListItem,
  type FolderItemsResponse,
} from "@/lib/api/folders";
import { uploadDocument } from "@/lib/api/documents";
import { moveDocument } from "@/lib/api/documents";
import { moveAnalysis } from "@/lib/api/analyses";
import { parseApiError } from "@/lib/api/errors";

const PAGE_SIZE = 20;
const ALLOWED_EXTENSIONS = [".pdf", ".docx", ".xlsx"];

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [usage, setUsage] = useState<UsageStatus | null>(null);
  const [checking, setChecking] = useState(true);
  const [folders, setFolders] = useState<FolderListItem[]>([]);
  const [selectedFolderId, setSelectedFolderId] = useState<number | null>(null);
  const [folderContent, setFolderContent] = useState<FolderItemsResponse | null>(null);
  const [contentLoading, setContentLoading] = useState(false);
  const [contentPage, setContentPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const [renameFolder, setRenameFolder] = useState<FolderListItem | null>(null);
  const [deleteFolderState, setDeleteFolderState] = useState<FolderListItem | null>(null);
  const [dropTargetId, setDropTargetId] = useState<number | null>(null);
  const [uploadDragging, setUploadDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [selectedAnalysisId, setSelectedAnalysisId] = useState<number | null>(null);

  const userFolderIds = new Set(folders.filter((f) => f.type === "user").map((f) => f.id));

  const loadFolders = useCallback(async () => {
    const data = await listFolders();
    setFolders(data.items);
    if (selectedFolderId == null && data.items.length > 0) {
      setSelectedFolderId(data.items[0].id);
    }
  }, [selectedFolderId]);

  const loadFolderContent = useCallback(async () => {
    if (selectedFolderId == null) {
      setFolderContent(null);
      return;
    }
    setContentLoading(true);
    try {
      const data = await listFolderItems(selectedFolderId, {
        page: contentPage,
        page_size: PAGE_SIZE,
        q: searchQuery || undefined,
      });
      setFolderContent(data);
    } catch {
      setFolderContent({ items: [], pagination: { page: 1, page_size: PAGE_SIZE, total: 0 } });
    } finally {
      setContentLoading(false);
    }
  }, [selectedFolderId, contentPage, searchQuery]);

  useEffect(() => {
    const token = getToken();
    if (!token) {
      router.replace("/login");
      return;
    }
    me()
      .then((u) => {
        setUser(u);
        return getUsageStatus().then(setUsage).catch(() => setUsage(null));
      })
      .then(loadFolders)
      .catch((err) => {
        if (isUnauthorized(err)) authLogout();
        router.replace("/login");
      })
      .finally(() => setChecking(false));
  }, [router, loadFolders]);

  useEffect(() => {
    if (selectedFolderId != null) setContentPage(1);
  }, [selectedFolderId]);

  useEffect(() => {
    if (!user) return;
    loadFolderContent();
  }, [user, loadFolderContent]);

  function handleToast(message: string, type: "success" | "error") {
    if (type === "success") toast.success(message);
    else toast.error(message);
  }

  function handleCreateFolder(name: string) {
    return createFolder(name).then(loadFolders);
  }

  function handleRenameFolder(folderId: number, name: string) {
    return updateFolder(folderId, name).then(() => {
      loadFolders();
      if (renameFolder?.id === folderId) setRenameFolder((f) => (f ? { ...f, name } : null));
    });
  }

  function handleDeleteFolder(folderId: number) {
    return deleteFolder(folderId).then(() => {
      loadFolders();
      if (selectedFolderId === folderId) {
        const rest = folders.filter((f) => f.id !== folderId);
        setSelectedFolderId(rest.length ? rest[0].id : null);
      }
      setDeleteFolderState(null);
    });
  }

  function handleDropOnFolder(folderId: number, payload: { type: "document" | "analysis"; id: number }) {
    const run = payload.type === "document" ? moveDocument(payload.id, folderId) : moveAnalysis(payload.id, folderId);
    run
      .then(() => {
        handleToast("Элемент перемещён", "success");
        loadFolderContent();
        loadFolders();
      })
      .catch((err) => handleToast(parseApiError(err).message, "error"));
  }

  function handleFileDrop(e: React.DragEvent) {
    e.preventDefault();
    setUploadDragging(false);
    if (!selectedFolderId || uploading) return;
    const file = e.dataTransfer.files[0];
    if (!file) return;
    const ext = file.name.slice(file.name.lastIndexOf(".")).toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      handleToast(`Формат не поддерживается. Разрешены: ${ALLOWED_EXTENSIONS.join(", ")}`, "error");
      return;
    }
    setUploading(true);
    const folderId = folders.find((f) => f.id === selectedFolderId)?.type === "user" ? selectedFolderId : undefined;
    uploadDocument(file, { folderId })
      .then(() => {
        handleToast("Файл загружен", "success");
        loadFolderContent();
        loadFolders();
      })
      .catch((err) => handleToast(parseApiError(err).message, "error"))
      .finally(() => setUploading(false));
  }

  if (checking) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-50 p-8">
        <p className="text-gray-500">Загрузка…</p>
      </main>
    );
  }

  if (!user) return null;

  return (
    <main className="flex min-h-[calc(100vh-73px)] bg-gray-50">
      <FoldersSidebar
        folders={folders}
        selectedFolderId={selectedFolderId}
        onSelectFolder={setSelectedFolderId}
        onCreateFolder={() => setCreateDialogOpen(true)}
        onRenameFolder={(folder) => {
          setRenameFolder(folder);
          setRenameDialogOpen(true);
        }}
        onDeleteFolder={setDeleteFolderState}
        isDropTargetId={dropTargetId}
        onDropTargetChange={setDropTargetId}
        canDropOnFolderIds={userFolderIds}
        onDropOnFolder={handleDropOnFolder}
      />
      <div className="flex flex-1 flex-col overflow-hidden">
        <div className="flex-1 overflow-auto p-4">
          <h1 className="mb-2 text-2xl font-bold text-gray-900">
            {folders.find((f) => f.id === selectedFolderId)?.name ?? "Папки"}
          </h1>
          <p className="mb-4 text-gray-600">
            Выберите папку слева. Перетащите файл сюда для загрузки или строку — на папку для перемещения.
          </p>
          <div
            className={`relative rounded-lg border-2 border-dashed transition-colors ${
              uploadDragging ? "border-emerald-500 bg-emerald-50/50" : "border-transparent"
            }`}
            onDragOver={(e) => {
              e.preventDefault();
              setUploadDragging(true);
            }}
            onDragLeave={() => setUploadDragging(false)}
            onDrop={handleFileDrop}
          >
            {selectedFolderId != null && (
              <div className="mb-4 flex gap-2">
                <input
                  type="search"
                  placeholder="Поиск в папке…"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setContentPage(1);
                  }}
                  className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>
            )}
            {contentLoading ? (
              <p className="py-8 text-center text-gray-500">Загрузка…</p>
            ) : selectedFolderId == null ? (
              <div className="rounded-lg border border-gray-200 bg-white py-12 text-center text-gray-500">
                Выберите папку в списке слева
              </div>
            ) : folderContent ? (
              <FolderContentTable
                items={folderContent.items}
                pagination={folderContent.pagination}
                userFolderIds={userFolderIds}
                onPageChange={setContentPage}
                onRefresh={loadFolderContent}
                onViewAnalysis={setSelectedAnalysisId}
                onToast={handleToast}
              />
            ) : null}
            {uploadDragging && (
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-lg bg-white/80 text-lg font-medium text-emerald-700">
                Отпустите файл для загрузки
              </div>
            )}
          </div>
        </div>
      </div>
      <section className="mb-8 hidden">
        <h2 className="mb-2 text-lg font-semibold text-gray-900">План</h2>
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-sm font-medium text-gray-800">
            {usage ? (usage.plan === "pro" ? "Pro" : "Free") : "—"}
          </span>
        </div>
      </section>
      <CreateFolderDialog
        open={createDialogOpen}
        onClose={() => setCreateDialogOpen(false)}
        onCreate={handleCreateFolder}
      />
      <RenameFolderDialog
        open={renameDialogOpen}
        folderId={renameFolder?.id ?? null}
        currentName={renameFolder?.name ?? ""}
        onClose={() => {
          setRenameDialogOpen(false);
          setRenameFolder(null);
        }}
        onRename={handleRenameFolder}
      />
      <DeleteFolderConfirm
        open={deleteFolderState != null}
        folder={deleteFolderState}
        onClose={() => setDeleteFolderState(null)}
        onConfirm={handleDeleteFolder}
      />
      <AnalysisModal analysisId={selectedAnalysisId} onClose={() => setSelectedAnalysisId(null)} />
    </main>
  );
}
