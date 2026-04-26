"use client";

import type { ReactNode } from "react";
import { IBM_Plex_Sans, PT_Serif } from "next/font/google";
import type { LucideIcon } from "lucide-react";
import { ScanSearch, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { UploadDropzone } from "@/components/tools/UploadDropzone";

type SecurityChip = {
  title: string;
  subtitle: string;
  tooltip: string;
  icon: LucideIcon;
};

type InfoCard = {
  title: string;
  value: string;
};

type SecureUploadHeroProps = {
  heading: ReactNode;
  description: string;
  acceptedExtensions: string[];
  file: File | null;
  onFileChange: (file: File | null) => void;
  onAnalyze: () => void;
  analyzeDisabled: boolean;
  securityChips: SecurityChip[];
  infoCards: InfoCard[];
  costHint?: ReactNode;
  intakeLabel?: string;
  uploadTitle?: string;
  analyzeLabel?: string;
};

const displayFont = PT_Serif({
  subsets: ["latin", "cyrillic"],
  variable: "--font-doc-display",
  weight: ["400", "700"],
});

const bodyFont = IBM_Plex_Sans({
  subsets: ["latin", "cyrillic"],
  variable: "--font-doc-body",
  weight: ["400", "500", "600"],
});

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getFileExtension(name: string): string {
  const index = name.lastIndexOf(".");
  return index >= 0 ? name.slice(index + 1).toLowerCase() : "";
}

export function SecureUploadHero({
  heading,
  description,
  acceptedExtensions,
  file,
  onFileChange,
  onAnalyze,
  analyzeDisabled,
  securityChips,
  infoCards,
  costHint,
  intakeLabel = "Proof Intake",
  uploadTitle = "Загрузите текст на проверку",
  analyzeLabel = "Запустить анализ",
}: SecureUploadHeroProps) {
  return (
    <section
      className={`relative overflow-hidden rounded-[32px] border border-zinc-800 bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.24),transparent_36%),radial-gradient(circle_at_90%_4%,rgba(56,189,248,0.2),transparent_34%),linear-gradient(160deg,#0b1019,#131c2c_55%,#192639)] p-5 text-zinc-100 shadow-[0_34px_120px_rgba(2,6,23,0.46)] ${displayFont.variable} ${bodyFont.variable} sm:p-7`}
    >
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(120deg,rgba(255,255,255,0.08),transparent_34%,rgba(255,255,255,0.02)_72%,transparent)]" />

      <div className="relative grid gap-6 xl:grid-cols-[minmax(0,1.05fr)_minmax(360px,0.95fr)] xl:items-start">
        <div className="space-y-6">
          <div className="flex flex-wrap items-center gap-3 [font-family:var(--font-doc-body)]">
            <span className="inline-flex items-center gap-2 rounded-full border border-emerald-300/35 bg-emerald-400/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-emerald-200">
              <Sparkles className="h-3.5 w-3.5" />
              Режим загрузки
            </span>
          </div>

          <div className="max-w-3xl">
            <h2 className="max-w-2xl text-4xl leading-[1.04] tracking-[-0.03em] text-white [font-family:var(--font-doc-display)] sm:text-6xl">
              {heading}
            </h2>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-zinc-300 [font-family:var(--font-doc-body)] sm:text-base">
              {description}
            </p>
            <div className="mt-5 flex flex-wrap gap-3 [font-family:var(--font-doc-body)]">
              {securityChips.map((chip) => (
                <div key={chip.title} className="group relative">
                  <button
                    type="button"
                    aria-label={chip.tooltip}
                    className="inline-flex items-center gap-2 rounded-2xl border border-white/20 bg-white/10 px-4 py-3 text-left text-emerald-100 transition hover:-translate-y-0.5 hover:border-emerald-300/55 hover:bg-emerald-400/18"
                  >
                    <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-emerald-300/45 bg-emerald-400/12 text-emerald-200">
                      <chip.icon className="h-5 w-5" />
                    </span>
                    <span>
                      <span className="block text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-300">{chip.title}</span>
                      <span className="block text-sm text-zinc-200">{chip.subtitle}</span>
                    </span>
                  </button>
                  <div className="pointer-events-none absolute bottom-[calc(100%+0.75rem)] left-0 z-20 invisible w-80 max-w-[min(20rem,calc(100vw-2rem))] rounded-2xl border border-zinc-700 bg-zinc-900 p-3 text-xs leading-5 text-zinc-300 opacity-0 shadow-xl transition duration-150 group-hover:visible group-hover:opacity-100">
                    {chip.tooltip}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3 [font-family:var(--font-doc-body)]">
            {infoCards.map((item) => (
              <div key={item.title} className="rounded-2xl border border-white/15 bg-white/10 px-3 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-300">{item.title}</p>
                <p className="mt-2 text-sm font-medium text-zinc-100">{item.value}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="relative overflow-hidden rounded-[28px] border border-white/15 bg-white/8 p-4 text-stone-50 backdrop-blur sm:p-5">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(110,231,183,0.18),transparent_34%)]" />
          <div className="pointer-events-none absolute inset-x-8 top-20 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />

          <div className="relative space-y-5">
            <div className="flex items-start justify-between gap-3 border-b border-white/10 pb-4">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-emerald-300/90">{intakeLabel}</p>
                <h3 className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-white">{uploadTitle}</h3>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-3 text-emerald-300">
                <ScanSearch className="h-6 w-6" />
              </div>
            </div>

            {file ? (
              <button
                type="button"
                onClick={() => onFileChange(null)}
                className="w-full rounded-[26px] border border-emerald-400/35 bg-emerald-400/12 px-6 py-6 text-left transition hover:border-emerald-300/55 hover:bg-emerald-400/16"
              >
                <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-emerald-100/80">Выбранный файл</p>
                <p className="mt-4 truncate text-[2rem] font-semibold leading-none tracking-[-0.04em] text-white sm:text-[2.25rem]">
                  {file.name}
                </p>
                <p className="mt-4 text-sm text-stone-300">{`${formatSize(file.size)} · .${getFileExtension(file.name) || "file"}`}</p>
              </button>
            ) : (
              <div className="rounded-[26px] border border-white/10 bg-white/[0.03] p-2">
                <UploadDropzone
                  acceptedExtensions={acceptedExtensions}
                  file={file}
                  onFileChange={onFileChange}
                  compact
                  showFileCard={false}
                  surface="dark"
                />
              </div>
            )}

            <Button
              type="button"
              variant="primary"
              disabled={analyzeDisabled}
              onClick={onAnalyze}
              className="w-full bg-emerald-400 text-stone-950 hover:bg-emerald-300 disabled:bg-white/10 disabled:text-stone-500"
            >
              {analyzeLabel}
            </Button>
            {costHint ? <div className="flex justify-center">{costHint}</div> : null}
          </div>
        </div>
      </div>
    </section>
  );
}
