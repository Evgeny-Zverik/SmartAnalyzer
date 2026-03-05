"use client";

import { useCallback, useState } from "react";
import { Upload, FileText, X } from "lucide-react";

type UploadDropzoneProps = {
  acceptedExtensions: string[];
  file: File | null;
  onFileChange: (file: File | null) => void;
  error?: string;
};

function getExtension(name: string): string {
  const i = name.lastIndexOf(".");
  return i >= 0 ? name.slice(i + 1).toLowerCase() : "";
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function UploadDropzone({
  acceptedExtensions,
  file,
  onFileChange,
  error,
}: UploadDropzoneProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  const validate = useCallback(
    (f: File): string | null => {
      const ext = getExtension(f.name);
      const allowed = new Set(acceptedExtensions.map((e) => e.toLowerCase()));
      if (!allowed.has(ext)) {
        return `Формат .${ext} не поддерживается. Разрешены: ${acceptedExtensions.join(", ")}`;
      }
      return null;
    },
    [acceptedExtensions]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      setValidationError(null);
      const item = e.dataTransfer.files[0];
      if (!item) return;
      const err = validate(item);
      if (err) {
        setValidationError(err);
        return;
      }
      onFileChange(item);
    },
    [onFileChange, validate]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setValidationError(null);
      const item = e.target.files?.[0];
      if (!item) {
        onFileChange(null);
        return;
      }
      const err = validate(item);
      if (err) {
        setValidationError(err);
        onFileChange(null);
        return;
      }
      onFileChange(item);
    },
    [onFileChange, validate]
  );

  const clearFile = useCallback(() => {
    onFileChange(null);
    setValidationError(null);
  }, [onFileChange]);

  const displayError = error ?? validationError;

  return (
    <div className="space-y-4">
      <label className="block">
        <span className="sr-only">Выберите файл</span>
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          className={`flex min-h-[160px] cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-6 transition-colors ${
            isDragOver
              ? "border-emerald-500 bg-emerald-50/50"
              : "border-gray-300 bg-gray-50 hover:border-gray-400 hover:bg-gray-100 focus-within:border-emerald-500 focus-within:ring-2 focus-within:ring-emerald-500 focus-within:ring-offset-2"
          }`}
        >
          <Upload className="h-10 w-10 text-gray-400" aria-hidden />
          <p className="mt-2 text-sm text-gray-600">
            Перетащите файл сюда или нажмите для выбора
          </p>
          <p className="mt-1 text-xs text-gray-500">
            {acceptedExtensions.join(", ")}
          </p>
          <input
            type="file"
            className="sr-only"
            accept={acceptedExtensions.map((e) => `.${e}`).join(",")}
            onChange={handleInputChange}
          />
        </div>
      </label>

      {file && (
        <div className="flex items-center justify-between rounded-lg border border-gray-200 bg-white px-4 py-3">
          <div className="flex items-center gap-3">
            <FileText className="h-5 w-5 text-gray-500" aria-hidden />
            <div>
              <p className="text-sm font-medium text-gray-900">{file.name}</p>
              <p className="text-xs text-gray-500">{formatSize(file.size)}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={clearFile}
            className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            aria-label="Удалить файл"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      )}

      {displayError && (
        <p className="text-sm text-red-600" role="alert">
          {displayError}
        </p>
      )}
    </div>
  );
}
