export type ToolCategory = "Documents" | "Risk" | "Data";

export type Tool = {
  slug: string;
  title: string;
  description: string;
  category: ToolCategory;
  icon: string;
  mvp: {
    accepts: string[];
    output: string[];
  };
};

export const tools: Tool[] = [
  {
    slug: "document-analyzer",
    title: "Анализатор документов",
    description:
      "Загрузите документ и получите структурированные выводы, риски и ключевые даты.",
    category: "Documents",
    icon: "FileText",
    mvp: {
      accepts: ["pdf", "docx"],
      output: ["summary", "key points", "risks", "dates"],
    },
  },
  {
    slug: "contract-checker",
    title: "Проверка договоров",
    description:
      "Проверка договоров на соответствие, риски и отсутствующие пункты.",
    category: "Documents",
    icon: "FileCheck",
    mvp: {
      accepts: ["pdf", "docx"],
      output: ["risky clauses", "penalties", "obligations", "deadlines"],
    },
  },
  {
    slug: "data-extractor",
    title: "Извлечение данных",
    description:
      "Извлечение структурированных данных из документов и экспорт в JSON или таблицы.",
    category: "Data",
    icon: "Table",
    mvp: {
      accepts: ["pdf", "docx", "xlsx"],
      output: ["structured fields", "tables", "json export"],
    },
  },
  {
    slug: "tender-analyzer",
    title: "Анализатор тендеров",
    description:
      "Анализ тендеров: требования, сроки и оценка рисков.",
    category: "Documents",
    icon: "ClipboardList",
    mvp: {
      accepts: ["pdf", "docx"],
      output: ["requirements", "compliance checklist", "deadlines", "risks"],
    },
  },
  {
    slug: "risk-analyzer",
    title: "Анализатор рисков",
    description:
      "Выявление и оценка рисков в документах и бизнес-процессах.",
    category: "Risk",
    icon: "AlertTriangle",
    mvp: {
      accepts: ["pdf", "docx", "xlsx"],
      output: ["risk score", "key drivers", "recommendations"],
    },
  },
];

export type ToolSlug = (typeof tools)[number]["slug"];

export const TOOL_SLUGS = [
  "document-analyzer",
  "contract-checker",
  "data-extractor",
  "tender-analyzer",
  "risk-analyzer",
] as const;

export function getToolBySlug(slug: string): Tool | undefined {
  return tools.find((t) => t.slug === slug);
}

export const CATEGORIES: ToolCategory[] = ["Documents", "Risk", "Data"];

export const CATEGORY_LABELS: Record<string, string> = {
  All: "Все",
  Documents: "Документы",
  Risk: "Риски",
  Data: "Данные",
};
