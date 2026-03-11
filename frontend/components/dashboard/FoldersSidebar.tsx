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
        className="group relative flex items-center gap-2 rounded-md px-2 py-1.5 text-sm"
        onDragOver={canDrop ? (e) => handleDragOver(e, folder.id) : undefined}
        onDragLeave={canDrop ? (e) => handleDragLeave(e, folder.id) : undefined}
        onDrop={canDrop ? (e) => handleDrop(e, folder.id) : undefined}
      >
        <button
          type="button"
          onClick={() => onSelectFolder(folder.id)}
          className={`flex min-w-0 flex-1 items-center gap-2 rounded py-1 pr-6 text-left ${
            isDropTarget ? "bg-emerald-100 ring-1 ring-emerald-400" : ""
          } ${isSelected ? "bg-gray-100 font-medium text-gray-900" : "text-gray-700 hover:bg-gray-50"}`}
        >
          {isSelected ? (
            <FolderOpen className="h-4 w-4 shrink-0 text-gray-500" />
          ) : (
            <Folder className="h-4 w-4 shrink-0 text-gray-500" />
          )}
          <span className="truncate">{folder.name}</span>
          <span className="shrink-0 text-xs text-gray-400">({folder.item_count})</span>
        </button>
        {folder.type === "user" && (
          <div className="absolute right-1 top-1/2 -translate-y-1/2">
            <button
              type="button"
              className="rounded p-1 text-gray-400 opacity-0 hover:bg-gray-200 hover:text-gray-600 group-hover:opacity-100"
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
                <div className="absolute right-0 top-full z-20 mt-1 w-40 rounded-md border border-gray-200 bg-white py-1 shadow-lg">
                  <button
                    type="button"
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
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
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50"
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
    <aside className="flex w-56 shrink-0 flex-col border-r border-gray-200 bg-white">
      <div className="flex flex-1 flex-col overflow-y-auto p-2">
        <div className="mb-1 px-2 text-xs font-semibold uppercase text-gray-500">
          Папки
        </div>
        {systemFolders.map(renderFolderRow)}
        {userFolders.length > 0 && (
          <>
            <div className="mt-3 mb-1 px-2 text-xs font-semibold uppercase text-gray-500">
              Мои папки
            </div>
            {userFolders.map(renderFolderRow)}
          </>
        )}
      </div>
      <div className="border-t border-gray-200 p-2">
        <Button
          type="button"
          variant="secondary"
          className="w-full justify-center gap-2"
          onClick={onCreateFolder}
        >
          <Plus className="h-4 w-4" />
          Новая папка
        </Button>
      </div>
    </aside>
  );
}
