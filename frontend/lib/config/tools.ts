export const tools = [
  {
    slug: "document-analyzer",
    title: "Анализатор документов",
    description:
      "Загрузите документ и получите структурированные выводы, риски и ключевые даты.",
  },
  {
    slug: "contract-checker",
    title: "Проверка договоров",
    description:
      "Проверка договоров на соответствие, риски и отсутствующие пункты.",
  },
  {
    slug: "data-extractor",
    title: "Извлечение данных",
    description:
      "Извлечение структурированных данных из документов и экспорт в JSON или таблицы.",
  },
  {
    slug: "tender-analyzer",
    title: "Анализатор тендеров",
    description:
      "Анализ тендеров: требования, сроки и оценка рисков.",
  },
  {
    slug: "risk-analyzer",
    title: "Анализатор рисков",
    description:
      "Выявление и оценка рисков в документах и бизнес-процессах.",
  },
] as const;

export type ToolSlug = (typeof tools)[number]["slug"];

export type Tool = (typeof tools)[number];

export function getToolBySlug(slug: string): Tool | undefined {
  return tools.find((t) => t.slug === slug);
}
