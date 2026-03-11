"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";

type DeleteFolderConfirmProps = {
  open: boolean;
  folder: { id: number; name: string } | null;
  onClose: () => void;
  onConfirm: (folderId: number) => Promise<void>;
};

export function DeleteFolderConfirm({ open, folder, onClose, onConfirm }: DeleteFolderConfirmProps) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleConfirm() {
    if (folder == null) return;
    setSubmitting(true);
    setError(null);
    try {
      await onConfirm(folder.id);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось удалить папку");
    } finally {
      setSubmitting(false);
    }
  }

  if (!open || folder == null) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-folder-title"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-lg bg-white p-4 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="delete-folder-title" className="text-lg font-semibold text-gray-900">
          Удалить папку?
        </h2>
        <p className="mt-2 text-sm text-gray-600">
          Папка «{folder.name}» будет удалена. Папка должна быть пустой.
        </p>
        {error && (
          <p className="mt-2 text-sm text-red-600" role="alert">
            {error}
          </p>
        )}
        <div className="mt-4 flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose} disabled={submitting}>
            Отмена
          </Button>
          <Button
            type="button"
            variant="primary"
            className="bg-red-600 hover:bg-red-700 focus:ring-red-500"
            onClick={handleConfirm}
            disabled={submitting}
          >
            {submitting ? "…" : "Удалить"}
          </Button>
        </div>
      </div>
    </div>
  );
}
