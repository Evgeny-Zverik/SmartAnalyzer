import { Card } from "@/components/ui/Card";

const steps = [
  {
    title: "Загрузка",
    description: "Загрузите документ или файл в поддерживаемом формате.",
  },
  {
    title: "Анализ",
    description: "ИИ извлечёт инсайты, риски и структурированные данные.",
  },
  {
    title: "Экспорт",
    description: "Скачайте результат или скопируйте в нужный формат.",
  },
];

export function HowItWorks() {
  return (
    <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
      <h2 className="text-center text-3xl font-bold text-gray-900">
        Как это работает
      </h2>
      <p className="mx-auto mt-4 max-w-2xl text-center text-gray-600">
        Три шага до результата
      </p>
      <div className="mt-12 grid gap-8 md:grid-cols-3">
        {steps.map((step, i) => (
          <Card key={step.title}>
            <div className="flex h-full flex-col">
              <span className="text-sm font-semibold text-emerald-600">
                Шаг {i + 1}
              </span>
              <h3 className="mt-2 text-xl font-semibold text-gray-900">
                {step.title}
              </h3>
              <p className="mt-2 text-gray-600">{step.description}</p>
            </div>
          </Card>
        ))}
      </div>
    </section>
  );
}
