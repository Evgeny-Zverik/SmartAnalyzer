"use client";

import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { SeverityBadge } from "@/components/tools/SeverityBadge";
import { ChecklistView } from "@/components/tools/ChecklistView";
import { FieldsTable } from "@/components/tools/FieldsTable";
import { TablesView } from "@/components/tools/TablesView";
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
  requirements: "Требования",
  compliance_checklist: "Соответствие",
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
  fields: Array<{ key: string; value: string }>;
  tables: Array<{ name: string; rows: string[][] }>;
  confidence: number;
} {
  return (
    Array.isArray(r.fields) &&
    Array.isArray(r.tables) &&
    typeof r.confidence === "number"
  );
}

function DataExtractorResultView({
  result,
}: {
  result: {
    fields: Array<{ key: string; value: string }>;
    tables: Array<{ name: string; rows: string[][] }>;
    confidence: number;
  };
}) {
  return (
    <div className="space-y-6">
      <Card>
        <h3 className="mb-3 text-sm font-semibold text-gray-700">Уверенность</h3>
        <p className="text-sm text-gray-600">
          {typeof result.confidence === "number"
            ? (result.confidence * 100).toFixed(0)
            : "—"}
          %
        </p>
      </Card>
      <Card>
        <h3 className="mb-3 text-sm font-semibold text-gray-700">Поля</h3>
        <FieldsTable fields={result.fields} />
      </Card>
      <Card>
        <h3 className="mb-3 text-sm font-semibold text-gray-700">Таблицы</h3>
        <TablesView tables={result.tables} />
      </Card>
      <JsonActions data={result as unknown as Record<string, unknown>} />
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
    return (
      <Card className="bg-gray-50">
        <p className="text-center text-gray-500">
          Загрузите файл, чтобы увидеть результаты
        </p>
      </Card>
    );
  }

  if (status === "loading") {
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
