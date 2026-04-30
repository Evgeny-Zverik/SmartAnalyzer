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
        className="group relative flex items-center gap-2 rounded-[24px] p-1 text-sm"
        onDragOver={canDrop ? (e) => handleDragOver(e, folder.id) : undefined}
        onDragLeave={canDrop ? (e) => handleDragLeave(e, folder.id) : undefined}
        onDrop={canDrop ? (e) => handleDrop(e, folder.id) : undefined}
      >
        <button
          type="button"
          onClick={() => onSelectFolder(folder.id)}
          className={`flex min-w-0 flex-1 items-center gap-2 rounded-[18px] px-2.5 py-2.5 pr-6 text-left transition ${
            isDropTarget ? "bg-[#fff7cc]/20 ring-1 ring-amber-300/70" : ""
          } ${
            isSelected
              ? "bg-[#fff7cc] font-medium text-stone-950 shadow-[0_10px_28px_rgba(245,158,11,0.16)]"
              : "text-stone-600 hover:bg-stone-50 hover:text-stone-950"
          }`}
        >
          {isSelected ? (
            <FolderOpen className="h-4 w-4 shrink-0 text-[#ffd43b]" />
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
              className="rounded-lg p-1 text-stone-400 opacity-0 transition hover:bg-stone-100 hover:text-stone-700 group-hover:opacity-100"
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
                <div className="absolute right-0 top-full z-20 mt-1 w-40 rounded-[18px] border border-stone-200 bg-white py-1 shadow-2xl">
                  <button
                    type="button"
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-stone-700 transition hover:bg-stone-50"
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
    <aside className="flex w-full shrink-0 flex-col rounded-[32px] border border-stone-200 bg-white shadow-[0_20px_60px_rgba(28,25,23,0.08)] lg:w-72">
      <div className="px-4 pb-2 pt-4">
        <div className="inline-flex items-center rounded-full border border-amber-200 bg-[#fff7cc] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.26em] text-stone-900">
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
      <div className="border-t border-stone-200 px-3 py-3">
        <Button
          type="button"
          className="w-full justify-center gap-2 rounded-[18px] bg-[#fff7cc]/80 text-zinc-950 hover:bg-[#f6c343] focus:ring-amber-300"
          onClick={onCreateFolder}
        >
          <Plus className="h-4 w-4" />
          Новая папка
        </Button>
      </div>
    </aside>
  );
}
