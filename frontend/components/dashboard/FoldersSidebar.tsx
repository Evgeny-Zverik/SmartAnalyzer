"use client";

import { useState, useCallback } from "react";
import { Folder, FolderOpen, Plus, MoreVertical, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import type { FolderListItem } from "@/lib/api/folders";

type FoldersSidebarProps = {
  folders: FolderListItem[];
  selectedFolderId: number | null;
  onSelectFolder: (id: number) => void;
  onCreateFolder: () => void;
  onRenameFolder: (folder: FolderListItem) => void;
  onDeleteFolder: (folder: FolderListItem) => void;
  isDropTargetId: number | null;
  onDropTargetChange: (id: number | null) => void;
  canDropOnFolderIds: Set<number>;
  onDropOnFolder: (folderId: number, payload: { type: "document" | "analysis"; id: number }) => void;
};

export function FoldersSidebar({
  folders,
  selectedFolderId,
  onSelectFolder,
  onCreateFolder,
  onRenameFolder,
  onDeleteFolder,
  isDropTargetId,
  onDropTargetChange,
  canDropOnFolderIds,
  onDropOnFolder,
}: FoldersSidebarProps) {
  const [menuFolderId, setMenuFolderId] = useState<number | null>(null);

  const systemFolders = folders.filter((f) => f.type === "system");
  const userFolders = folders.filter((f) => f.type === "user");

  const handleDragOver = useCallback(
    (e: React.DragEvent, folderId: number) => {
      if (!canDropOnFolderIds.has(folderId)) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      onDropTargetChange(folderId);
    },
    [canDropOnFolderIds, onDropTargetChange]
  );

  const handleDragLeave = useCallback(
    (e: React.DragEvent, folderId: number) => {
      if (isDropTargetId === folderId) onDropTargetChange(null);
    },
    [isDropTargetId, onDropTargetChange]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent, folderId: number) => {
      e.preventDefault();
      onDropTargetChange(null);
      if (!canDropOnFolderIds.has(folderId)) return;
      const raw = e.dataTransfer.getData("application/x-smartanalyzer-move");
      if (!raw) return;
      try {
        const payload = JSON.parse(raw) as { type: "document" | "analysis"; id: number };
        onDropOnFolder(folderId, payload);
      } catch {
        // ignore invalid payload
      }
    },
    [canDropOnFolderIds, onDropOnFolder, onDropTargetChange]
  );

  const renderFolderRow = (folder: FolderListItem) => {
    const isSelected = selectedFolderId === folder.id;
    const isDropTarget = isDropTargetId === folder.id;
    const canDrop = canDropOnFolderIds.has(folder.id);
    const showMenu = folder.type === "user" && menuFolderId === folder.id;

    return (
      <div
        key={folder.id}
        className="group relative flex items-center gap-2 rounded-2xl p-1 text-sm"
        onDragOver={canDrop ? (e) => handleDragOver(e, folder.id) : undefined}
        onDragLeave={canDrop ? (e) => handleDragLeave(e, folder.id) : undefined}
        onDrop={canDrop ? (e) => handleDrop(e, folder.id) : undefined}
      >
        <button
          type="button"
          onClick={() => onSelectFolder(folder.id)}
          className={`flex min-w-0 flex-1 items-center gap-2 rounded-xl px-2.5 py-2.5 pr-6 text-left transition ${
            isDropTarget ? "bg-emerald-500/20 ring-1 ring-emerald-300/70" : ""
          } ${
            isSelected
              ? "bg-white/14 font-medium text-white shadow-[0_10px_28px_rgba(16,185,129,0.16)]"
              : "text-zinc-300 hover:bg-white/8 hover:text-white"
          }`}
        >
          {isSelected ? (
            <FolderOpen className="h-4 w-4 shrink-0 text-emerald-300" />
          ) : (
            <Folder className="h-4 w-4 shrink-0 text-zinc-500" />
          )}
          <span className="truncate">{folder.name}</span>
          <span className="shrink-0 text-xs text-zinc-500">({folder.item_count})</span>
        </button>
        {folder.type === "user" && (
          <div className="absolute right-1 top-1/2 -translate-y-1/2">
            <button
              type="button"
              className="rounded-lg p-1 text-zinc-500 opacity-0 transition hover:bg-white/10 hover:text-zinc-200 group-hover:opacity-100"
              onClick={(e) => {
                e.stopPropagation();
                setMenuFolderId(showMenu ? null : folder.id);
              }}
              aria-label="Действия"
            >
              <MoreVertical className="h-4 w-4" />
            </button>
            {showMenu && (
              <>
                <div
                  className="fixed inset-0 z-10"
                  aria-hidden
                  onClick={() => setMenuFolderId(null)}
                />
                <div className="absolute right-0 top-full z-20 mt-1 w-40 rounded-xl border border-zinc-700 bg-zinc-900/95 py-1 shadow-2xl backdrop-blur">
                  <button
                    type="button"
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-zinc-200 transition hover:bg-white/10"
                    onClick={() => {
                      onRenameFolder(folder);
                      setMenuFolderId(null);
                    }}
                  >
                    <Pencil className="h-4 w-4" />
                    Переименовать
                  </button>
                  <button
                    type="button"
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-red-300 transition hover:bg-red-500/20"
                    onClick={() => {
                      onDeleteFolder(folder);
                      setMenuFolderId(null);
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                    Удалить
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <aside className="flex w-full shrink-0 flex-col rounded-[30px] border border-zinc-800/80 bg-[linear-gradient(170deg,rgba(20,24,34,0.96),rgba(11,14,22,0.96))] shadow-[0_30px_80px_rgba(4,6,12,0.45)] lg:w-72">
      <div className="px-4 pb-2 pt-4">
        <div className="inline-flex items-center rounded-full border border-emerald-400/35 bg-emerald-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.26em] text-emerald-200">
          Рабочая зона
        </div>
      </div>
      <div className="flex flex-1 flex-col overflow-y-auto px-3 pb-3">
        <div className="mb-2 px-2 text-xs font-semibold uppercase tracking-[0.24em] text-zinc-500">
          Папки
        </div>
        {systemFolders.map(renderFolderRow)}
        {userFolders.length > 0 && (
          <>
            <div className="mb-2 mt-4 px-2 text-xs font-semibold uppercase tracking-[0.24em] text-zinc-500">
              Мои папки
            </div>
            {userFolders.map(renderFolderRow)}
          </>
        )}
      </div>
      <div className="border-t border-zinc-800 px-3 py-3">
        <Button
          type="button"
          className="w-full justify-center gap-2 rounded-xl bg-emerald-500/80 text-zinc-950 hover:bg-emerald-400 focus:ring-emerald-300"
          onClick={onCreateFolder}
        >
          <Plus className="h-4 w-4" />
          Новая папка
        </Button>
      </div>
    </aside>
  );
}
