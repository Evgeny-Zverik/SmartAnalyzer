import Link from "next/link";
import {
  FileText,
  FileCheck,
  Table,
  ClipboardList,
  AlertTriangle,
  type LucideIcon,
} from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import type { Tool } from "@/lib/config/tools";
import { CATEGORY_LABELS } from "@/lib/config/tools";

const iconMap: Record<string, LucideIcon> = {
  FileText,
  FileCheck,
  Table,
  ClipboardList,
  AlertTriangle,
};

type ToolCardProps = {
  tool: Tool;
};

export function ToolCard({ tool }: ToolCardProps) {
  const Icon = iconMap[tool.icon] ?? FileText;

  return (
    <Card>
      <div className="flex h-full flex-col">
        <div className="flex items-start justify-between gap-2">
          <Icon className="h-8 w-8 shrink-0 text-emerald-600" aria-hidden />
          <div className="flex flex-wrap gap-1">
            <Badge>{CATEGORY_LABELS[tool.category] ?? tool.category}</Badge>
            <Badge className="bg-emerald-100 text-emerald-800">MVP</Badge>
          </div>
        </div>
        <h3 className="mt-4 text-lg font-semibold text-gray-900">
          {tool.title}
        </h3>
        <p className="mt-2 flex-1 text-sm text-gray-600">{tool.description}</p>
        <div className="mt-4">
          <Button href={`/tools/${tool.slug}`} variant="primary" className="w-full sm:w-auto">
            Открыть
          </Button>
        </div>
      </div>
    </Card>
  );
}
