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
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { SeverityBadge } from "@/components/tools/SeverityBadge";
import { isDocumentAnalyzerAiInspectorEnabled } from "@/lib/features/documentAnalyzerAiInspector";
import {
  downloadDocumentFile,
  type DownloadFormatPreset,
  type DownloadTextAlignment,
} from "@/lib/utils/downloadDocumentFile";

export type AdvancedAnnotation = {
  id: string;
  plugin_id?: string;
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
  showInspectorPanel?: boolean;
};

type AnnotationFilter = "all" | "risk" | "improvement";
type EditorFormatPreset = DownloadFormatPreset;
type EditorAlignment = DownloadTextAlignment;
type AppliedHighlight = {
  id: string;
  start_offset: number;
  end_offset: number;
};

const ANNOTATION_HIGHLIGHT_PLUGIN_KEY = new PluginKey("annotationHighlight");

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
  return "border-gray-200 bg-white text-gray-600";
}

function toolbarButtonClass(active = false): string {
  return `inline-flex h-10 w-10 items-center justify-center rounded-xl border text-gray-700 transition focus:outline-none focus:ring-2 focus:ring-gray-300 focus:ring-offset-2 ${
    active
      ? "border-gray-900 bg-gray-900 text-white"
      : "border-gray-300 bg-white"
  }`;
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

function shiftAppliedHighlights(
  highlights: AppliedHighlight[],
  startOffset: number,
  endOffset: number,
  nextTextLength: number
): AppliedHighlight[] {
  const delta = nextTextLength - (endOffset - startOffset);
  return highlights
    .filter((highlight) => highlight.end_offset <= startOffset || highlight.start_offset >= endOffset)
    .map((highlight) => {
      if (highlight.start_offset >= endOffset) {
        return {
          ...highlight,
          start_offset: highlight.start_offset + delta,
          end_offset: highlight.end_offset + delta,
        };
      }
      return highlight;
    });
}

function buildAnnotationDecorations(
  doc: ProseMirrorNode,
  annotations: AdvancedAnnotation[],
  activeId: string | null,
  appliedHighlights: AppliedHighlight[]
): DecorationSet {
  const decorations: Decoration[] = [];

  for (const annotation of annotations) {
    const range = getOffsetRange(doc, annotation.start_offset, annotation.end_offset, annotation.exact_quote);
    if (!range) continue;
    const isActive = activeId === annotation.id;
    decorations.push(
      Decoration.inline(range.from, range.to, {
        class:
          annotation.type === "risk"
            ? isActive
              ? "sa-annotation sa-annotation-risk sa-annotation-active"
              : "sa-annotation sa-annotation-risk"
            : isActive
              ? "sa-annotation sa-annotation-improvement sa-annotation-active"
              : "sa-annotation sa-annotation-improvement",
      })
    );
  }

  for (const highlight of appliedHighlights) {
    const range = getOffsetRange(doc, highlight.start_offset, highlight.end_offset);
    if (!range) continue;
    decorations.push(
      Decoration.inline(range.from, range.to, {
        class: "sa-annotation sa-annotation-applied",
      })
    );
  }

  return DecorationSet.create(doc, decorations);
}

function createAnnotationHighlightPlugin(
  annotations: AdvancedAnnotation[],
  activeId: string | null,
  appliedHighlights: AppliedHighlight[]
) {
  return new Plugin({
    key: ANNOTATION_HIGHLIGHT_PLUGIN_KEY,
    props: {
      decorations(state) {
        return buildAnnotationDecorations(state.doc, annotations, activeId, appliedHighlights);
      },
    },
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

export function AdvancedAiEditor({
  data,
  isAnalyzing = false,
  selectedAnnotationId,
  onSelectedAnnotationChange,
  onDocumentChange,
  showInspectorPanel,
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
  const [inspectorEnabled, setInspectorEnabled] = useState(showInspectorPanel ?? false);
  const [appliedHighlights, setAppliedHighlights] = useState<AppliedHighlight[]>([]);
  const suppressManualWarningRef = useRef(false);
  const initialEditorSignatureRef = useRef("");
  const editorScrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (typeof showInspectorPanel === "boolean") {
      setInspectorEnabled(showInspectorPanel);
      return;
    }

    let active = true;
    isDocumentAnalyzerAiInspectorEnabled().then((enabled) => {
      if (active) {
        setInspectorEnabled(enabled);
      }
    });
    return () => {
      active = false;
    };
  }, [showInspectorPanel]);

  // Memoize initial content so TipTap doesn't reset on every re-render.
  // Content updates are handled via the contentSignature useEffect below.
  const initialContent = useMemo(
    () => (data.rich_content as JSONContent | null | undefined) ?? textToDocJson(data.full_text),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  // Memoize extensions to keep a stable reference.
  const extensions = useMemo(
    () => [
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
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  // Use refs for onUpdate callbacks to avoid re-creating the editor on state changes.
  const onUpdateRef = useRef<(text: string) => void>(() => {});
  onUpdateRef.current = (text: string) => {
    setEditorText(text);
    if (suppressManualWarningRef.current) {
      suppressManualWarningRef.current = false;
      return;
    }
    setManualEditWarning(true);
  };

  // Memoize editorProps to keep a stable reference across renders.
  const editorProps = useMemo(
    () => ({
      attributes: {
        class: "min-h-[960px] outline-none",
      },
    }),
    []
  );

  // IMPORTANT: Do NOT pass `content` here. TipTap v3 useEditor internally calls
  // editor.setOptions() on every React re-render and compares options by reference.
  // Since parsed content becomes a ProseMirror Doc (different reference), the comparison
  // always fails, causing setOptions to reset the editor content on every render.
  // Instead, we set content via useEffect below (contentSignature effect).
  // Pass a stable deps array to useEditor's second argument.
  // With deps.length > 0, TipTap skips the compareOptions/setOptions path
  // (which causes infinite re-renders) and instead uses refreshEditorInstance
  // which only recreates the editor when deps actually change.
  const stableEditorDep = useMemo(() => "stable", []);
  const editor = useEditor(
    {
      immediatelyRender: false,
      editable: true,
      shouldRerenderOnTransaction: false,
      extensions,
      onUpdate: ({ editor: currentEditor }) => {
        onUpdateRef.current(buildDocTextIndex(currentEditor.state.doc).text);
      },
      editorProps,
    },
    [stableEditorDep]
  );

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

  // Stable content signature so we only reset the editor when the
  // underlying document actually changes (not on every re-render).
  const contentSignature = useMemo(
    () => JSON.stringify((data.rich_content as JSONContent | null | undefined) ?? textToDocJson(data.full_text)),
    [data.full_text, data.rich_content]
  );

  // Sync annotations from parent without resetting the editor content.
  // Use JSON signature to avoid re-running on every render (data.annotations is a new array each time).
  const annotationsSignature = useMemo(
    () => JSON.stringify(data.annotations.map((a) => a.id).sort()),
    [data.annotations]
  );
  useEffect(() => {
    setAnnotations(data.annotations);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [annotationsSignature]);

  useEffect(() => {
    setAppliedHighlights([]);
  }, [contentSignature]);

  // Reset editor only when the actual document content changes (new document loaded).
  useEffect(() => {
    setEditorText(data.full_text);
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
    initialEditorSignatureRef.current = contentSignature;
    suppressManualWarningRef.current = true;
    editor?.commands.setContent(
      (data.rich_content as JSONContent | null | undefined) ?? textToDocJson(data.full_text),
      { emitUpdate: false }
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contentSignature, editor]);

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

  useEffect(() => {
    if (!editor) return;
    const plugin = createAnnotationHighlightPlugin(annotations, activeId, appliedHighlights);
    editor.registerPlugin(plugin);
    return () => {
      editor.unregisterPlugin(ANNOTATION_HIGHLIGHT_PLUGIN_KEY);
    };
  }, [editor, annotations, activeId, appliedHighlights]);

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

  useEffect(() => {
    if (selectedAnnotationId === undefined) return;
    setActiveId(selectedAnnotationId);
  }, [selectedAnnotationId]);

  useEffect(() => {
    if (!onSelectedAnnotationChange) return;
    onSelectedAnnotationChange(activeId);
  }, [activeId, onSelectedAnnotationChange]);

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

    setAppliedHighlights((prev) => [
      ...shiftAppliedHighlights(prev, annotation.start_offset, annotation.end_offset, annotation.suggested_rewrite.length),
      {
        id: `${annotation.id}-applied`,
        start_offset: annotation.start_offset,
        end_offset: annotation.start_offset + annotation.suggested_rewrite.length,
      },
    ]);
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

  const handleApplyAnnotation = (annotation: AdvancedAnnotation) => {
    applyAnnotation(annotation);
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
      {manualEditWarning && (
        <div className="mx-auto max-w-[980px] rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          После ручных правок подсветка может немного сместиться. AI-аннотации не пересчитываются в реальном времени.
        </div>
      )}

      <div className="rounded-[24px] border border-gray-200 bg-white p-3 shadow-sm">
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

      <div className={`grid items-start gap-6 ${inspectorEnabled ? "2xl:grid-cols-[minmax(0,1fr)_360px]" : ""}`}>
        <div className="w-full">
          <div className="mx-auto w-full bg-gray-100 p-2 sm:p-3">
            <div
              ref={editorScrollRef}
              className="relative min-h-[1080px] max-h-[1080px] overflow-y-auto border border-gray-300 bg-white shadow-[2px_2px_8px_rgba(0,0,0,0.15)]"
            >
              <div
                className={`px-8 py-10 text-gray-800 outline-none sm:px-12 sm:py-14 lg:px-20 lg:py-16 ${activePreset.className} [&_.ProseMirror]:min-h-[832px] [&_.ProseMirror]:outline-none [&_.ProseMirror_h1]:mb-5 [&_.ProseMirror_h1]:text-[2rem] [&_.ProseMirror_h1]:font-semibold [&_.ProseMirror_p]:my-3 [&_.ProseMirror_p]:whitespace-pre-wrap [&_.ProseMirror_table]:my-6 [&_.ProseMirror_table]:w-full [&_.ProseMirror_table]:border-collapse [&_.ProseMirror_td]:border [&_.ProseMirror_td]:border-gray-300 [&_.ProseMirror_td]:px-4 [&_.ProseMirror_td]:py-3 [&_.ProseMirror_th]:border [&_.ProseMirror_th]:border-gray-300 [&_.ProseMirror_th]:bg-white [&_.ProseMirror_th]:px-4 [&_.ProseMirror_th]:py-3 [&_.ProseMirror_ul]:my-4 [&_.ProseMirror_ul]:list-disc [&_.ProseMirror_ul]:pl-8 [&_.ProseMirror_ol]:my-4 [&_.ProseMirror_ol]:list-decimal [&_.ProseMirror_ol]:pl-8 [&_.sa-annotation]:rounded-[0.35rem] [&_.sa-annotation]:px-0.5 [&_.sa-annotation]:py-[0.08rem] [&_.sa-annotation]:transition-colors [&_.sa-annotation-risk]:bg-red-100/90 [&_.sa-annotation-risk]:text-red-950 [&_.sa-annotation-improvement]:bg-amber-100/90 [&_.sa-annotation-improvement]:text-amber-950 [&_.sa-annotation-applied]:bg-emerald-100 [&_.sa-annotation-applied]:text-emerald-950 [&_.sa-annotation-active]:ring-2 [&_.sa-annotation-active]:ring-offset-1 [&_.sa-annotation-risk.sa-annotation-active]:ring-red-300 [&_.sa-annotation-improvement.sa-annotation-active]:ring-amber-300`}
              >
                {editor ? <EditorContent editor={editor} /> : null}
              </div>
            </div>
          </div>
        </div>

        {inspectorEnabled ? (
          <div className="space-y-6">
            <Card className="rounded-[26px] border-zinc-200 bg-[linear-gradient(180deg,#ffffff,#f8fafc)] shadow-[0_16px_50px_rgba(15,23,42,0.08)]">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-sm font-semibold uppercase tracking-[0.16em] text-zinc-700">AI Inspector</h3>
                <span className="rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-500">
                  Фокус
                </span>
              </div>
              {showAiLoadingState ? (
                <div className="mt-4 rounded-[24px] border border-amber-300 bg-[linear-gradient(135deg,#fff8e8,#fffef9_52%,#fff3dd)] p-4 shadow-[0_12px_34px_rgba(245,158,11,0.14)]">
                  <div className="flex items-start gap-3">
                    <div className="relative mt-1 h-11 w-11 shrink-0 rounded-2xl border border-amber-300 bg-amber-100/90">
                      <div className="absolute inset-2 rounded-full border-[2.5px] border-amber-500 border-t-transparent animate-spin" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[34px] font-semibold leading-[1.04] tracking-[-0.02em] text-zinc-900 sm:text-4xl">
                        AI размечает документ
                      </p>
                      <p className="mt-2 text-[15px] leading-7 text-zinc-600">
                        Подготавливаем риски, улучшения и предлагаемые формулировки.
                      </p>
                      <span className="mt-3 inline-flex rounded-full border border-amber-300 bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700">
                        В процессе
                      </span>
                    </div>
                  </div>
                  <div className="mt-4 space-y-3 rounded-2xl border border-amber-200/80 bg-white/80 p-3">
                    <div className="h-3 w-28 animate-pulse rounded-full bg-amber-200" />
                    <div className="h-4 w-full animate-pulse rounded-full bg-zinc-200" />
                    <div className="h-4 w-5/6 animate-pulse rounded-full bg-zinc-200" />
                    <div className="h-20 w-full animate-pulse rounded-2xl bg-zinc-100" />
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
                      {activeAnnotation.type === "risk" ? "Риск" : "Улучшение"}
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
                <div className="mt-4 rounded-2xl border border-dashed border-zinc-300 bg-zinc-50/80 p-4 text-sm leading-7 text-zinc-600">
                  Выберите фрагмент в документе или карточку в очереди.
                  <br />
                  Красный цвет показывает риски, желтый отмечает зоны для улучшения.
                </div>
              )}
            </Card>

            <Card className="flex flex-col rounded-[26px] border-zinc-200 bg-[linear-gradient(180deg,#ffffff,#f8fafc)] shadow-[0_16px_50px_rgba(15,23,42,0.08)]">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-sm font-semibold uppercase tracking-[0.16em] text-zinc-700">Очередь замечаний</h3>
                <span className="rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-500">
                  {showAiLoadingState ? "Идет анализ..." : `${filteredAnnotations.length} шт.`}
                </span>
              </div>
              {showAiLoadingState ? (
                <div className="relative mt-4">
                  <div className="h-[396px] space-y-3 overflow-y-auto pr-2">
                    {[0, 1, 2].map((index) => (
                      <div
                        key={index}
                        className="rounded-2xl border border-zinc-200 bg-[linear-gradient(135deg,#ffffff,#f8fafc)] p-4 shadow-[0_8px_24px_rgba(15,23,42,0.05)]"
                      >
                        <div className="flex items-center gap-2">
                          <div className="h-5 w-24 animate-pulse rounded-full bg-rose-100" />
                          <div className="h-5 w-20 animate-pulse rounded-full bg-zinc-200" />
                        </div>
                        <div className="mt-3 h-4 w-3/4 animate-pulse rounded-full bg-zinc-200" />
                        <div className="mt-2 h-4 w-full animate-pulse rounded-full bg-zinc-200" />
                        <div className="mt-2 h-4 w-5/6 animate-pulse rounded-full bg-zinc-200" />
                      </div>
                    ))}
                  </div>
                  <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-white via-white/85 to-transparent" />
                </div>
              ) : filteredAnnotations.length > 0 ? (
                <div className="relative mt-4">
                  <div className="h-[396px] space-y-3 overflow-y-auto pr-2">
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
                            : "border-gray-200 bg-white"
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
                          {annotation.type === "risk" ? "Риск" : "Улучшение"}
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
              <div className="mt-4 rounded-2xl border border-dashed border-emerald-300 bg-[linear-gradient(135deg,#ecfdf5,#d1fae5)] p-4 text-sm leading-7 text-emerald-900">
                Явных замечаний не найдено.
                <br />
                Можно продолжать работу с чистым извлеченным текстом.
              </div>
            )}
            </Card>
          </div>
        ) : null}
      </div>
    </div>
  );
}
