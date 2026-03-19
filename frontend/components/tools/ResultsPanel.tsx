"use client";

import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { SeverityBadge } from "@/components/tools/SeverityBadge";
import { ChecklistView } from "@/components/tools/ChecklistView";
import { JsonActions } from "@/components/tools/JsonActions";

type AnalysisStage = "upload" | "analyze" | "review" | "done";
type DocumentViewMode = "summary" | "advanced";

type ResultsPanelProps = {
  status: "idle" | "loading" | "success" | "error";
  result?: Record<string, unknown>;
  toolSlug?: string;
  errorMessage?: string;
  showUpgradeCta?: boolean;
  stage?: AnalysisStage;
  elapsedSec?: number;
  documentView?: DocumentViewMode;
};

const KEY_LABELS: Record<string, string> = {
  summary: "Резюме",
  key_points: "Ключевые пункты",
  risks: "Риски",
  important_dates: "Важные даты",
  risky_clauses: "Рисковые пункты",
  penalties: "Штрафы",
  obligations: "Обязательства",
  deadlines: "Сроки",
  checklist: "Чеклист",
  fields: "Поля",
  tables: "Таблицы",
  confidence: "Уверенность",
  risk_score: "Балл риска",
  key_risks: "Ключевые риски",
  risk_drivers: "Драйверы риска",
  recommendations: "Рекомендации",
  dispute_overview: "Контекст спора",
  regions: "Регионы",
  court_positions: "Подходы судов",
  cited_cases: "Судебные акты",
  legal_basis: "Нормы права",
  practical_takeaways: "Практические выводы",
};

function formatKey(key: string): string {
  if (KEY_LABELS[key]) return KEY_LABELS[key];
  return key
    .replace(/_/g, " ")
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (s) => s.toUpperCase())
    .trim();
}

function isEmpty(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === "string" && !value.trim()) return true;
  if (Array.isArray(value) && value.length === 0) return true;
  return false;
}

function renderValue(value: unknown): React.ReactNode {
  if (isEmpty(value)) return <span className="text-gray-400">Не найдено</span>;
  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);
  if (typeof value === "boolean") return value ? "Да" : "Нет";
  if (Array.isArray(value)) {
    if (value.length === 0) return <span className="text-gray-400">Не найдено</span>;
    return (
      <ul className="list-inside list-disc space-y-1">
        {value.map((item, i) => (
          <li key={i}>{renderValue(item)}</li>
        ))}
      </ul>
    );
  }
  if (typeof value === "object") {
    return (
      <pre className="overflow-auto rounded bg-gray-50 p-2 text-xs">
        {JSON.stringify(value, null, 2)}
      </pre>
    );
  }
  return String(value);
}

function isContractCheckerResult(r: Record<string, unknown>): r is {
  summary: string;
  risky_clauses: Array<{ title: string; reason: string; severity: string }>;
  penalties: Array<{ trigger: string; amount_or_formula: string }>;
  obligations: Array<{ party: string; text: string }>;
  deadlines: Array<{ date: string; description: string }>;
  checklist: Array<{ item: string; status: string; note: string }>;
} {
  return (
    typeof r.summary === "string" &&
    Array.isArray(r.risky_clauses) &&
    Array.isArray(r.penalties) &&
    Array.isArray(r.obligations) &&
    Array.isArray(r.deadlines) &&
    Array.isArray(r.checklist)
  );
}

function isDataExtractorResult(r: Record<string, unknown>): r is {
  summary: string;
  left_document_summary: string;
  right_document_summary: string;
  common_points: string[];
  differences: string[];
  relation_assessment: string;
  are_documents_related: boolean;
} {
  return (
    typeof r.summary === "string" &&
    typeof r.left_document_summary === "string" &&
    typeof r.right_document_summary === "string" &&
    Array.isArray(r.common_points) &&
    Array.isArray(r.differences) &&
    typeof r.relation_assessment === "string" &&
    typeof r.are_documents_related === "boolean"
  );
}

function isHandwritingRecognitionResult(r: Record<string, unknown>): r is {
  recognized_text: string;
  confidence: number;
  page_count: number;
  template_id?: string | null;
  ocr_model_id?: string | null;
  needs_review_count?: number;
  lines: Array<{
    text: string;
    confidence: number;
    model_id?: string | null;
    page_index?: number;
    field_name?: string | null;
    source?: string | null;
    needs_review?: boolean;
    bbox?: { x: number; y: number; width: number; height: number } | null;
  }>;
} {
  return (
    typeof r.recognized_text === "string" &&
    typeof r.confidence === "number" &&
    typeof r.page_count === "number" &&
    Array.isArray(r.lines)
  );
}

function isTenderAnalyzerResult(r: Record<string, unknown>): r is {
  summary: string;
  dispute_overview: string;
  regions: string[];
  court_positions: Array<{ court: string; position: string; relevance: string }>;
  cited_cases: Array<{ title: string; citation: string; url: string; takeaway: string }>;
  legal_basis: string[];
  practical_takeaways: string[];
} {
  return (
    typeof r.summary === "string" &&
    typeof r.dispute_overview === "string" &&
    Array.isArray(r.regions) &&
    Array.isArray(r.court_positions) &&
    Array.isArray(r.cited_cases) &&
    Array.isArray(r.legal_basis) &&
    Array.isArray(r.practical_takeaways)
  );
}

function DataExtractorResultView({
  result,
}: {
  result: {
    summary: string;
    left_document_summary: string;
    right_document_summary: string;
    common_points: string[];
    differences: string[];
    relation_assessment: string;
    are_documents_related: boolean;
  };
}) {
  const relatedTone = result.are_documents_related
    ? "border-emerald-300/70 bg-emerald-100/80 text-emerald-900"
    : "border-amber-300/70 bg-amber-100/80 text-amber-900";
  const metricCards = [
    {
      label: "Совпадения",
      value: String(result.common_points.length),
      note: "точек пересечения",
      tone: "border-emerald-200 bg-emerald-50/80 text-emerald-900",
    },
    {
      label: "Различия",
      value: String(result.differences.length),
      note: "ключевых сдвигов",
      tone: "border-stone-300 bg-stone-50/90 text-stone-900",
    },
    {
      label: "Связь",
      value: result.are_documents_related ? "Да" : "Нет",
      note: "единый предмет",
      tone: result.are_documents_related
        ? "border-emerald-200 bg-white/80 text-emerald-900"
        : "border-amber-200 bg-amber-50/80 text-amber-900",
    },
  ];

  return (
    <div className="space-y-6">
      <div className="overflow-hidden rounded-[32px] border border-stone-300 bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.96),_rgba(246,240,229,0.98)_54%,_rgba(234,226,214,0.98))] shadow-[0_30px_100px_rgba(28,25,23,0.12)]">
        <div className="grid gap-5 border-b border-stone-300/80 px-5 py-5 sm:px-7 lg:grid-cols-[minmax(0,1.2fr)_240px] lg:items-start">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-stone-500">Общий итог</p>
            <h3 className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-stone-900 sm:text-[2rem]">Итог сравнения</h3>
            <p className="mt-4 max-w-3xl text-sm leading-7 text-stone-700 sm:text-[15px]">{result.summary}</p>
          </div>
          <div className="space-y-3">
            <div className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${relatedTone}`}>
              {result.are_documents_related ? "Документы связаны" : "Документы о разном"}
            </div>
            <div className="rounded-[26px] border border-stone-300/80 bg-white/70 p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-stone-500">Индикатор</p>
              <p className="mt-3 text-3xl font-semibold tracking-[-0.05em] text-stone-900">
                {result.are_documents_related ? "Высокий" : "Низкий"}
              </p>
              <p className="mt-2 text-sm leading-6 text-stone-600">
                Быстрый индикатор того, насколько два файла относятся к одному предмету регулирования или одной версии документа.
              </p>
            </div>
          </div>
        </div>

        <div className="grid gap-px border-b border-stone-300/80 bg-stone-300/80 md:grid-cols-3">
          {metricCards.map((item) => (
            <div key={item.label} className={`px-5 py-4 sm:px-7 ${item.tone}`}>
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] opacity-70">{item.label}</p>
              <div className="mt-2 flex items-end gap-2">
                <span className="text-3xl font-semibold tracking-[-0.05em]">{item.value}</span>
                <span className="pb-1 text-xs uppercase tracking-[0.2em] opacity-70">{item.note}</span>
              </div>
            </div>
          ))}
        </div>

        <div className="grid gap-px bg-stone-300/80 lg:grid-cols-2">
          {[
            ["Левая сторона", result.left_document_summary],
            ["Правая сторона", result.right_document_summary],
          ].map(([title, text], index) => (
            <div key={title} className={`bg-white/75 px-5 py-5 sm:px-7 ${index === 0 ? "lg:border-r lg:border-stone-300/80" : ""}`}>
              <div className="mb-4 flex items-center justify-between gap-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-stone-500">{title}</p>
                <span className="rounded-full bg-stone-900 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-stone-50">
                  Кратко
                </span>
              </div>
              <p className="text-sm leading-7 text-stone-700">{text}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
        <Card className="rounded-[30px] border-emerald-200 bg-[linear-gradient(180deg,rgba(240,253,250,0.98),rgba(236,253,245,0.9))] p-0 shadow-[0_26px_80px_rgba(16,185,129,0.08)] hover:shadow-[0_26px_80px_rgba(16,185,129,0.08)]">
          <div className="border-b border-emerald-200 px-6 py-5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-emerald-700">Общее</p>
            <h3 className="mt-2 text-xl font-semibold tracking-[-0.04em] text-stone-900">Общее между документами</h3>
          </div>
          <div className="px-6 py-5">
            {result.common_points.length > 0 ? (
              <ul className="space-y-3">
                {result.common_points.map((item, index) => (
                  <li
                    key={`${index}-${item.slice(0, 32)}`}
                    className="grid grid-cols-[auto_minmax(0,1fr)] gap-3 rounded-2xl border border-emerald-200 bg-white/80 px-4 py-3"
                  >
                    <span className="mt-0.5 inline-flex h-7 w-7 items-center justify-center rounded-full border border-emerald-300 bg-emerald-50 text-[11px] font-semibold text-emerald-700">
                      {index + 1}
                    </span>
                    <span className="text-sm leading-6 text-stone-700">{item}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-stone-500">Существенных пересечений не найдено.</p>
            )}
          </div>
        </Card>

        <Card className="rounded-[30px] border-stone-300 bg-white/90 shadow-[0_26px_70px_rgba(28,25,23,0.1)]">
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-stone-500">Различия</p>
          <h3 className="mt-2 text-xl font-semibold tracking-[-0.04em] text-stone-900">Ключевые различия</h3>
          {result.differences.length > 0 ? (
            <ul className="mt-5 space-y-4">
              {result.differences.map((item, index) => (
                <li
                  key={`${index}-${item.slice(0, 32)}`}
                  className="grid grid-cols-[auto_minmax(0,1fr)] gap-4 rounded-[22px] border border-stone-200 bg-stone-50/80 px-4 py-4"
                >
                  <span className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-stone-300 bg-white text-[11px] font-semibold uppercase tracking-[0.14em] text-stone-600">
                    {index + 1}
                  </span>
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-stone-500">Изменение</p>
                    <p className="mt-2 text-sm leading-6 text-stone-700">{item}</p>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-5 text-sm text-gray-400">Содержательных различий не найдено.</p>
          )}
        </Card>
      </div>

      <Card className="rounded-[30px] border-stone-300 bg-[linear-gradient(135deg,rgba(255,255,255,0.95),rgba(240,253,244,0.88))] shadow-[0_22px_70px_rgba(16,185,129,0.08)]">
        <div>
          <h3 className="text-xl font-semibold tracking-[-0.04em] text-stone-900">Оценка связи между документами</h3>
          <p className="mt-3 text-sm leading-7 text-stone-700">{result.relation_assessment}</p>
        </div>
      </Card>

    </div>
  );
}

function TenderAnalyzerResultView({
  result,
}: {
  result: {
    summary: string;
    dispute_overview: string;
    regions: string[];
    court_positions: Array<{ court: string; position: string; relevance: string }>;
    cited_cases: Array<{ title: string; citation: string; url: string; takeaway: string }>;
    legal_basis: string[];
    practical_takeaways: string[];
  };
}) {
  const emptyNote = <span className="text-sm text-gray-400">Не найдено</span>;

  return (
    <div className="space-y-6">
      <Card>
        <h3 className="text-sm font-semibold text-gray-700">Итог обзора</h3>
        <p className="mt-2 text-sm leading-6 text-gray-600">{result.summary || emptyNote}</p>
      </Card>
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.3fr)_minmax(240px,0.7fr)]">
        <Card>
          <h3 className="text-sm font-semibold text-gray-700">Контекст спора</h3>
          <p className="mt-2 text-sm leading-6 text-gray-600">{result.dispute_overview || emptyNote}</p>
        </Card>
        <Card>
          <h3 className="text-sm font-semibold text-gray-700">Регионы практики</h3>
          <div className="mt-3 flex flex-wrap gap-2">
            {result.regions.length > 0
              ? result.regions.map((region) => (
                  <span key={region} className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
                    {region}
                  </span>
                ))
              : emptyNote}
          </div>
        </Card>
      </div>
      <Card>
        <h3 className="mb-3 text-sm font-semibold text-gray-700">Подходы судов</h3>
        {result.court_positions.length > 0 ? (
          <ul className="space-y-3">
            {result.court_positions.map((item, index) => (
              <li key={`${index}-${item.court}`} className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                <p className="text-sm font-semibold text-gray-900">{item.court}</p>
                <p className="mt-2 text-sm leading-6 text-gray-600">{item.position}</p>
                <p className="mt-2 text-xs leading-5 text-gray-500">{item.relevance}</p>
              </li>
            ))}
          </ul>
        ) : emptyNote}
      </Card>
      <Card>
        <h3 className="mb-3 text-sm font-semibold text-gray-700">Судебные акты</h3>
        {result.cited_cases.length > 0 ? (
          <ul className="space-y-3">
            {result.cited_cases.map((item, index) => (
              <li key={`${index}-${item.citation}`} className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-gray-900">{item.title}</p>
                  <span className="rounded-full bg-white px-2.5 py-1 text-xs font-medium text-gray-600">{item.citation}</span>
                </div>
                <p className="mt-2 text-sm leading-6 text-gray-600">{item.takeaway}</p>
                <a
                  href={item.url}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-3 inline-flex text-sm font-medium text-emerald-700 hover:text-emerald-800"
                >
                  Открыть источник
                </a>
              </li>
            ))}
          </ul>
        ) : emptyNote}
      </Card>
      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <h3 className="mb-3 text-sm font-semibold text-gray-700">Применимые нормы права</h3>
          {result.legal_basis.length > 0 ? (
            <ul className="list-inside list-disc space-y-2 text-sm leading-6 text-gray-600">
              {result.legal_basis.map((item, index) => (
                <li key={`${index}-${item.slice(0, 24)}`}>{item}</li>
              ))}
            </ul>
          ) : emptyNote}
        </Card>
        <Card>
          <h3 className="mb-3 text-sm font-semibold text-gray-700">Практические выводы</h3>
          {result.practical_takeaways.length > 0 ? (
            <ul className="list-inside list-disc space-y-2 text-sm leading-6 text-gray-600">
              {result.practical_takeaways.map((item, index) => (
                <li key={`${index}-${item.slice(0, 24)}`}>{item}</li>
              ))}
            </ul>
          ) : emptyNote}
        </Card>
      </div>
      <JsonActions data={result as unknown as Record<string, unknown>} filename="case-law-review-result.json" />
    </div>
  );
}

function HandwritingRecognitionResultView({
  result,
}: {
  result: {
    recognized_text: string;
    confidence: number;
    page_count: number;
    template_id?: string | null;
    ocr_model_id?: string | null;
    needs_review_count?: number;
    lines: Array<{
      text: string;
      confidence: number;
      model_id?: string | null;
      page_index?: number;
      field_name?: string | null;
      source?: string | null;
      needs_review?: boolean;
      bbox?: { x: number; y: number; width: number; height: number } | null;
    }>;
  };
}) {
  const confidencePercent = Math.round((result.confidence || 0) * 100);
  const templateLabel = result.template_id?.trim() ? result.template_id : "generic";
  const modelLabel = result.ocr_model_id?.trim() ? result.ocr_model_id : "n/a";
  const reviewCount = result.needs_review_count || result.lines.filter((line) => line.needs_review).length;

  return (
    <div className="space-y-6">
      <Card>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <div>
            <h3 className="mb-2 text-sm font-semibold text-gray-700">Уверенность</h3>
            <p className="text-sm text-gray-600">{confidencePercent}%</p>
          </div>
          <div>
            <h3 className="mb-2 text-sm font-semibold text-gray-700">Страницы</h3>
            <p className="text-sm text-gray-600">{result.page_count}</p>
          </div>
          <div>
            <h3 className="mb-2 text-sm font-semibold text-gray-700">Шаблон</h3>
            <p className="text-sm text-gray-600">{templateLabel}</p>
          </div>
          <div>
            <h3 className="mb-2 text-sm font-semibold text-gray-700">OCR модель</h3>
            <p className="text-sm text-gray-600 break-all">{modelLabel}</p>
          </div>
          <div>
            <h3 className="mb-2 text-sm font-semibold text-gray-700">Требуют проверки</h3>
            <p className="text-sm text-gray-600">{reviewCount}</p>
          </div>
        </div>
      </Card>
      <Card>
        <h3 className="mb-3 text-sm font-semibold text-gray-700">Распознанный текст</h3>
        {result.recognized_text.trim() ? (
          <pre className="whitespace-pre-wrap break-words rounded-2xl bg-gray-50 p-4 text-sm leading-6 text-gray-700">
            {result.recognized_text}
          </pre>
        ) : (
          <p className="text-sm text-gray-400">Текст не распознан</p>
        )}
      </Card>
      <Card>
        <h3 className="mb-3 text-sm font-semibold text-gray-700">Распознанные строки</h3>
        {result.lines.length > 0 ? (
          <ul className="space-y-2">
            {result.lines.map((line, index) => (
              <li
                key={`${index}-${line.text.slice(0, 24)}`}
                className={`rounded-xl border p-3 ${
                  line.needs_review ? "border-amber-200 bg-amber-50" : "border-gray-200 bg-gray-50"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <p className="text-sm text-gray-700">{line.text}</p>
                    <div className="flex flex-wrap gap-2 text-xs text-gray-500">
                      {line.field_name ? <span>Поле: {line.field_name}</span> : null}
                      {typeof line.page_index === "number" ? <span>Страница: {line.page_index + 1}</span> : null}
                      {line.model_id ? <span>Модель: {line.model_id}</span> : null}
                      {line.source ? <span>Источник: {line.source}</span> : null}
                      {line.bbox ? (
                        <span>
                          bbox: {line.bbox.x},{line.bbox.y},{line.bbox.width},{line.bbox.height}
                        </span>
                      ) : null}
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <span className="block text-xs text-gray-500">
                      {Math.round((line.confidence || 0) * 100)}%
                    </span>
                    {line.needs_review ? <span className="mt-1 block text-xs font-medium text-amber-700">Нужна проверка</span> : null}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-gray-400">Нет строк для отображения</p>
        )}
      </Card>
    </div>
  );
}

function ContractCheckerResultView({
  result,
}: {
  result: {
    summary: string;
    risky_clauses: Array<{ title: string; reason: string; severity: string }>;
    penalties: Array<{ trigger: string; amount_or_formula: string }>;
    obligations: Array<{ party: string; text: string }>;
    deadlines: Array<{ date: string; description: string }>;
    checklist: Array<{ item: string; status: string; note: string }>;
  };
}) {
  const byParty = result.obligations.reduce<Record<string, Array<{ party: string; text: string }>>>(
    (acc, o) => {
      const p = o.party || "other";
      if (!acc[p]) acc[p] = [];
      acc[p].push(o);
      return acc;
    },
    {}
  );
  const emptyNote = <span className="text-sm text-gray-400">Не найдено</span>;
  return (
    <div className="space-y-6">
      <Card>
        <h3 className="text-sm font-semibold text-gray-700">Резюме</h3>
        <p className="mt-2 text-sm text-gray-600">{result.summary || emptyNote}</p>
      </Card>
      <Card>
        <h3 className="mb-3 text-sm font-semibold text-gray-700">Рисковые пункты</h3>
        {result.risky_clauses.length > 0 ? (
          <ul className="space-y-3">
            {result.risky_clauses.map((c, i) => (
              <li key={i} className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium text-gray-900">{c.title}</span>
                  <SeverityBadge severity={c.severity} />
                </div>
                <p className="mt-1 text-sm text-gray-600">{c.reason}</p>
              </li>
            ))}
          </ul>
        ) : emptyNote}
      </Card>
      <Card>
        <h3 className="mb-3 text-sm font-semibold text-gray-700">Штрафы</h3>
        {result.penalties.length > 0 ? (
          <ul className="list-inside list-disc space-y-1 text-sm text-gray-600">
            {result.penalties.map((p, i) => (
              <li key={i}>
                {p.trigger} — {p.amount_or_formula}
              </li>
            ))}
          </ul>
        ) : emptyNote}
      </Card>
      <Card>
        <h3 className="mb-3 text-sm font-semibold text-gray-700">Обязательства</h3>
        {result.obligations.length > 0 ? (
          <div className="space-y-4">
            {Object.entries(byParty).map(([party, list]) => (
              <div key={party}>
                <h4 className="text-xs font-medium uppercase tracking-wide text-gray-500">
                  {party}
                </h4>
                <ul className="mt-1 list-inside list-disc space-y-1 text-sm text-gray-600">
                  {list.map((o, i) => (
                    <li key={i}>{o.text}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        ) : emptyNote}
      </Card>
      <Card>
        <h3 className="mb-3 text-sm font-semibold text-gray-700">Сроки</h3>
        {result.deadlines.length > 0 ? (
          <ul className="space-y-2 text-sm text-gray-600">
            {result.deadlines.map((d, i) => (
              <li key={i}>
                <span className="font-medium text-gray-700">{d.date}</span> — {d.description}
              </li>
            ))}
          </ul>
        ) : emptyNote}
      </Card>
      <Card>
        <h3 className="mb-3 text-sm font-semibold text-gray-700">Чеклист</h3>
        <ChecklistView items={result.checklist} />
      </Card>
    </div>
  );
}

function isDocumentAnalyzerResult(r: Record<string, unknown>): r is {
  summary: string;
  key_points: string[];
  risks: string[];
  important_dates: Array<{ date: string; description: string }>;
} {
  return (
    typeof r.summary === "string" &&
    Array.isArray(r.key_points) &&
    Array.isArray(r.risks) &&
    Array.isArray(r.important_dates)
  );
}

function DocumentAnalyzerSummaryView({
  result,
}: {
  result: {
    summary: string;
    key_points: string[];
    risks: string[];
    important_dates: Array<{ date: string; description: string }>;
  };
}) {
  return (
    <div className="space-y-4">
      <Card>
        <h3 className="text-sm font-semibold text-gray-700">Резюме</h3>
        <div className="mt-2 text-sm text-gray-600">{renderValue(result.summary)}</div>
      </Card>
      <Card>
        <h3 className="text-sm font-semibold text-gray-700">Ключевые пункты</h3>
        <div className="mt-2 text-sm text-gray-600">{renderValue(result.key_points)}</div>
      </Card>
      <Card>
        <h3 className="text-sm font-semibold text-gray-700">Риски</h3>
        <div className="mt-2 text-sm text-gray-600">{renderValue(result.risks)}</div>
      </Card>
      <Card>
        <h3 className="text-sm font-semibold text-gray-700">Важные даты</h3>
        <div className="mt-2 text-sm text-gray-600">{renderValue(result.important_dates)}</div>
      </Card>
    </div>
  );
}

const STAGE_LABELS: Record<AnalysisStage, string> = {
  upload: "Загрузка файла…",
  analyze: "Анализ документа (LLM)…",
  review: "Размечаем документ и готовим AI-редактор…",
  done: "Готово",
};

function formatTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  if (m > 0) return `${m} мин ${s} сек`;
  return `${s} сек`;
}

function AnalysisProgress({
  stage,
  elapsedSec,
  toolSlug,
  documentView = "summary",
}: {
  stage?: AnalysisStage;
  elapsedSec: number;
  toolSlug?: string;
  documentView?: DocumentViewMode;
}) {
  const steps: AnalysisStage[] = toolSlug === "document-analyzer" ? ["upload", "analyze", "review", "done"] : ["upload", "analyze", "done"];
  const currentIdx = stage ? steps.indexOf(stage) : 0;
  const currentLabel =
    toolSlug === "document-analyzer" && documentView === "advanced" && stage === "analyze"
      ? "Анализируем документ и готовим AI-редактор…"
      : stage
        ? STAGE_LABELS[stage]
        : "Подготовка…";

  return (
    <Card>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-gray-700">
            {currentLabel}
          </p>
          <span className="text-xs tabular-nums text-gray-500">{formatTime(elapsedSec)}</span>
        </div>
        <div className="flex gap-1">
          {steps.slice(0, -1).map((s, i) => {
            const isActive = i === currentIdx;
            const isDone = i < currentIdx;
            return (
              <div key={s} className="relative h-2 flex-1 overflow-hidden rounded-full bg-gray-200">
                {isDone ? (
                  <div className="absolute inset-0 rounded-full bg-emerald-500" />
                ) : isActive ? (
                  <div className="absolute inset-0 animate-progress rounded-full bg-emerald-500" />
                ) : null}
              </div>
            );
          })}
        </div>
        <div className="flex justify-between text-xs text-gray-400">
          <span>Загрузка</span>
          <span>Анализ LLM</span>
          {toolSlug === "document-analyzer" && <span>AI Editor</span>}
        </div>
      </div>
    </Card>
  );
}

function DataExtractorIdleState() {
  return (
    <div className="relative overflow-hidden rounded-[32px] border border-stone-300 bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.96),_rgba(246,240,229,0.98)_58%,_rgba(234,226,214,0.98))] p-6 shadow-[0_24px_90px_rgba(28,25,23,0.1)] sm:p-8">
      <div className="pointer-events-none absolute right-0 top-0 h-40 w-40 rounded-full bg-emerald-200/20 blur-3xl" />
      <div className="relative grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_300px] lg:items-end">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.26em] text-stone-500">Предпросмотр сравнения</p>
          <h3 className="mt-3 text-3xl font-semibold tracking-[-0.05em] text-stone-900">
            Здесь появится карта изменений между двумя документами.
          </h3>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-stone-700">
            После загрузки пары файлов страница соберет общий итог, точки пересечения, список ключевых различий и итоговую оценку их связи.
          </p>
        </div>
        <div className="grid gap-3">
          {["Итог", "Общее", "Различия", "Связь"].map((item) => (
            <div key={item} className="rounded-[22px] border border-stone-300/80 bg-white/70 px-4 py-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-stone-500">{item}</p>
              <div className="mt-3 h-2 w-full rounded-full bg-stone-200" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function DataExtractorLoadingState({
  stage,
  elapsedSec,
}: {
  stage?: AnalysisStage;
  elapsedSec: number;
}) {
  const steps: Array<{ key: AnalysisStage; label: string; note: string }> = [
    { key: "upload", label: "Intake", note: "Принимаем оба документа" },
    { key: "analyze", label: "Diff", note: "Собираем общие и отличающиеся смысловые блоки" },
    { key: "done", label: "Compose", note: "Формируем сравнение для интерфейса" },
  ];
  const currentIdx = stage ? steps.findIndex((item) => item.key === stage) : 0;

  return (
    <div className="overflow-hidden rounded-[32px] border border-stone-800 bg-[linear-gradient(135deg,#101314,#1a221f_45%,#101314)] p-6 text-stone-50 shadow-[0_28px_90px_rgba(17,24,39,0.35)] sm:p-8">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.26em] text-emerald-300/80">Comparison in progress</p>
          <h3 className="mt-3 text-3xl font-semibold tracking-[-0.05em] text-white">Собираем карту совпадений и расхождений.</h3>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-stone-300">
            Инструмент проходит по обеим версиям документа, сравнивает формулировки, сроки и обязательства и собирает итоговую связь между файлами.
          </p>

          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            {steps.map((item, index) => {
              const isDone = currentIdx > index;
              const isCurrent = currentIdx === index;
              return (
                <div
                  key={item.key}
                  className={`rounded-[24px] border px-4 py-4 ${
                    isDone
                      ? "border-emerald-400/20 bg-emerald-400/10"
                      : isCurrent
                        ? "border-white/15 bg-white/[0.06]"
                        : "border-white/10 bg-white/[0.03]"
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-stone-400">{item.label}</span>
                    <span className={`inline-flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-semibold ${
                      isDone
                        ? "bg-emerald-300 text-stone-950"
                        : isCurrent
                          ? "bg-white text-stone-950"
                          : "bg-white/10 text-stone-300"
                    }`}>
                      {index + 1}
                    </span>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-stone-300">{item.note}</p>
                </div>
              );
            })}
          </div>
        </div>

        <div className="rounded-[28px] border border-white/10 bg-white/[0.04] p-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-stone-500">Live status</p>
          <p className="mt-3 text-4xl font-semibold tracking-[-0.05em] text-white">{formatTime(elapsedSec)}</p>
          <p className="mt-2 text-sm leading-6 text-stone-300">
            {stage ? STAGE_LABELS[stage] : "Подготовка сравнения…"}
          </p>
          <div className="mt-6 space-y-3">
            <div className="h-2 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-gradient-to-r from-emerald-300 via-emerald-400 to-stone-100 transition-all"
                style={{ width: `${Math.max(18, ((currentIdx + 1) / steps.length) * 100)}%` }}
              />
            </div>
            <div className="grid gap-2">
              {["Распознаем файлы", "Сопоставляем смысл", "Собираем финальный ответ"].map((line) => (
                <div key={line} className="h-10 rounded-2xl bg-white/[0.04]" />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function ResultsPanel({
  status,
  result,
  toolSlug,
  errorMessage,
  showUpgradeCta = false,
  stage,
  elapsedSec = 0,
  documentView = "summary",
}: ResultsPanelProps) {
  if (status === "idle") {
    if (toolSlug === "data-extractor") {
      return <DataExtractorIdleState />;
    }
    return (
      <Card className="bg-gray-50">
        <p className="text-center text-gray-500">
          Загрузите файл, чтобы увидеть результаты
        </p>
      </Card>
    );
  }

  if (status === "loading") {
    if (toolSlug === "data-extractor") {
      return <DataExtractorLoadingState stage={stage} elapsedSec={elapsedSec} />;
    }
    return <AnalysisProgress stage={stage} elapsedSec={elapsedSec} toolSlug={toolSlug} documentView={documentView} />;
  }

  if (status === "error") {
    return (
      <Card className="border-red-200 bg-red-50">
        <div className="space-y-3">
          <p className="text-sm text-red-700" role="alert">
            {errorMessage ?? "Произошла ошибка"}
          </p>
          {showUpgradeCta && (
            <Link href="/pricing">
              <Button type="button" variant="primary">
                Upgrade
              </Button>
            </Link>
          )}
        </div>
      </Card>
    );
  }

  if (status === "success" && result) {
    if (toolSlug === "document-analyzer" && isDocumentAnalyzerResult(result)) {
      return <DocumentAnalyzerSummaryView result={result} />;
    }
    if (toolSlug === "contract-checker" && isContractCheckerResult(result)) {
      return <ContractCheckerResultView result={result} />;
    }
    if (toolSlug === "data-extractor" && isDataExtractorResult(result)) {
      return <DataExtractorResultView result={result} />;
    }
    if (toolSlug === "tender-analyzer" && isTenderAnalyzerResult(result)) {
      return <TenderAnalyzerResultView result={result} />;
    }
    if (toolSlug === "handwriting-recognition" && isHandwritingRecognitionResult(result)) {
      return <HandwritingRecognitionResultView result={result} />;
    }
    const entries = Object.entries(result).filter(
      ([_, v]) => v !== undefined && v !== null
    );
    return (
      <div className="space-y-4">
        {entries.map(([k, v]) => (
          <Card key={k}>
            <h3 className="text-sm font-semibold text-gray-700">
              {formatKey(k)}
            </h3>
            <div className="mt-2 text-sm text-gray-600">{renderValue(v)}</div>
          </Card>
        ))}
        {entries.length === 0 && (
          <Card>
            <p className="text-gray-500">Нет данных для отображения</p>
          </Card>
        )}
      </div>
    );
  }

  return (
    <Card className="bg-gray-50">
      <p className="text-center text-gray-500">
        Загрузите файл, чтобы увидеть результаты
      </p>
    </Card>
  );
}
