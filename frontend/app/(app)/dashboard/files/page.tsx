"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useCallback } from "react";
import { Folders, FileStack, Sparkles, UploadCloud } from "lucide-react";
import { toast } from "sonner";
import { FoldersSidebar } from "@/components/dashboard/FoldersSidebar";
import { FolderContentTable } from "@/components/dashboard/FolderContentTable";
import { CreateFolderDialog } from "@/components/dashboard/CreateFolderDialog";
import { RenameFolderDialog } from "@/components/dashboard/RenameFolderDialog";
import { DeleteFolderConfirm } from "@/components/dashboard/DeleteFolderConfirm";
import { AnalysisModal } from "@/components/analyses/AnalysisModal";
import { AppShellSkeleton, Skeleton } from "@/components/ui/Skeleton";
import { getToken } from "@/lib/auth/token";
import { isUnauthorized } from "@/lib/api/errors";
import { logout as authLogout, me, type User } from "@/lib/api/auth";
import { buildLoginRedirectHref } from "@/lib/auth/redirect";
import { requestReauth } from "@/lib/auth/session";
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
  const selectedFolder = folders.find((f) => f.id === selectedFolderId) ?? null;
  const selectedFolderName = selectedFolder?.name ?? "Папки";
  const selectedFolderTotal = folderContent?.pagination.total ?? 0;
  const creditBalanceLabel = usage ? usage.credit_balance.toLocaleString("ru-RU") : "—";

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
      router.replace(buildLoginRedirectHref());
      return;
    }
    me()
      .then((u) => {
        setUser(u);
        return getUsageStatus().then(setUsage).catch(() => setUsage(null));
      })
      .then(loadFolders)
      .catch((err) => {
        if (isUnauthorized(err)) {
          authLogout();
          requestReauth({ reason: "dashboard" });
          return;
        }
        router.replace(buildLoginRedirectHref());
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
    return <AppShellSkeleton variant="files" />;
  }

  if (!user) return null;

  return (
    <main className="relative min-h-[calc(100vh-104px)] overflow-hidden bg-[linear-gradient(170deg,#f7f8f7,#f3f4f6_45%,#eef2ff)] px-4 py-4 sm:px-6 lg:px-8">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-[-8%] top-[-14%] h-72 w-72 rounded-full bg-emerald-200/35 blur-3xl" />
        <div className="absolute right-[-12%] top-[20%] h-96 w-96 rounded-full bg-sky-200/30 blur-3xl" />
      </div>
      <div className="relative mx-auto flex w-full max-w-[1520px] flex-col gap-4 lg:flex-row lg:gap-6">
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
      <div className="flex min-w-0 flex-1 flex-col gap-4 lg:gap-5">
        <section className="rounded-[30px] border border-zinc-200/90 bg-white/85 px-5 py-5 shadow-[0_20px_70px_rgba(15,23,42,0.1)] backdrop-blur sm:px-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 rounded-full border border-emerald-300 bg-emerald-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-emerald-700">
                <Sparkles className="h-3.5 w-3.5" />
                Аналитический центр
              </div>
              <h1 className="text-3xl font-semibold tracking-[-0.03em] text-zinc-900 sm:text-4xl">
                {selectedFolderName}
              </h1>
              <p className="max-w-3xl text-sm text-zinc-600 sm:text-base">
                Управляйте документами и анализами в одной ленте: загрузка drag-and-drop, быстрый поиск и
                перемещение между папками.
              </p>
            </div>
            <div className="grid w-full max-w-xl grid-cols-1 gap-2 sm:grid-cols-3">
              <div className="rounded-2xl border border-zinc-200 bg-zinc-50/80 px-3 py-3">
                <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">
                  <Folders className="h-3.5 w-3.5" />
                  Папки
                </div>
                <p className="mt-2 text-2xl font-semibold text-zinc-900">{folders.length}</p>
              </div>
              <div className="rounded-2xl border border-zinc-200 bg-zinc-50/80 px-3 py-3">
                <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">
                  <FileStack className="h-3.5 w-3.5" />
                  Элементы
                </div>
                <p className="mt-2 text-2xl font-semibold text-zinc-900">{selectedFolderTotal}</p>
              </div>
              <div className="rounded-2xl border border-zinc-200 bg-zinc-50/80 px-3 py-3">
                <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">
                  <Sparkles className="h-3.5 w-3.5" />
                  Кредиты
                </div>
                <p className="mt-2 text-2xl font-semibold text-zinc-900">{creditBalanceLabel}</p>
              </div>
            </div>
          </div>
        </section>
        <div className="flex-1 overflow-auto">
          <div
            className={`relative rounded-[30px] border-2 border-dashed bg-white/88 p-4 shadow-[0_20px_70px_rgba(15,23,42,0.08)] backdrop-blur transition sm:p-5 ${
              uploadDragging
                ? "border-emerald-400 bg-emerald-50/80 shadow-[0_30px_90px_rgba(16,185,129,0.16)]"
                : "border-zinc-200/90"
            }`}
            onDragOver={(e) => {
              e.preventDefault();
              setUploadDragging(true);
            }}
            onDragLeave={() => setUploadDragging(false)}
            onDrop={handleFileDrop}
          >
            <div className="mb-4 flex flex-col gap-3 rounded-2xl border border-zinc-200 bg-zinc-50/75 p-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-emerald-300 bg-emerald-100/70 text-emerald-700">
                  <UploadCloud className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-zinc-900">Загрузка в выбранную папку</p>
                  <p className="text-xs text-zinc-600">
                    Перетащите сюда файл (`.pdf`, `.docx`, `.xlsx`) или строку таблицы на папку слева для перемещения.
                  </p>
                </div>
              </div>
              <div className="inline-flex items-center rounded-full border border-zinc-200 bg-white px-3 py-1 text-xs font-medium text-zinc-600">
                {uploading ? "Идёт загрузка…" : "Готово к перетаскиванию"}
              </div>
            </div>
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
                  className="w-full rounded-xl border border-zinc-300 bg-white px-4 py-2.5 text-sm text-zinc-900 shadow-sm outline-none transition placeholder:text-zinc-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200"
                />
              </div>
            )}
            {contentLoading ? (
              <div className="space-y-3 rounded-2xl border border-zinc-200 bg-white p-4">
                {Array.from({ length: 6 }).map((_, index) => (
                  <Skeleton key={index} className="h-14 w-full rounded-2xl" />
                ))}
              </div>
            ) : selectedFolderId == null ? (
              <div className="rounded-2xl border border-zinc-200 bg-white py-14 text-center text-zinc-500">
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
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-[28px] bg-white/85 text-lg font-semibold text-emerald-700">
                Отпустите файл для загрузки
              </div>
            )}
          </div>
        </div>
      </div>
      </div>
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
