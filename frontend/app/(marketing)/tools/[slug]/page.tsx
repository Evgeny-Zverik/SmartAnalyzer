import { notFound } from "next/navigation";
import { getToolBySlug, tools } from "@/lib/config/tools";
import { Button } from "@/components/ui/Button";

export function generateStaticParams() {
  return tools.map((t) => ({ slug: t.slug }));
}

const whatYouGet: Record<string, string[]> = {
  "document-analyzer": [
    "Структурированные выводы по документу",
    "Риски и рекомендации",
    "Ключевые даты и стороны",
    "Экспорт в JSON",
  ],
  "contract-checker": [
    "Проверка на соответствие и риски",
    "Отсутствующие пункты",
    "Чек-лист по типу договора",
    "Экспорт отчёта",
  ],
  "data-extractor": [
    "Извлечение полей и таблиц",
    "Структурированные данные",
    "Экспорт JSON / XLSX",
    "Копирование в буфер",
  ],
  "tender-analyzer": [
    "Требования и критерии",
    "Чек-лист соответствия",
    "Дедлайны и этапы",
    "Оценка рисков",
  ],
  "risk-analyzer": [
    "Оценка рисков по документу",
    "Score и категории",
    "Рекомендации по снижению",
    "Экспорт отчёта",
  ],
};

export default function ToolStubPage({
  params,
}: {
  params: { slug: string };
}) {
  const { slug } = params;
  const tool = getToolBySlug(slug);

  if (!tool) {
    notFound();
  }

  const points = whatYouGet[tool.slug] ?? [
    "Структурированный результат",
    "Экспорт данных",
    "Быстрый анализ",
  ];

  return (
    <main className="min-h-screen">
      <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
        <h1 className="text-3xl font-bold text-gray-900">{tool.title}</h1>
        <p className="mt-4 text-gray-600">{tool.description}</p>
        <section className="mt-8">
          <h2 className="text-lg font-semibold text-gray-900">Что вы получите</h2>
          <ul className="mt-3 list-inside list-disc space-y-2 text-gray-600">
            {points.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        </section>
        <div className="mt-10">
          <Button href="/login" variant="primary">
            Попробовать
          </Button>
        </div>
      </div>
    </main>
  );
}
