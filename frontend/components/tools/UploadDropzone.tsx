"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Check, FileText, Upload, X } from "lucide-react";

type UploadDropzoneProps = {
  acceptedExtensions: string[];
  file: File | null;
  onFileChange: (file: File | null) => void;
  error?: string;
  compact?: boolean;
  showFileCard?: boolean;
  variant?: "default" | "comparison";
  comparisonTone?: "left" | "right";
  surface?: "light" | "dark";
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
  compact = false,
  showFileCard = true,
  variant = "default",
  comparisonTone = "left",
  surface = "light",
}: UploadDropzoneProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [showUploadSuccess, setShowUploadSuccess] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const previousFileRef = useRef<File | null>(null);

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
      e.stopPropagation();
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
    e.stopPropagation();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
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
  const isComparison = variant === "comparison";
  const comparisonAccent =
    comparisonTone === "right"
      ? {
          text: "text-sky-300",
          border: "border-sky-400",
          borderSoft: "border-sky-300/40",
          bgSoft: "bg-sky-300/12",
          ping: "bg-sky-300/25",
          shadow: "shadow-[0_0_40px_rgba(125,211,252,0.18)]",
          ring: "focus:ring-sky-400",
          hover: "hover:border-sky-300/60",
          ready: "text-sky-300/80",
        }
      : {
          text: "text-emerald-300",
          border: "border-emerald-400",
          borderSoft: "border-emerald-300/40",
          bgSoft: "bg-emerald-300/12",
          ping: "bg-emerald-300/25",
          shadow: "shadow-[0_0_40px_rgba(110,231,183,0.18)]",
          ring: "focus:ring-emerald-400",
          hover: "hover:border-emerald-300/60",
          ready: "text-emerald-300/80",
        };

  useEffect(() => {
    const previousFile = previousFileRef.current;
    previousFileRef.current = file;

    if (!isComparison) return;
    if (!file) {
      setShowUploadSuccess(false);
      return;
    }
    if (previousFile?.name === file.name && previousFile?.size === file.size) {
      return;
    }

    setShowUploadSuccess(true);
    const timeoutId = window.setTimeout(() => {
      setShowUploadSuccess(false);
    }, 1200);

    return () => window.clearTimeout(timeoutId);
  }, [file, isComparison]);

  return (
    <div className="space-y-3">
      <span className="sr-only">Выберите файл</span>
      <div
        role="button"
        tabIndex={0}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={`flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed transition-colors ${
          isComparison
            ? isDragOver
              ? `${comparisonAccent.border} ${comparisonAccent.bgSoft}`
              : `border-white/15 bg-white/[0.02] ${comparisonAccent.hover} hover:bg-white/[0.05] focus:border-current focus:ring-2 ${comparisonAccent.ring} focus:ring-offset-2 focus:ring-offset-stone-950 ${comparisonAccent.text}`
            : isDragOver
              ? surface === "dark"
                ? "border-emerald-300 bg-emerald-400/10"
                : "border-emerald-500 bg-emerald-50/50"
              : surface === "dark"
                ? "border-white/20 bg-white/[0.06] hover:border-emerald-300/60 hover:bg-white/[0.1] focus:border-emerald-300 focus:ring-2 focus:ring-emerald-300/40 focus:ring-offset-2 focus:ring-offset-zinc-950"
                : "border-gray-300 bg-gray-50 hover:border-gray-400 hover:bg-gray-100 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2"
        }`}
        style={{ minHeight: compact ? 118 : 160 }}
      >
        {isComparison && file ? (
          <div className="flex w-full flex-col items-center">
            {showUploadSuccess ? (
              <>
                <div className="relative">
                  <div className={`absolute -inset-2 rounded-full ${comparisonAccent.ping} blur-xl animate-pulse`} />
                  <div className={`absolute inset-0 animate-ping rounded-full ${comparisonAccent.ping}`} />
                  <div className={`relative flex h-12 w-12 items-center justify-center rounded-full border ${comparisonAccent.borderSoft} bg-black/10 ${comparisonAccent.shadow}`}>
                    <Check className={`h-6 w-6 ${comparisonAccent.text} animate-[fade-in_220ms_ease-out,zoom-in_260ms_ease-out]`} aria-hidden />
                  </div>
                </div>
                <p className="mt-3 text-sm font-medium text-stone-50">Документ загружен</p>
                <p className={`mt-1 text-xs uppercase tracking-[0.18em] ${comparisonAccent.ready}`}>Готов к сравнению</p>
              </>
            ) : (
              <div className="w-full px-4 py-4 text-left">
                <div className="flex items-start gap-3">
                  <div className={`mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border ${comparisonAccent.borderSoft} ${comparisonAccent.bgSoft}`}>
                    <FileText className={`h-5 w-5 ${comparisonAccent.text}`} aria-hidden />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-stone-50">{file.name}</p>
                    <p className="mt-1 text-xs text-stone-400">
                      {formatSize(file.size)} · .{getExtension(file.name) || "file"}
                    </p>
                    <p className={`mt-2 text-[11px] font-semibold uppercase tracking-[0.18em] ${comparisonAccent.ready}`}>
                      Успешно загружен
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (
          <>
            <Upload
              className={`${compact ? "h-8 w-8" : "h-10 w-10"} ${
                isComparison ? comparisonAccent.text : surface === "dark" ? "text-zinc-300" : "text-gray-400"
              }`}
              aria-hidden
            />
            <p
              className={`mt-2 ${compact ? "text-sm" : "text-sm"} ${
                isComparison ? "text-stone-100" : surface === "dark" ? "text-zinc-100" : "text-gray-600"
              }`}
            >
              {isComparison ? "Перетащите документ в зону сравнения" : "Перетащите файл сюда или нажмите для выбора"}
            </p>
            <p
              className={`mt-1 text-xs ${
                isComparison ? "text-stone-400" : surface === "dark" ? "text-zinc-400" : "text-gray-500"
              }`}
            >
              {acceptedExtensions.join(", ")}
            </p>
          </>
        )}
        <input
          ref={inputRef}
          type="file"
          className="sr-only"
          accept={acceptedExtensions.map((e) => `.${e}`).join(",")}
          onChange={handleInputChange}
        />
      </div>

      {showFileCard && file && (
        <div className={`flex items-center justify-between rounded-2xl px-4 py-3 ${isComparison ? "border border-white/10 bg-white/[0.04]" : "border border-gray-200 bg-white"}`}>
          <div className="flex items-center gap-3">
            <FileText className={`h-5 w-5 ${isComparison ? comparisonAccent.text : "text-gray-500"}`} aria-hidden />
            <div>
              <p className={`text-sm font-medium ${isComparison ? "text-stone-100" : "text-gray-900"}`}>{file.name}</p>
              <p className={`text-xs ${isComparison ? "text-stone-400" : "text-gray-500"}`}>{formatSize(file.size)}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={clearFile}
            className={`rounded p-1 focus:outline-none focus:ring-2 ${
              isComparison
                ? "text-stone-400 hover:bg-white/10 hover:text-stone-100 focus:ring-emerald-400"
                : "text-gray-400 hover:bg-gray-100 hover:text-gray-600 focus:ring-emerald-500"
            }`}
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
