"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/Button";

type RenameFolderDialogProps = {
  open: boolean;
  folderId: number | null;
  currentName: string;
  onClose: () => void;
  onRename: (folderId: number, name: string) => Promise<void>;
};

export function RenameFolderDialog({
  open,
  folderId,
  currentName,
  onClose,
  onRename,
}: RenameFolderDialogProps) {
  const [name, setName] = useState(currentName);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setName(currentName);
      setError(null);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open, currentName]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (folderId == null) return;
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Введите название папки");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await onRename(folderId, trimmed);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось переименовать");
    } finally {
      setSubmitting(false);
    }
  }

  if (!open || folderId == null) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="rename-folder-title"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-lg bg-white p-4 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="rename-folder-title" className="text-lg font-semibold text-gray-900">
          Переименовать папку
        </h2>
        <form onSubmit={handleSubmit} className="mt-4 space-y-3">
          <input
            ref={inputRef}
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Название папки"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            disabled={submitting}
          />
          {error && (
            <p className="text-sm text-red-600" role="alert">
              {error}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={onClose} disabled={submitting}>
              Отмена
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? "…" : "Сохранить"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
