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

const extendedDocumentFormats = ["txt", "pdf", "doc", "docx", "md", "odt", "rtf"];

export const tools: Tool[] = [
  {
    slug: "document-analyzer",
    title: "Анализатор документов",
    description:
      "Загрузите документ и получите структурированные выводы, риски и ключевые даты. Для договоров — юридический анализ с нормами права, штрафами и чеклистом.",
    category: "Documents",
    icon: "FileSearch",
    mvp: {
      accepts: extendedDocumentFormats,
      output: ["summary", "key points", "risks", "dates", "legal analysis"],
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
      accepts: extendedDocumentFormats,
      output: ["detailed summary", "differences", "relation assessment"],
    },
  },
  {
    slug: "tender-analyzer",
    title: "Обзор судебной практики",
    description:
      "Чат по судебной практике: ищет подходы судов по регионам, собирает ссылки на акты и подсказывает, какие нормы и аргументы проверить.",
    category: "Documents",
    icon: "Landmark",
    mvp: {
      accepts: [],
      output: ["free-form query", "court positions", "links to cases", "legal basis"],
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
  {
    slug: "legal-style-translator",
    title: "Перевод на юридический",
    description:
      "Приводит текст сообщения без вложений к официально-деловому стилю.",
    category: "Documents",
    icon: "Scale",
    mvp: {
      accepts: extendedDocumentFormats,
      output: ["formal rewrite", "official-business style"],
    },
  },
  {
    slug: "legal-text-simplifier",
    title: "Пересказ юридического текста",
    description:
      "Передаёт смысл юридических текстов более простым языком.",
    category: "Documents",
    icon: "FileSearch",
    mvp: {
      accepts: extendedDocumentFormats,
      output: ["plain-language summary", "key meaning"],
    },
  },
  {
    slug: "spelling-checker",
    title: "Проверка правописания",
    description:
      "Исправляет ошибки в орфографии и пунктуации в тексте.",
    category: "Documents",
    icon: "FileSearch",
    mvp: {
      accepts: extendedDocumentFormats,
      output: ["spelling fixes", "punctuation fixes"],
    },
  },
  {
    slug: "foreign-language-translator",
    title: "Перевод с иностранного языка",
    description:
      "Переводит сообщения без вложений на русский язык.",
    category: "Documents",
    icon: "FileSearch",
    mvp: {
      accepts: extendedDocumentFormats,
      output: ["russian translation"],
    },
  },
  {
    slug: "legal-document-design-review",
    title: "Дизайн юридических документов",
    description:
      "Проверяет структуру, язык и технику юридических документов.",
    category: "Documents",
    icon: "Scale",
    mvp: {
      accepts: extendedDocumentFormats,
      output: ["structure review", "language review", "legal drafting review"],
    },
  },
];

export type ToolSlug = (typeof tools)[number]["slug"];

export const TOOL_SLUGS = [
  "document-analyzer",
  "data-extractor",
  "tender-analyzer",
  "handwriting-recognition",
  "legal-style-translator",
  "legal-text-simplifier",
  "spelling-checker",
  "foreign-language-translator",
  "legal-document-design-review",
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
