"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  Bold,
  ChevronDown,
  Heading1,
  Italic,
  Link2,
  List,
  ListOrdered,
  Redo2,
  Strikethrough,
  UnderlineIcon,
  Undo2,
} from "lucide-react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import type { JSONContent } from "@tiptap/core";
import Link from "@tiptap/extension-link";
import FontFamily from "@tiptap/extension-font-family";
import TextAlign from "@tiptap/extension-text-align";
import { TextStyle } from "@tiptap/extension-text-style";
import Underline from "@tiptap/extension-underline";
import { Extension } from "@tiptap/core";
import { Table } from "@tiptap/extension-table";
import { TableCell } from "@tiptap/extension-table-cell";
import { TableHeader } from "@tiptap/extension-table-header";
import { TableRow } from "@tiptap/extension-table-row";
import type { EditorView } from "@tiptap/pm/view";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { SeverityBadge } from "@/components/tools/SeverityBadge";
import {
  downloadDocumentFile,
  type DownloadFormatPreset,
  type DownloadTextAlignment,
} from "@/lib/utils/downloadDocumentFile";

export type AdvancedAnnotation = {
  id: string;
  type: "risk" | "improvement";
  severity: "low" | "medium" | "high";
  start_offset: number;
  end_offset: number;
  exact_quote: string;
  title: string;
  reason: string;
  suggested_rewrite: string;
};

type AdvancedAiEditorProps = {
  data: {
    full_text: string;
    rich_content?: Record<string, unknown> | null;
    source_format?: string | null;
    annotations: AdvancedAnnotation[];
  };
  isAnalyzing?: boolean;
  onDocumentChange?: (payload: {
    full_text: string;
    rich_content: Record<string, unknown>;
    source_format: string;
    is_dirty: boolean;
  }) => void;
};

type AnnotationFilter = "all" | "risk" | "improvement";
type EditorFormatPreset = DownloadFormatPreset;
type EditorAlignment = DownloadTextAlignment;

const AI_ANNOTATIONS_PLUGIN_KEY = new PluginKey("ai-annotations");

const FORMAT_PRESETS: Array<{
  value: EditorFormatPreset;
  label: string;
  description: string;
  className: string;
}> = [
  {
    value: "standard",
    label: "Стандарт",
    description: "Сбалансированный режим для редактирования",
    className: "font-mono text-[13px] leading-7 tracking-normal",
  },
  {
    value: "compact",
    label: "Компактно",
    description: "Больше текста на экране, плотные абзацы",
    className: "font-mono text-[12px] leading-6 tracking-normal",
  },
  {
    value: "document",
    label: "Документ",
    description: "Более формальный вид для договоров и актов",
    className: "font-serif text-[15px] leading-8 tracking-[0.01em]",
  },
  {
    value: "draft",
    label: "Черновик",
    description: "Удобно для вычитки и обсуждения текста",
    className: "font-sans text-[14px] leading-8 tracking-normal",
  },
];

const ALIGNMENT_OPTIONS: Array<{
  value: EditorAlignment;
  label: string;
  className: string;
}> = [
  { value: "left", label: "По левому краю", className: "text-left" },
  { value: "center", label: "По центру", className: "text-center" },
  { value: "right", label: "По правому краю", className: "text-right" },
  { value: "justify", label: "По ширине", className: "text-justify" },
];

const FONT_FAMILIES = [
  { label: "Arial", value: "Arial, sans-serif" },
  { label: "Times New Roman", value: "\"Times New Roman\", serif" },
  { label: "Georgia", value: "Georgia, serif" },
  { label: "Courier New", value: "\"Courier New\", monospace" },
];

const FONT_SIZES = ["12", "14", "16", "18", "20", "24", "28", "32"];
const VIRTUAL_PAGE_HEIGHT = 1120;

const FontSize = Extension.create({
  name: "fontSize",
  addGlobalAttributes() {
    return [
      {
        types: ["textStyle"],
        attributes: {
          fontSize: {
            default: null,
            parseHTML: (element) => element.style.fontSize || null,
            renderHTML: (attributes) => {
              if (!attributes.fontSize) {
                return {};
              }
              return { style: `font-size: ${attributes.fontSize}` };
            },
          },
        },
      },
    ];
  },
});

function annotationChipClass(filter: AnnotationFilter, active: boolean): string {
  if (active) {
    if (filter === "risk") return "border-red-200 bg-red-50 text-red-700";
    if (filter === "improvement") return "border-amber-200 bg-amber-50 text-amber-700";
    return "border-gray-900 bg-gray-900 text-white";
  }
  return "border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:text-gray-900";
}

function toolbarButtonClass(active = false): string {
  return `inline-flex h-10 w-10 items-center justify-center rounded-xl border text-gray-700 transition focus:outline-none focus:ring-2 focus:ring-gray-300 focus:ring-offset-2 ${
    active
      ? "border-gray-900 bg-gray-900 text-white"
      : "border-gray-300 bg-white hover:bg-gray-50"
  }`;
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

function textToDocJson(text: string): JSONContent {
  const paragraphs = text.replace(/\r\n/g, "\n").split("\n");
  return {
    type: "doc",
    content: paragraphs.map((paragraph) =>
      paragraph.trim().length === 0
        ? { type: "paragraph" }
        : { type: "paragraph", content: [{ type: "text", text: paragraph }] }
    ),
  };
}

function getNodeJoinSeparator(nodeType: string): string {
  if (nodeType === "doc" || nodeType === "bulletList" || nodeType === "orderedList" || nodeType === "listItem" || nodeType === "table") {
    return "\n";
  }
  if (nodeType === "tableRow") {
    return " | ";
  }
  if (nodeType === "tableCell" || nodeType === "tableHeader") {
    return "\n";
  }
  return "";
}

type TextIndexSegment = {
  start: number;
  end: number;
  from: number;
};

function buildDocTextIndex(doc: ProseMirrorNode): { text: string; segments: TextIndexSegment[] } {
  let text = "";
  const segments: TextIndexSegment[] = [];

  const appendSeparator = (value: string) => {
    if (!value) return;
    text += value;
  };

  const walk = (node: ProseMirrorNode, pos: number) => {
    if (node.isText) {
      const value = node.text ?? "";
      if (!value) return;
      const start = text.length;
      text += value;
      segments.push({ start, end: start + value.length, from: pos });
      return;
    }

    const separator = getNodeJoinSeparator(node.type.name);
    node.forEach((child, offset, index) => {
      walk(child, pos + offset + 1);
      if (index < node.childCount - 1) {
        appendSeparator(separator);
      }
    });
  };

  walk(doc, 0);
  return { text, segments };
}

function findPositionForOffset(
  segments: TextIndexSegment[],
  offset: number,
  side: "start" | "end"
): number | null {
  if (segments.length === 0) return null;

  for (let index = 0; index < segments.length; index += 1) {
    const segment = segments[index];
    const length = segment.end - segment.start;
    if (offset >= segment.start && offset <= segment.end) {
      return segment.from + Math.max(0, Math.min(length, offset - segment.start));
    }
    if (offset < segment.start) {
      const previous = segments[index - 1];
      if (side === "end" && previous) {
        return previous.from + (previous.end - previous.start);
      }
      return segment.from;
    }
  }

  const last = segments[segments.length - 1];
  return last.from + (last.end - last.start);
}

function getOffsetRange(
  doc: ProseMirrorNode,
  startOffset: number,
  endOffset: number,
  exactQuote?: string
): { from: number; to: number } | null {
  if (startOffset >= endOffset) return null;
  const index = buildDocTextIndex(doc);
  let resolvedStart = startOffset;
  let resolvedEnd = endOffset;
  const candidateText = index.text.slice(startOffset, endOffset);

  if (exactQuote && candidateText !== exactQuote) {
    const anchoredStart = index.text.indexOf(exactQuote);
    if (anchoredStart !== -1) {
      resolvedStart = anchoredStart;
      resolvedEnd = anchoredStart + exactQuote.length;
    }
  }

  const from = findPositionForOffset(index.segments, resolvedStart, "start");
  const to = findPositionForOffset(index.segments, resolvedEnd, "end");
  return from !== null && to !== null && from < to ? { from, to } : null;
}

function createAiAnnotationsExtension(config: {
  getAnnotations: () => AdvancedAnnotation[];
  getActiveId: () => string | null;
  onSelect: (id: string) => void;
}) {
  return Extension.create({
    name: "aiAnnotations",
    addProseMirrorPlugins() {
      return [
        new Plugin({
          key: AI_ANNOTATIONS_PLUGIN_KEY,
          props: {
            decorations: (state: { doc: ProseMirrorNode }) => {
              const decorations = config
                .getAnnotations()
                .map((annotation) => {
                  const range = getOffsetRange(
                    state.doc,
                    annotation.start_offset,
                    annotation.end_offset
                  );
                  if (!range) return null;
                  const isActive = config.getActiveId() === annotation.id;
                  const className = annotationSpanClass(annotation, isActive);
                  return Decoration.inline(range.from, range.to, {
                    class: `${className} ai-annotation-fragment`,
                    "data-annotation-id": annotation.id,
                  });
                })
                .filter((decoration): decoration is Decoration => decoration !== null);

              return DecorationSet.create(state.doc, decorations);
            },
            handleClick: (_view: EditorView, _pos: number, event: MouseEvent) => {
              const target = event.target as HTMLElement | null;
              const id = target?.closest<HTMLElement>("[data-annotation-id]")?.dataset.annotationId;
              if (!id) return false;
              config.onSelect(id);
              return false;
            },
          },
        }),
      ];
    },
  });
}

export function AdvancedAiEditor({ data, isAnalyzing = false, onDocumentChange }: AdvancedAiEditorProps) {
  const [editorText, setEditorText] = useState(data.full_text);
  const [annotations, setAnnotations] = useState<AdvancedAnnotation[]>(data.annotations);
  const [filter, setFilter] = useState<AnnotationFilter>("all");
  const [activeId, setActiveId] = useState<string | null>(data.annotations[0]?.id ?? null);
  const [manualEditWarning, setManualEditWarning] = useState(false);
  const [copyState, setCopyState] = useState<"idle" | "done" | "error">("idle");
  const [rewriteCopyState, setRewriteCopyState] = useState<"idle" | "done" | "error">("idle");
  const [downloadState, setDownloadState] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [formatPreset, setFormatPreset] = useState<EditorFormatPreset>("document");
  const [alignment, setAlignment] = useState<EditorAlignment>("justify");
  const [downloadMenuOpen, setDownloadMenuOpen] = useState(false);
  const [toolbarHeading, setToolbarHeading] = useState<"paragraph" | "heading1">("paragraph");
  const [toolbarFontFamily, setToolbarFontFamily] = useState(FONT_FAMILIES[1]?.value ?? "inherit");
  const [toolbarFontSize, setToolbarFontSize] = useState("16");
  const filteredAnnotationsRef = useRef<AdvancedAnnotation[]>(data.annotations);
  const activeIdRef = useRef<string | null>(data.annotations[0]?.id ?? null);
  const suppressManualWarningRef = useRef(false);
  const initialEditorSignatureRef = useRef("");
  const pageSurfaceRef = useRef<HTMLDivElement | null>(null);
  const [pageCount, setPageCount] = useState(1);
  const [currentPage, setCurrentPage] = useState(1);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        blockquote: false,
        codeBlock: false,
        horizontalRule: false,
      }),
      TextStyle,
      FontSize,
      FontFamily,
      Underline,
      Table.configure({
        resizable: false,
      }),
      TableRow,
      TableHeader,
      TableCell,
      Link.configure({
        openOnClick: false,
        autolink: false,
      }),
      TextAlign.configure({
        types: ["paragraph", "heading"],
      }),
      createAiAnnotationsExtension({
        getAnnotations: () => filteredAnnotationsRef.current,
        getActiveId: () => activeIdRef.current,
        onSelect: (id) => setActiveId(id),
      }),
    ],
    content: (data.rich_content as JSONContent | null | undefined) ?? textToDocJson(data.full_text),
    onUpdate: ({ editor: currentEditor }) => {
      setEditorText(buildDocTextIndex(currentEditor.state.doc).text);
      if (suppressManualWarningRef.current) {
        suppressManualWarningRef.current = false;
        return;
      }
      setManualEditWarning(true);
    },
    editorProps: {
      attributes: {
        class: "min-h-[960px] outline-none",
      },
    },
  });

  const syncToolbarState = useMemo(
    () => () => {
      if (!editor) return;
      setToolbarHeading(editor.isActive("heading", { level: 1 }) ? "heading1" : "paragraph");
      const textStyleAttrs = editor.getAttributes("textStyle");
      setToolbarFontFamily(textStyleAttrs.fontFamily || FONT_FAMILIES[1]?.value || "inherit");
      setToolbarFontSize((textStyleAttrs.fontSize || "16px").replace("px", ""));
      if (editor.isActive({ textAlign: "justify" })) {
        setAlignment("justify");
      } else if (editor.isActive({ textAlign: "center" })) {
        setAlignment("center");
      } else if (editor.isActive({ textAlign: "right" })) {
        setAlignment("right");
      } else {
        setAlignment("left");
      }
    },
    [editor]
  );

  useEffect(() => {
    setEditorText(data.full_text);
    setAnnotations(data.annotations);
    setFilter("all");
    setActiveId(data.annotations[0]?.id ?? null);
    setManualEditWarning(false);
    setCopyState("idle");
    setRewriteCopyState("idle");
    setDownloadState("idle");
    setFormatPreset("document");
    setAlignment("justify");
    setToolbarHeading("paragraph");
    setToolbarFontFamily(FONT_FAMILIES[1]?.value ?? "inherit");
    setToolbarFontSize("16");
    setDownloadMenuOpen(false);
    initialEditorSignatureRef.current = JSON.stringify(
      (data.rich_content as JSONContent | null | undefined) ?? textToDocJson(data.full_text)
    );
    suppressManualWarningRef.current = true;
    editor?.commands.setContent(
      (data.rich_content as JSONContent | null | undefined) ?? textToDocJson(data.full_text),
      { emitUpdate: false }
    );
  }, [data, editor]);

  useEffect(() => {
    if (!editor || !onDocumentChange) return;
    const emitChange = () => {
      const richContent = editor.getJSON() as Record<string, unknown>;
      const fullText = buildDocTextIndex(editor.state.doc).text;
      const isDirty = JSON.stringify(richContent) !== initialEditorSignatureRef.current;
      onDocumentChange({
        full_text: fullText,
        rich_content: richContent,
        source_format: data.source_format ?? "edited_document",
        is_dirty: isDirty,
      });
    };

    emitChange();
    editor.on("update", emitChange);
    return () => {
      editor.off("update", emitChange);
    };
  }, [editor, onDocumentChange, data.source_format]);

  useEffect(() => {
    if (!editor) return;
    syncToolbarState();
    editor.on("selectionUpdate", syncToolbarState);
    editor.on("transaction", syncToolbarState);
    return () => {
      editor.off("selectionUpdate", syncToolbarState);
      editor.off("transaction", syncToolbarState);
    };
  }, [editor, syncToolbarState]);

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

  useEffect(() => {
    filteredAnnotationsRef.current = filteredAnnotations;
    if (!editor) return;
    editor.view.dispatch(editor.state.tr.setMeta(AI_ANNOTATIONS_PLUGIN_KEY, Date.now()));
  }, [filteredAnnotations, editor]);

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

  useEffect(() => {
    activeIdRef.current = activeId;
    if (!editor) return;
    editor.view.dispatch(editor.state.tr.setMeta(AI_ANNOTATIONS_PLUGIN_KEY, Date.now()));
  }, [activeId, editor]);

  useEffect(() => {
    const surface = pageSurfaceRef.current;
    if (!surface) return;

    const measurePages = () => {
      const proseMirror = surface.querySelector(".ProseMirror") as HTMLElement | null;
      const contentHeight = proseMirror?.scrollHeight ?? surface.scrollHeight ?? VIRTUAL_PAGE_HEIGHT;
      const nextPageCount = Math.max(1, Math.ceil(contentHeight / VIRTUAL_PAGE_HEIGHT));
      setPageCount(nextPageCount);
    };

    measurePages();
    const resizeObserver = new ResizeObserver(() => {
      measurePages();
    });
    resizeObserver.observe(surface);
    const proseMirror = surface.querySelector(".ProseMirror") as HTMLElement | null;
    if (proseMirror) {
      resizeObserver.observe(proseMirror);
    }
    return () => {
      resizeObserver.disconnect();
    };
  }, [editor, editorText, formatPreset]);

  useEffect(() => {
    setCurrentPage((prev) => Math.min(prev, pageCount));
  }, [pageCount]);

  const handleCopyText = async () => {
    try {
      await navigator.clipboard.writeText(editorText);
      setCopyState("done");
    } catch {
      setCopyState("error");
    }
  };

  const handleDownload = async (format: "txt" | "pdf" | "docx") => {
    setDownloadMenuOpen(false);
    setDownloadState("loading");
    try {
      await downloadDocumentFile(editorText, format, "document-analyzer-edited", {
        preset: formatPreset,
        alignment,
      });
      setDownloadState("done");
    } catch {
      setDownloadState("error");
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
    if (!activeAnnotation || !editor) return;
    const range = getOffsetRange(
      editor.state.doc,
      activeAnnotation.start_offset,
      activeAnnotation.end_offset,
      activeAnnotation.exact_quote
    );
    if (!range) return;
    suppressManualWarningRef.current = true;
    editor
      .chain()
      .focus()
      .insertContentAt(range, activeAnnotation.suggested_rewrite)
      .run();
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
    if (!editor) return;
    const range = getOffsetRange(
      editor.state.doc,
      next.start_offset,
      next.end_offset,
      next.exact_quote
    );
    if (!range) return;
    editor.chain().focus().setTextSelection(range.from).scrollIntoView().run();
  };

  const activeExcerpt = activeAnnotation ? getAnnotationExcerpt(editorText, activeAnnotation) : "";
  const activePreset = FORMAT_PRESETS.find((preset) => preset.value === formatPreset) ?? FORMAT_PRESETS[0];
  const activeAlignment = ALIGNMENT_OPTIONS.find((option) => option.value === alignment) ?? ALIGNMENT_OPTIONS[0];
  const showAiLoadingState = isAnalyzing && annotations.length === 0;
  const currentPageOffset = Math.max(0, currentPage - 1) * VIRTUAL_PAGE_HEIGHT;

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
              {copyState === "done" ? "Скопировано" : copyState === "error" ? "Ошибка копирования" : "Копировать текст"}
            </Button>
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  setDownloadMenuOpen((prev) => !prev);
                }}
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-900 transition hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2"
              >
                Скачать
                <ChevronDown className="h-4 w-4 text-gray-500" />
              </button>
              {downloadMenuOpen && (
                <div className="absolute right-0 top-[calc(100%+0.5rem)] z-20 min-w-[180px] rounded-2xl border border-gray-200 bg-white p-2 shadow-xl">
                  <button
                    type="button"
                    onClick={() => void handleDownload("txt")}
                    className="w-full rounded-xl px-3 py-2 text-left text-sm text-gray-700 transition hover:bg-gray-100"
                  >
                    Скачать как TXT
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleDownload("pdf")}
                    className="w-full rounded-xl px-3 py-2 text-left text-sm text-gray-700 transition hover:bg-gray-100"
                  >
                    Скачать как PDF
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleDownload("docx")}
                    className="w-full rounded-xl px-3 py-2 text-left text-sm text-gray-700 transition hover:bg-gray-100"
                  >
                    Скачать как DOCX
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
        {downloadState !== "idle" && (
          <p className="text-xs text-gray-500">
            {downloadState === "loading"
              ? "Готовим файл..."
              : downloadState === "done"
                ? "Файл скачан"
                : "Не удалось скачать файл"}
          </p>
        )}
        <p className="text-xs text-gray-500">
          Формат: {activePreset.label}. Выравнивание: {activeAlignment.label.toLowerCase()}.
          {data.source_format === "docx" ? " Базовое форматирование DOCX сохранено в редакторе." : ""}
        </p>
      </Card>

      <div className="grid gap-6 2xl:grid-cols-[minmax(0,1fr)_360px]">
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
                  Назад
                </Button>
                <Button type="button" variant="ghost" onClick={() => handleNavigate(1)} disabled={filteredAnnotations.length === 0}>
                  Вперед
                </Button>
              </div>
            </div>
          </div>
          <div className="space-y-4 bg-[#edf1f5] p-4 sm:p-6 lg:p-8">
            {manualEditWarning && (
              <div className="mx-auto max-w-[980px] rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                После ручных правок подсветка может немного сместиться. AI-аннотации не пересчитываются в реальном времени.
              </div>
            )}
            <div className="mx-auto w-full max-w-[1180px]">
              <div className="mb-4 rounded-[24px] border border-gray-200 bg-white p-3 shadow-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    className={toolbarButtonClass()}
                    onClick={() => editor?.chain().focus().undo().run()}
                    disabled={!editor?.can().chain().focus().undo().run()}
                    aria-label="Undo"
                  >
                    <Undo2 className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    className={toolbarButtonClass()}
                    onClick={() => editor?.chain().focus().redo().run()}
                    disabled={!editor?.can().chain().focus().redo().run()}
                    aria-label="Redo"
                  >
                    <Redo2 className="h-4 w-4" />
                  </button>
                  <div className="mx-1 h-8 w-px bg-gray-200" />
                  <select
                    value={toolbarHeading}
                    onChange={(event) => {
                      const value = event.target.value as "paragraph" | "heading1";
                      setToolbarHeading(value);
                      if (!editor) return;
                      if (value === "heading1") {
                        editor.chain().focus().toggleHeading({ level: 1 }).run();
                        return;
                      }
                      editor.chain().focus().setParagraph().run();
                    }}
                    className="h-10 rounded-xl border border-gray-300 bg-white px-3 text-sm font-medium text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-300"
                  >
                    <option value="paragraph">Обычный текст</option>
                    <option value="heading1">Заголовок 1</option>
                  </select>
                  <select
                    value={toolbarFontFamily}
                    onChange={(event) => {
                      const value = event.target.value;
                      setToolbarFontFamily(value);
                      editor?.chain().focus().setFontFamily(value).run();
                    }}
                    className="h-10 rounded-xl border border-gray-300 bg-white px-3 text-sm font-medium text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-300"
                  >
                    {FONT_FAMILIES.map((family) => (
                      <option key={family.value} value={family.value}>
                        {family.label}
                      </option>
                    ))}
                  </select>
                  <select
                    value={toolbarFontSize}
                    onChange={(event) => {
                      const value = event.target.value;
                      setToolbarFontSize(value);
                      editor?.chain().focus().setMark("textStyle", { fontSize: `${value}px` }).run();
                    }}
                    className="h-10 w-[84px] rounded-xl border border-gray-300 bg-white px-3 text-sm font-medium text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-300"
                  >
                    {FONT_SIZES.map((size) => (
                      <option key={size} value={size}>
                        {size}
                      </option>
                    ))}
                  </select>
                  <div className="mx-1 h-8 w-px bg-gray-200" />
                  <button
                    type="button"
                    className={toolbarButtonClass(editor?.isActive("bold"))}
                    onClick={() => editor?.chain().focus().toggleBold().run()}
                    aria-label="Bold"
                  >
                    <Bold className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    className={toolbarButtonClass(editor?.isActive("italic"))}
                    onClick={() => editor?.chain().focus().toggleItalic().run()}
                    aria-label="Italic"
                  >
                    <Italic className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    className={toolbarButtonClass(editor?.isActive("underline"))}
                    onClick={() => editor?.chain().focus().toggleUnderline().run()}
                    aria-label="Underline"
                  >
                    <UnderlineIcon className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    className={toolbarButtonClass(editor?.isActive("strike"))}
                    onClick={() => editor?.chain().focus().toggleStrike().run()}
                    aria-label="Strike"
                  >
                    <Strikethrough className="h-4 w-4" />
                  </button>
                  <div className="mx-1 h-8 w-px bg-gray-200" />
                  <button
                    type="button"
                    className={toolbarButtonClass(toolbarHeading === "heading1")}
                    onClick={() => {
                      setToolbarHeading("heading1");
                      editor?.chain().focus().toggleHeading({ level: 1 }).run();
                    }}
                    aria-label="Heading 1"
                  >
                    <Heading1 className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    className={toolbarButtonClass(alignment === "left")}
                    onClick={() => {
                      setAlignment("left");
                      editor?.chain().focus().setTextAlign("left").run();
                    }}
                    aria-label="Align left"
                  >
                    <AlignLeft className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    className={toolbarButtonClass(alignment === "center")}
                    onClick={() => {
                      setAlignment("center");
                      editor?.chain().focus().setTextAlign("center").run();
                    }}
                    aria-label="Align center"
                  >
                    <AlignCenter className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    className={toolbarButtonClass(alignment === "right")}
                    onClick={() => {
                      setAlignment("right");
                      editor?.chain().focus().setTextAlign("right").run();
                    }}
                    aria-label="Align right"
                  >
                    <AlignRight className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    className={toolbarButtonClass(alignment === "justify")}
                    onClick={() => {
                      setAlignment("justify");
                      editor?.chain().focus().setTextAlign("justify").run();
                    }}
                    aria-label="Align justify"
                  >
                    <AlignJustify className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    className={toolbarButtonClass(editor?.isActive("bulletList"))}
                    onClick={() => editor?.chain().focus().toggleBulletList().run()}
                    aria-label="Bullet list"
                  >
                    <List className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    className={toolbarButtonClass(editor?.isActive("orderedList"))}
                    onClick={() => editor?.chain().focus().toggleOrderedList().run()}
                    aria-label="Ordered list"
                  >
                    <ListOrdered className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    className={toolbarButtonClass(editor?.isActive("link"))}
                    onClick={() => {
                      if (!editor) return;
                      const previousUrl = editor.getAttributes("link").href as string | undefined;
                      const url = window.prompt("Введите ссылку", previousUrl || "");
                      if (url === null) return;
                      if (url.trim() === "") {
                        editor.chain().focus().unsetLink().run();
                        return;
                      }
                      editor.chain().focus().setLink({ href: url.trim() }).run();
                    }}
                    aria-label="Link"
                  >
                    <Link2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
              <div className="mx-auto w-full">
                <div className="space-y-4">
                  <div
                    className="overflow-hidden rounded-[28px]"
                    style={{ height: `${VIRTUAL_PAGE_HEIGHT}px` }}
                  >
                    <div
                      ref={pageSurfaceRef}
                      className={`relative rounded-[28px] border border-gray-200 bg-white px-8 py-10 text-gray-800 shadow-[0_25px_80px_rgba(15,23,42,0.08)] outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 sm:px-12 sm:py-14 lg:px-20 lg:py-16 ${activePreset.className} [&_.ProseMirror]:min-h-[832px] [&_.ProseMirror]:outline-none [&_.ProseMirror_h1]:mb-5 [&_.ProseMirror_h1]:text-[2rem] [&_.ProseMirror_h1]:font-semibold [&_.ProseMirror_p]:my-3 [&_.ProseMirror_p]:whitespace-pre-wrap [&_.ProseMirror_table]:my-6 [&_.ProseMirror_table]:w-full [&_.ProseMirror_table]:border-collapse [&_.ProseMirror_td]:border [&_.ProseMirror_td]:border-gray-300 [&_.ProseMirror_td]:px-4 [&_.ProseMirror_td]:py-3 [&_.ProseMirror_th]:border [&_.ProseMirror_th]:border-gray-300 [&_.ProseMirror_th]:bg-gray-50 [&_.ProseMirror_th]:px-4 [&_.ProseMirror_th]:py-3 [&_.ProseMirror_ul]:my-4 [&_.ProseMirror_ul]:list-disc [&_.ProseMirror_ul]:pl-8 [&_.ProseMirror_ol]:my-4 [&_.ProseMirror_ol]:list-decimal [&_.ProseMirror_ol]:pl-8 transition-transform duration-300 ease-out`}
                      style={{ transform: `translateY(-${currentPageOffset}px)` }}
                    >
                      {pageCount > 1 ? (
                        <div className="pointer-events-none absolute inset-x-10 top-0 z-0 sm:inset-x-12 lg:inset-x-20">
                          {Array.from({ length: Math.max(0, pageCount - 1) }, (_, index) => index + 1).map((pageNumber) => (
                            <div
                              key={pageNumber}
                              className="absolute inset-x-0 border-t border-dashed border-gray-200"
                              style={{ top: `${pageNumber * VIRTUAL_PAGE_HEIGHT}px` }}
                            >
                              <div className="-mt-3 flex justify-center">
                                <span className="rounded-full border border-gray-200 bg-white px-3 py-1 text-[11px] font-medium text-gray-400 shadow-sm">
                                  Страница {pageNumber + 1}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : null}
                      <div className="relative z-10">
                        {editor ? <EditorContent editor={editor} /> : null}
                      </div>
                    </div>
                  </div>
                  {pageCount > 1 ? (
                    <div className="flex flex-wrap items-center justify-center gap-2">
                      {Array.from({ length: pageCount }, (_, index) => index + 1).map((pageNumber) => (
                        <button
                          key={pageNumber}
                          type="button"
                          onClick={() => setCurrentPage(pageNumber)}
                          className={`inline-flex h-10 min-w-10 items-center justify-center rounded-xl border px-3 text-sm font-medium transition ${
                            currentPage === pageNumber
                              ? "border-gray-900 bg-gray-900 text-white"
                              : "border-gray-300 bg-white text-gray-700 hover:border-gray-400 hover:text-gray-900"
                          }`}
                        >
                          {pageNumber}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        </Card>

        <div className="space-y-6 2xl:pt-[2px]">
          <Card>
            <h3 className="text-sm font-semibold text-gray-900">AI Inspector</h3>
            {showAiLoadingState ? (
              <div className="mt-4 rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-50 via-white to-orange-50 p-4">
                <div className="flex items-center gap-3">
                  <div className="relative h-10 w-10 rounded-2xl bg-amber-100">
                    <div className="absolute inset-2 rounded-full border-2 border-amber-400 border-t-transparent animate-spin" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900">AI размечает документ</p>
                    <p className="mt-1 text-sm text-gray-600">
                      Подготавливаем риски, улучшения и предлагаемые формулировки.
                    </p>
                  </div>
                </div>
                <div className="mt-4 space-y-3">
                  <div className="h-3 w-24 animate-pulse rounded-full bg-amber-100" />
                  <div className="h-4 w-full animate-pulse rounded-full bg-gray-100" />
                  <div className="h-4 w-5/6 animate-pulse rounded-full bg-gray-100" />
                  <div className="h-20 w-full animate-pulse rounded-2xl bg-white/80" />
                </div>
              </div>
            ) : activeAnnotation ? (
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
                  <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Исходный фрагмент</p>
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-gray-800">
                    {activeExcerpt || "Фрагмент недоступен"}
                  </p>
                </div>
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                  <p className="text-xs font-medium uppercase tracking-wide text-emerald-700">Предлагаемая формулировка</p>
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-emerald-900">
                    {activeAnnotation.suggested_rewrite}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="primary" onClick={handleApplyChange}>
                    Применить
                  </Button>
                  <Button type="button" variant="secondary" onClick={handleDismiss}>
                    Скрыть
                  </Button>
                  <Button type="button" variant="ghost" onClick={handleCopyRewrite}>
                    {rewriteCopyState === "done"
                      ? "Скопировано"
                      : rewriteCopyState === "error"
                        ? "Ошибка копирования"
                        : "Копировать"}
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
              <h3 className="text-sm font-semibold text-gray-900">Очередь замечаний</h3>
              <span className="text-xs text-gray-500">
                {showAiLoadingState ? "Идет анализ..." : `${filteredAnnotations.length} шт.`}
              </span>
            </div>
            {showAiLoadingState ? (
              <div className="mt-4 space-y-3">
                {[0, 1, 2].map((index) => (
                  <div
                    key={index}
                    className="rounded-2xl border border-gray-200 bg-gradient-to-br from-white to-gray-50 p-4"
                  >
                    <div className="flex items-center gap-2">
                      <div className="h-5 w-20 animate-pulse rounded-full bg-red-100" />
                      <div className="h-5 w-16 animate-pulse rounded-full bg-gray-100" />
                    </div>
                    <div className="mt-3 h-4 w-3/4 animate-pulse rounded-full bg-gray-100" />
                    <div className="mt-2 h-4 w-full animate-pulse rounded-full bg-gray-100" />
                    <div className="mt-2 h-4 w-5/6 animate-pulse rounded-full bg-gray-100" />
                  </div>
                ))}
              </div>
            ) : filteredAnnotations.length > 0 ? (
              <div className="mt-4 space-y-3">
                {filteredAnnotations.map((annotation) => (
                  <button
                    key={annotation.id}
                    type="button"
                    onClick={() => {
                      setActiveId(annotation.id);
                      if (!editor) return;
                      const range = getOffsetRange(
                        editor.state.doc,
                        annotation.start_offset,
                        annotation.end_offset,
                        annotation.exact_quote
                      );
                      if (!range) return;
                      editor.chain().focus().setTextSelection(range.from).scrollIntoView().run();
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
