"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { SeverityBadge } from "@/components/tools/SeverityBadge";
import { downloadText } from "@/lib/utils/downloadText";

export type AdvancedAnnotation = {
  id: string;
  type: "risk" | "improvement";
  severity: "low" | "medium" | "high";
  start_offset: number;
  end_offset: number;
  title: string;
  reason: string;
  suggested_rewrite: string;
};

type AdvancedAiEditorProps = {
  data: {
    full_text: string;
    annotations: AdvancedAnnotation[];
  };
};

type AnnotationFilter = "all" | "risk" | "improvement";

function annotationChipClass(filter: AnnotationFilter, active: boolean): string {
  if (active) {
    if (filter === "risk") return "border-red-200 bg-red-50 text-red-700";
    if (filter === "improvement") return "border-amber-200 bg-amber-50 text-amber-700";
    return "border-gray-900 bg-gray-900 text-white";
  }
  return "border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:text-gray-900";
}

function annotationSpanClass(annotation: AdvancedAnnotation, active: boolean): string {
  if (annotation.type === "risk") {
    return active
      ? "rounded bg-red-200/90 px-0.5 ring-2 ring-red-300"
      : "rounded bg-red-100/90 px-0.5 hover:bg-red-200";
  }
  return active
    ? "rounded bg-amber-200/90 px-0.5 ring-2 ring-amber-300"
    : "rounded bg-amber-100/90 px-0.5 hover:bg-amber-200";
}

function getAnnotationExcerpt(text: string, annotation: AdvancedAnnotation): string {
  return text.slice(annotation.start_offset, annotation.end_offset).trim();
}

function buildSegments(text: string, annotations: AdvancedAnnotation[]) {
  const ordered = [...annotations].sort((a, b) => a.start_offset - b.start_offset);
  const segments: Array<
    | { type: "text"; key: string; text: string }
    | { type: "annotation"; key: string; text: string; annotation: AdvancedAnnotation }
  > = [];
  let cursor = 0;

  ordered.forEach((annotation) => {
    const start = Math.max(cursor, annotation.start_offset);
    const end = Math.min(text.length, annotation.end_offset);
    if (start > cursor) {
      segments.push({ type: "text", key: `text-${cursor}`, text: text.slice(cursor, start) });
    }
    if (end > start) {
      segments.push({
        type: "annotation",
        key: annotation.id,
        text: text.slice(start, end),
        annotation,
      });
      cursor = end;
    }
  });

  if (cursor < text.length) {
    segments.push({ type: "text", key: `text-${cursor}`, text: text.slice(cursor) });
  }

  return segments;
}

function shiftAnnotations(
  annotations: AdvancedAnnotation[],
  source: AdvancedAnnotation,
  nextTextLength: number
): AdvancedAnnotation[] {
  const delta = nextTextLength - (source.end_offset - source.start_offset);
  return annotations
    .filter((annotation) => annotation.id !== source.id)
    .filter(
      (annotation) =>
        annotation.end_offset <= source.start_offset || annotation.start_offset >= source.end_offset
    )
    .map((annotation) => {
      if (annotation.start_offset >= source.end_offset) {
        return {
          ...annotation,
          start_offset: annotation.start_offset + delta,
          end_offset: annotation.end_offset + delta,
        };
      }
      return annotation;
    });
}

export function AdvancedAiEditor({ data }: AdvancedAiEditorProps) {
  const [editorText, setEditorText] = useState(data.full_text);
  const [annotations, setAnnotations] = useState<AdvancedAnnotation[]>(data.annotations);
  const [filter, setFilter] = useState<AnnotationFilter>("all");
  const [activeId, setActiveId] = useState<string | null>(data.annotations[0]?.id ?? null);
  const [manualEditWarning, setManualEditWarning] = useState(false);
  const [copyState, setCopyState] = useState<"idle" | "done" | "error">("idle");
  const [rewriteCopyState, setRewriteCopyState] = useState<"idle" | "done" | "error">("idle");
  const annotationRefs = useRef<Record<string, HTMLSpanElement | null>>({});

  useEffect(() => {
    setEditorText(data.full_text);
    setAnnotations(data.annotations);
    setFilter("all");
    setActiveId(data.annotations[0]?.id ?? null);
    setManualEditWarning(false);
    setCopyState("idle");
    setRewriteCopyState("idle");
  }, [data]);

  const counts = useMemo(
    () => ({
      risk: annotations.filter((annotation) => annotation.type === "risk").length,
      improvement: annotations.filter((annotation) => annotation.type === "improvement").length,
    }),
    [annotations]
  );

  const filteredAnnotations = useMemo(() => {
    if (filter === "all") return annotations;
    return annotations.filter((annotation) => annotation.type === filter);
  }, [annotations, filter]);

  const activeAnnotation = useMemo(() => {
    const found = filteredAnnotations.find((annotation) => annotation.id === activeId);
    return found ?? filteredAnnotations[0] ?? null;
  }, [filteredAnnotations, activeId]);

  useEffect(() => {
    if (!activeAnnotation) {
      setActiveId(null);
      return;
    }
    if (activeAnnotation.id !== activeId) {
      setActiveId(activeAnnotation.id);
    }
  }, [activeAnnotation, activeId]);

  const segments = useMemo(() => buildSegments(editorText, filteredAnnotations), [editorText, filteredAnnotations]);

  const handleCopyText = async () => {
    try {
      await navigator.clipboard.writeText(editorText);
      setCopyState("done");
    } catch {
      setCopyState("error");
    }
  };

  const handleCopyRewrite = async () => {
    if (!activeAnnotation) return;
    try {
      await navigator.clipboard.writeText(activeAnnotation.suggested_rewrite);
      setRewriteCopyState("done");
    } catch {
      setRewriteCopyState("error");
    }
  };

  const handleApplyChange = () => {
    if (!activeAnnotation) return;
    const nextText =
      editorText.slice(0, activeAnnotation.start_offset) +
      activeAnnotation.suggested_rewrite +
      editorText.slice(activeAnnotation.end_offset);
    setEditorText(nextText);
    setAnnotations((prev) => shiftAnnotations(prev, activeAnnotation, activeAnnotation.suggested_rewrite.length));
    setActiveId(null);
    setManualEditWarning(false);
  };

  const handleDismiss = () => {
    if (!activeAnnotation) return;
    setAnnotations((prev) => prev.filter((annotation) => annotation.id !== activeAnnotation.id));
    setActiveId(null);
  };

  const handleNavigate = (direction: 1 | -1) => {
    if (filteredAnnotations.length === 0) return;
    const currentIndex = filteredAnnotations.findIndex((annotation) => annotation.id === activeAnnotation?.id);
    const baseIndex = currentIndex === -1 ? 0 : currentIndex;
    const nextIndex = (baseIndex + direction + filteredAnnotations.length) % filteredAnnotations.length;
    const next = filteredAnnotations[nextIndex];
    setActiveId(next.id);
    annotationRefs.current[next.id]?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  const activeExcerpt = activeAnnotation ? getAnnotationExcerpt(editorText, activeAnnotation) : "";

  return (
    <div className="space-y-6">
      <Card className="border-gray-200 bg-gradient-to-br from-white via-gray-50 to-amber-50/50">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-red-200 bg-red-50 px-3 py-1 text-xs font-medium text-red-700">
                {counts.risk} risks
              </span>
              <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700">
                {counts.improvement} improvements
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              {(["all", "risk", "improvement"] as AnnotationFilter[]).map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setFilter(value)}
                  className={`rounded-full border px-3 py-1 text-xs font-medium transition ${annotationChipClass(
                    value,
                    filter === value
                  )}`}
                >
                  {value === "all" ? "All" : value === "risk" ? "Risks" : "Improvements"}
                </button>
              ))}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="secondary" onClick={handleCopyText}>
              {copyState === "done" ? "Copied" : copyState === "error" ? "Copy failed" : "Copy text"}
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => downloadText(editorText, "document-analyzer-edited.txt")}
            >
              Download .txt
            </Button>
          </div>
        </div>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.6fr)_380px]">
        <Card className="overflow-hidden p-0">
          <div className="border-b border-gray-200 bg-gray-50 px-5 py-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-gray-900">Advanced AI Editor</h3>
                <p className="mt-1 text-xs text-gray-500">
                  Красный помечает риски, желтый показывает места для улучшения.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button type="button" variant="ghost" onClick={() => handleNavigate(-1)} disabled={filteredAnnotations.length === 0}>
                  Previous
                </Button>
                <Button type="button" variant="ghost" onClick={() => handleNavigate(1)} disabled={filteredAnnotations.length === 0}>
                  Next
                </Button>
              </div>
            </div>
          </div>
          <div className="space-y-4 p-5">
            {manualEditWarning && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                После ручных правок подсветка может немного сместиться. AI-аннотации не пересчитываются в реальном времени.
              </div>
            )}
            <div
              className="min-h-[520px] rounded-2xl border border-gray-200 bg-white p-5 font-mono text-[13px] leading-7 text-gray-800 outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 whitespace-pre-wrap"
              contentEditable
              suppressContentEditableWarning
              onInput={(event) => {
                setEditorText(event.currentTarget.textContent ?? "");
                setManualEditWarning(true);
              }}
            >
              {segments.length > 0 ? (
                segments.map((segment) => {
                  if (segment.type === "text") {
                    return <span key={segment.key}>{segment.text}</span>;
                  }
                  const isActive = activeAnnotation?.id === segment.annotation.id;
                  return (
                    <span
                      key={segment.key}
                      ref={(node) => {
                        annotationRefs.current[segment.annotation.id] = node;
                      }}
                      onClick={() => setActiveId(segment.annotation.id)}
                      className={`${annotationSpanClass(segment.annotation, isActive)} cursor-pointer transition`}
                      title={segment.annotation.title}
                    >
                      {segment.text}
                    </span>
                  );
                })
              ) : (
                <span>{editorText}</span>
              )}
            </div>
          </div>
        </Card>

        <div className="space-y-6">
          <Card>
            <h3 className="text-sm font-semibold text-gray-900">AI Inspector</h3>
            {activeAnnotation ? (
              <div className="mt-4 space-y-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`rounded-full border px-2.5 py-1 text-xs font-medium ${
                      activeAnnotation.type === "risk"
                        ? "border-red-200 bg-red-50 text-red-700"
                        : "border-amber-200 bg-amber-50 text-amber-700"
                    }`}
                  >
                    {activeAnnotation.type === "risk" ? "Risk" : "Improvement"}
                  </span>
                  <SeverityBadge severity={activeAnnotation.severity} />
                </div>
                <div>
                  <h4 className="text-base font-semibold text-gray-900">{activeAnnotation.title}</h4>
                  <p className="mt-2 text-sm leading-6 text-gray-600">{activeAnnotation.reason}</p>
                </div>
                <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                  <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Original fragment</p>
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-gray-800">
                    {activeExcerpt || "Фрагмент недоступен"}
                  </p>
                </div>
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                  <p className="text-xs font-medium uppercase tracking-wide text-emerald-700">Suggested rewrite</p>
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-emerald-900">
                    {activeAnnotation.suggested_rewrite}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="primary" onClick={handleApplyChange}>
                    Apply change
                  </Button>
                  <Button type="button" variant="secondary" onClick={handleDismiss}>
                    Dismiss
                  </Button>
                  <Button type="button" variant="ghost" onClick={handleCopyRewrite}>
                    {rewriteCopyState === "done"
                      ? "Copied rewrite"
                      : rewriteCopyState === "error"
                        ? "Copy failed"
                        : "Copy"}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="mt-4 rounded-xl border border-dashed border-gray-200 bg-gray-50 p-4 text-sm text-gray-500">
                Выберите подсвеченный фрагмент или замечание из списка.
              </div>
            )}
          </Card>

          <Card>
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-sm font-semibold text-gray-900">Review Queue</h3>
              <span className="text-xs text-gray-500">{filteredAnnotations.length} items</span>
            </div>
            {filteredAnnotations.length > 0 ? (
              <div className="mt-4 space-y-3">
                {filteredAnnotations.map((annotation) => (
                  <button
                    key={annotation.id}
                    type="button"
                    onClick={() => {
                      setActiveId(annotation.id);
                      annotationRefs.current[annotation.id]?.scrollIntoView({
                        behavior: "smooth",
                        block: "center",
                      });
                    }}
                    className={`w-full rounded-2xl border p-4 text-left transition ${
                      activeAnnotation?.id === annotation.id
                        ? "border-gray-900 bg-gray-900 text-white"
                        : "border-gray-200 bg-white hover:border-gray-300"
                    }`}
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${
                          activeAnnotation?.id === annotation.id
                            ? "border-white/20 bg-white/10 text-white"
                            : annotation.type === "risk"
                              ? "border-red-200 bg-red-50 text-red-700"
                              : "border-amber-200 bg-amber-50 text-amber-700"
                        }`}
                      >
                        {annotation.type === "risk" ? "Risk" : "Improvement"}
                      </span>
                      <SeverityBadge severity={annotation.severity} />
                    </div>
                    <p className="mt-3 text-sm font-medium">{annotation.title}</p>
                    <p
                      className={`mt-2 line-clamp-3 text-sm leading-6 ${
                        activeAnnotation?.id === annotation.id ? "text-white/80" : "text-gray-600"
                      }`}
                    >
                      {annotation.reason}
                    </p>
                  </button>
                ))}
              </div>
            ) : (
              <div className="mt-4 rounded-2xl border border-dashed border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
                Явных замечаний не найдено. Можно работать с чистым извлеченным текстом.
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
