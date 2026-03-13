"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { MouseEvent as ReactMouseEvent } from "react";
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
  selectedAnnotationId?: string | null;
  onSelectedAnnotationChange?: (annotationId: string | null) => void;
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
      walk(child, pos + offset + (child.isText ? 0 : 1));
      if (index < node.childCount - 1 && separator) {
        text += separator;
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

function isWordChar(char: string | undefined): boolean {
  return Boolean(
    char && (char === "_" || /[0-9]/.test(char) || char.toLowerCase() !== char.toUpperCase())
  );
}

function expandOffsetsToWordBoundaries(
  text: string,
  startOffset: number,
  endOffset: number
): { start: number; end: number } {
  let start = Math.max(0, startOffset);
  let end = Math.min(text.length, endOffset);

  while (start > 0 && isWordChar(text[start]) && isWordChar(text[start - 1])) {
    start -= 1;
  }

  while (end < text.length && isWordChar(text[end - 1]) && isWordChar(text[end])) {
    end += 1;
  }

  return { start, end };
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
    const collectMatches = (haystack: string, needle: string): number[] => {
      const matches: number[] = [];
      let cursor = 0;
      while (true) {
        const found = haystack.indexOf(needle, cursor);
        if (found === -1) break;
        matches.push(found);
        cursor = found + 1;
      }
      return matches;
    };

    const exactMatches = collectMatches(index.text, exactQuote);
    const matches =
      exactMatches.length > 0
        ? exactMatches
        : collectMatches(index.text.toLocaleLowerCase(), exactQuote.toLocaleLowerCase());

    if (matches.length > 0) {
      const anchoredStart = matches.sort(
        (left, right) => Math.abs(left - startOffset) - Math.abs(right - startOffset)
      )[0];
      resolvedStart = anchoredStart;
      resolvedEnd = anchoredStart + exactQuote.length;
    }
  }

  const expanded = expandOffsetsToWordBoundaries(index.text, resolvedStart, resolvedEnd);
  resolvedStart = expanded.start;
  resolvedEnd = expanded.end;

  const from = findPositionForOffset(index.segments, resolvedStart, "start");
  const to = findPositionForOffset(index.segments, resolvedEnd, "end");
  return from !== null && to !== null && from < to ? { from, to } : null;
}

function createAiAnnotationsExtension(config: {
  getAnnotations: () => AdvancedAnnotation[];
  getActiveId: () => string | null;
  onSelect: (id: string, element: HTMLElement) => void;
  onHover: (id: string, element: HTMLElement) => void;
  onLeave: (relatedTarget: EventTarget | null) => void;
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
                    annotation.end_offset,
                    annotation.exact_quote
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
              const element = target?.closest<HTMLElement>("[data-annotation-id]");
              const id = element?.dataset.annotationId;
              if (!id || !element) return false;
              config.onSelect(id, element);
              return false;
            },
            handleDOMEvents: {
              mouseover: (_view: EditorView, event: Event) => {
                const target = event.target as HTMLElement | null;
                const element = target?.closest<HTMLElement>("[data-annotation-id]");
                const id = element?.dataset.annotationId;
                if (!id || !element) return false;
                config.onHover(id, element);
                return false;
              },
              mouseout: (_view: EditorView, event: Event) => {
                const mouseEvent = event as MouseEvent;
                const target = mouseEvent.target as HTMLElement | null;
                const sourceEl = target?.closest<HTMLElement>("[data-annotation-id]");
                if (!sourceEl) return false;
                // Don't leave if moving to another span of the same annotation
                const related = mouseEvent.relatedTarget as HTMLElement | null;
                const relatedEl = related?.closest<HTMLElement>("[data-annotation-id]");
                if (relatedEl?.dataset.annotationId === sourceEl.dataset.annotationId) return false;
                config.onLeave(mouseEvent.relatedTarget);
                return false;
              },
            },
          },
        }),
      ];
    },
  });
}

export function AdvancedAiEditor({
  data,
  isAnalyzing = false,
  selectedAnnotationId,
  onSelectedAnnotationChange,
  onDocumentChange,
}: AdvancedAiEditorProps) {
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
  const [hoveredAnnotationId, setHoveredAnnotationId] = useState<string | null>(null);
  const [hoverAnchorRect, setHoverAnchorRect] = useState<DOMRect | null>(null);
  const filteredAnnotationsRef = useRef<AdvancedAnnotation[]>(data.annotations);
  const activeIdRef = useRef<string | null>(data.annotations[0]?.id ?? null);
  const suppressManualWarningRef = useRef(false);
  const initialEditorSignatureRef = useRef("");
  const hoverHideTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const editorScrollRef = useRef<HTMLDivElement | null>(null);
  const popupRef = useRef<HTMLDivElement | null>(null);

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
        onSelect: (id, element) => {
          setActiveId(id);
          if (hoverHideTimeoutRef.current) {
            window.clearTimeout(hoverHideTimeoutRef.current);
            hoverHideTimeoutRef.current = null;
          }
          setHoveredAnnotationId(id);
          setHoverAnchorRect(element.getBoundingClientRect());
        },
        onHover: (id, element) => {
          if (hoverHideTimeoutRef.current) {
            window.clearTimeout(hoverHideTimeoutRef.current);
            hoverHideTimeoutRef.current = null;
          }
          setHoveredAnnotationId(id);
          setHoverAnchorRect(element.getBoundingClientRect());
        },
        onLeave: (relatedTarget) => {
          const nextTarget = relatedTarget as Node | null;
          if (nextTarget && popupRef.current?.contains(nextTarget)) {
            return;
          }
          hoverHideTimeoutRef.current = setTimeout(() => {
            setHoveredAnnotationId(null);
            setHoverAnchorRect(null);
            hoverHideTimeoutRef.current = null;
          }, 120);
        },
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
    setHoveredAnnotationId(null);
    setHoverAnchorRect(null);
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
  }, [activeId]);

  useEffect(() => {
    if (selectedAnnotationId === undefined) return;
    setActiveId(selectedAnnotationId);
  }, [selectedAnnotationId]);

  useEffect(() => {
    if (!onSelectedAnnotationChange) return;
    onSelectedAnnotationChange(activeId);
  }, [activeId, onSelectedAnnotationChange]);

  useEffect(() => {
    return () => {
      if (hoverHideTimeoutRef.current) {
        clearTimeout(hoverHideTimeoutRef.current);
      }
    };
  }, []);

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

  const applyAnnotation = (annotation: AdvancedAnnotation) => {
    if (!editor) return;
    const range = getOffsetRange(
      editor.state.doc,
      annotation.start_offset,
      annotation.end_offset,
      annotation.exact_quote
    );
    if (!range) return;
    suppressManualWarningRef.current = true;
    editor
      .chain()
      .focus()
      .insertContentAt(range, annotation.suggested_rewrite)
      .run();
    setAnnotations((prev) => shiftAnnotations(prev, annotation, annotation.suggested_rewrite.length));
    setActiveId(null);
    setManualEditWarning(false);
  };

  const handleApplyChange = () => {
    if (!activeAnnotation) return;
    applyAnnotation(activeAnnotation);
  };

  const handleDismiss = () => {
    if (!activeAnnotation) return;
    setAnnotations((prev) => prev.filter((annotation) => annotation.id !== activeAnnotation.id));
    setActiveId(null);
  };

  const closeHoverCard = () => {
    if (hoverHideTimeoutRef.current) {
      clearTimeout(hoverHideTimeoutRef.current);
      hoverHideTimeoutRef.current = null;
    }
    setHoveredAnnotationId(null);
    setHoverAnchorRect(null);
  };

  const handleApplyAnnotation = (annotation: AdvancedAnnotation) => {
    applyAnnotation(annotation);
    closeHoverCard();
  };

  const hoveredAnnotation = useMemo(
    () => filteredAnnotations.find((annotation) => annotation.id === hoveredAnnotationId) ?? null,
    [filteredAnnotations, hoveredAnnotationId]
  );

  const hoverPopupPosition = useMemo(() => {
    if (!hoverAnchorRect || !editorScrollRef.current) return null;
    const containerRect = editorScrollRef.current.getBoundingClientRect();
    const scrollTop = editorScrollRef.current.scrollTop;
    const top = Math.max(16, hoverAnchorRect.top - containerRect.top + scrollTop - 16);
    return { top };
  }, [hoverAnchorRect]);

  const handleHoverCardMouseEnter = () => {
    if (hoverHideTimeoutRef.current) {
      clearTimeout(hoverHideTimeoutRef.current);
      hoverHideTimeoutRef.current = null;
    }
  };

  const handleHoverCardMouseLeave = (event: ReactMouseEvent<HTMLDivElement>) => {
    const nextTarget = event.relatedTarget as Node | null;
    if (nextTarget?.parentElement?.closest("[data-annotation-id]")) {
      return;
    }
    closeHoverCard();
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

  return (
    <div className="space-y-6">
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
                <div ref={editorScrollRef} className="relative max-h-[80vh] overflow-y-auto rounded-[28px]">
                  <div
                    className={`rounded-[28px] border border-gray-200 bg-white px-8 py-10 text-gray-800 shadow-[0_25px_80px_rgba(15,23,42,0.08)] outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 sm:px-12 sm:py-14 lg:px-20 lg:py-16 ${activePreset.className} [&_.ProseMirror]:min-h-[832px] [&_.ProseMirror]:outline-none [&_.ProseMirror_h1]:mb-5 [&_.ProseMirror_h1]:text-[2rem] [&_.ProseMirror_h1]:font-semibold [&_.ProseMirror_p]:my-3 [&_.ProseMirror_p]:whitespace-pre-wrap [&_.ProseMirror_table]:my-6 [&_.ProseMirror_table]:w-full [&_.ProseMirror_table]:border-collapse [&_.ProseMirror_td]:border [&_.ProseMirror_td]:border-gray-300 [&_.ProseMirror_td]:px-4 [&_.ProseMirror_td]:py-3 [&_.ProseMirror_th]:border [&_.ProseMirror_th]:border-gray-300 [&_.ProseMirror_th]:bg-gray-50 [&_.ProseMirror_th]:px-4 [&_.ProseMirror_th]:py-3 [&_.ProseMirror_ul]:my-4 [&_.ProseMirror_ul]:list-disc [&_.ProseMirror_ul]:pl-8 [&_.ProseMirror_ol]:my-4 [&_.ProseMirror_ol]:list-decimal [&_.ProseMirror_ol]:pl-8`}
                  >
                    {editor ? <EditorContent editor={editor} /> : null}
                  </div>
                  {hoveredAnnotation && hoverPopupPosition ? (
                    <div
                      ref={popupRef}
                      onMouseEnter={handleHoverCardMouseEnter}
                      onMouseLeave={handleHoverCardMouseLeave}
                      className="absolute inset-x-0 z-30 px-8 sm:px-12 lg:px-20"
                      style={{
                        top: `${hoverPopupPosition.top}px`,
                        transform: "translateY(-100%)",
                      }}
                    >
                      <div className="animate-[annotation-popover-in_180ms_ease-out] rounded-[28px] border border-gray-200 bg-white/98 p-5 shadow-[0_24px_80px_rgba(15,23,42,0.18)] backdrop-blur sm:p-6">
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={`rounded-full border px-2.5 py-1 text-[11px] font-medium ${
                              hoveredAnnotation.type === "risk"
                                ? "border-red-200 bg-red-50 text-red-700"
                                : "border-amber-200 bg-amber-50 text-amber-700"
                            }`}
                          >
                            {hoveredAnnotation.type === "risk" ? "Risk" : "Improvement"}
                          </span>
                          <SeverityBadge severity={hoveredAnnotation.severity} />
                        </div>
                        <p className="mt-3 text-base font-semibold text-gray-900 sm:text-lg">{hoveredAnnotation.title}</p>
                        <p className="mt-2 max-w-4xl text-sm leading-6 text-gray-600 sm:text-base">{hoveredAnnotation.reason}</p>
                        <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 sm:p-5">
                          <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-emerald-700">
                            Предлагаемая формулировка
                          </p>
                          <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-emerald-900">
                            {hoveredAnnotation.suggested_rewrite}
                          </p>
                        </div>
                        <div className="mt-5 flex flex-wrap gap-3">
                          <Button type="button" variant="primary" onClick={() => handleApplyAnnotation(hoveredAnnotation)}>
                            Применить
                          </Button>
                          <Button type="button" variant="secondary" onClick={closeHoverCard}>
                            Отмена
                          </Button>
                        </div>
                      </div>
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

          <Card className="flex flex-col">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-sm font-semibold text-gray-900">Очередь замечаний</h3>
              <span className="text-xs text-gray-500">
                {showAiLoadingState ? "Идет анализ..." : `${filteredAnnotations.length} шт.`}
              </span>
            </div>
            {showAiLoadingState ? (
              <div className="relative mt-4">
                <div className="h-[792px] space-y-3 overflow-y-auto pr-2">
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
                <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-white via-white/85 to-transparent" />
              </div>
            ) : filteredAnnotations.length > 0 ? (
              <div className="relative mt-4">
                <div className="h-[792px] space-y-3 overflow-y-auto pr-2">
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
                      className={`w-full rounded-2xl border p-4 text-left transition-colors ${
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
                      <p className="mt-3 line-clamp-2 text-sm font-medium">{annotation.title}</p>
                      <p
                        className={`mt-2 line-clamp-4 text-sm leading-6 ${
                          activeAnnotation?.id === annotation.id ? "text-white/80" : "text-gray-600"
                        }`}
                      >
                        {annotation.reason}
                      </p>
                    </button>
                  ))}
                </div>
                {filteredAnnotations.length > 3 ? (
                  <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-white via-white/85 to-transparent" />
                ) : null}
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
