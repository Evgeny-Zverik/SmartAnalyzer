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
    icon: "FileSearch",
    mvp: {
      accepts: ["pdf", "docx"],
      output: ["summary", "key points", "risks", "dates"],
    },
  },
  {
    slug: "contract-checker",
    title: "AI Юрист",
    description:
      "AI Юрист анализирует договор, подсвечивает риски, предлагает правки и поддерживает интеграцию с Гарант для проверки норм и формулировок.",
    category: "Documents",
    icon: "Scale",
    mvp: {
      accepts: ["pdf", "docx"],
      output: ["risky clauses", "penalties", "obligations", "deadlines"],
    },
  },
  {
    slug: "data-extractor",
    title: "Сравнение документов",
    description:
      "Сравнивает версии документов, находит изменения в формулировках, сроках и обязательствах и показывает, что было добавлено, удалено или переписано.",
    category: "Data",
    icon: "GitCompareArrows",
    mvp: {
      accepts: ["pdf", "docx", "xlsx"],
      output: ["structured fields", "tables", "json export"],
    },
  },
  {
    slug: "tender-analyzer",
    title: "Обзор судебной практики",
    description:
      "Формирует подборку судебной практики по регионам, показывает подходы судов по аналогичным спорам и прикладывает ссылки на судебные акты и применимые нормы права.",
    category: "Documents",
    icon: "Landmark",
    mvp: {
      accepts: ["pdf", "docx"],
      output: ["requirements", "compliance checklist", "deadlines", "risks"],
    },
  },
  {
    slug: "handwriting-recognition",
    title: "Распознавание рукописных документов",
    description:
      "Распознает рукописные тексты, заявления, анкеты и архивные материалы, переводит их в редактируемый цифровой вид и подготавливает структуру для дальнейшего анализа.",
    category: "Documents",
    icon: "PenTool",
    mvp: {
      accepts: ["pdf", "jpg", "png"],
      output: ["recognized text", "structured fields", "editable document"],
    },
  },
];

export type ToolSlug = (typeof tools)[number]["slug"];

export const TOOL_SLUGS = [
  "document-analyzer",
  "contract-checker",
  "data-extractor",
  "tender-analyzer",
  "handwriting-recognition",
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
