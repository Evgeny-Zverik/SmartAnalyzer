type SeverityBadgeProps = {
  severity: string;
  className?: string;
};

const severityStyles: Record<string, string> = {
  low: "bg-amber-100 text-amber-800 border-amber-200",
  medium: "bg-orange-100 text-orange-800 border-orange-200",
  high: "bg-red-100 text-red-800 border-red-200",
};

export function SeverityBadge({ severity, className = "" }: SeverityBadgeProps) {
  const s = severity.toLowerCase();
  const style = severityStyles[s] ?? "bg-gray-100 text-gray-700 border-gray-200";
  return (
    <span
      className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium ${style} ${className}`}
    >
      {s}
    </span>
  );
}
