import { Button } from "@/components/ui/Button";

const trustItems = ["Безопасно", "Быстро", "Для бизнеса"];

export function Hero() {
  return (
    <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8 lg:py-28">
      <div className="mx-auto max-w-3xl text-center">
        <h1 className="text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl lg:text-6xl">
          AI-анализ документов и данных для бизнеса
        </h1>
        <p className="mt-6 text-lg text-gray-600">
          Загружайте документы — получайте структурированные выводы, риски и
          ключевые даты за минуты.
        </p>
        <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
          <Button href="/tools/document-analyzer" variant="primary">
            Попробовать анализатор документов
          </Button>
          <Button href="/tools" variant="secondary">
            Все инструменты
          </Button>
        </div>
        <div className="mt-12 flex flex-wrap justify-center gap-8">
          {trustItems.map((label) => (
            <span
              key={label}
              className="text-sm font-medium text-gray-500"
            >
              {label}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
