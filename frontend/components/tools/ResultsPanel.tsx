"use client";

import { Card } from "@/components/ui/Card";

type ResultsPanelProps = {
  status: "idle" | "loading" | "success" | "error";
  result?: Record<string, unknown>;
  errorMessage?: string;
};

function formatKey(key: string): string {
  return key
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (s) => s.toUpperCase())
    .trim();
}

function renderValue(value: unknown): React.ReactNode {
  if (value === null || value === undefined) return "—";
  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);
  if (typeof value === "boolean") return value ? "Да" : "Нет";
  if (Array.isArray(value)) {
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

export function ResultsPanel({
  status,
  result,
  errorMessage,
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
    return (
      <Card className="space-y-4">
        <div className="h-4 w-3/4 animate-pulse rounded bg-gray-200" />
        <div className="h-4 w-1/2 animate-pulse rounded bg-gray-200" />
        <div className="h-20 animate-pulse rounded bg-gray-200" />
      </Card>
    );
  }

  if (status === "error") {
    return (
      <Card className="border-red-200 bg-red-50">
        <p className="text-sm text-red-700" role="alert">
          {errorMessage ?? "Произошла ошибка"}
        </p>
      </Card>
    );
  }

  if (status === "success" && result) {
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
