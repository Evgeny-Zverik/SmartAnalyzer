type ChecklistItem = {
  item: string;
  status: string;
  note: string;
};

type ChecklistViewProps = {
  items: ChecklistItem[];
  className?: string;
};

const statusStyles: Record<string, string> = {
  ok: "text-emerald-600 border-emerald-200 bg-emerald-50",
  warn: "text-amber-600 border-amber-200 bg-amber-50",
  missing: "text-red-600 border-red-200 bg-red-50",
};

function statusIcon(status: string): string {
  const s = status.toLowerCase();
  if (s === "ok") return "✓";
  if (s === "warn") return "!";
  return "○";
}

export function ChecklistView({ items, className = "" }: ChecklistViewProps) {
  if (!items.length) {
    return (
      <p className="text-sm text-gray-500">Нет пунктов чеклиста</p>
    );
  }
  return (
    <ul className={`space-y-2 ${className}`}>
      {items.map((row, i) => {
        const s = row.status.toLowerCase();
        const style = statusStyles[s] ?? statusStyles.missing;
        return (
          <li
            key={i}
            className={`flex items-start gap-3 rounded-lg border p-3 text-sm ${style}`}
          >
            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border font-medium">
              {statusIcon(row.status)}
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-medium">{row.item}</p>
              {row.note ? (
                <p className="mt-1 text-xs opacity-90">{row.note}</p>
              ) : null}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
