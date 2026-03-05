import { Card } from "@/components/ui/Card";

const features = [
  "Структурированные результаты (JSON)",
  "Цитирование (источники и выдержки)",
  "Лимиты использования",
  "Готово для команд",
  "Готово к API",
  "Приватность и безопасность",
];

export function Features() {
  return (
    <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
      <h2 className="text-center text-3xl font-bold text-gray-900">
        Возможности
      </h2>
      <p className="mx-auto mt-4 max-w-2xl text-center text-gray-600">
        Всё необходимое для работы с документами
      </p>
      <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {features.map((title) => (
          <Card key={title}>
            <p className="font-medium text-gray-900">{title}</p>
          </Card>
        ))}
      </div>
    </section>
  );
}
