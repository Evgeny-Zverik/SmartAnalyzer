import { Button } from "@/components/ui/Button";

export function FinalCTA() {
  return (
    <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
      <div className="rounded-2xl border border-gray-200 bg-gray-50 p-8 text-center sm:p-12">
        <h2 className="text-2xl font-bold text-gray-900 sm:text-3xl">
          Начните анализ за минуты
        </h2>
        <p className="mt-4 text-gray-600">
          Загрузите первый документ и получите результат за пару минут.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
          <Button href="/tools" variant="primary">
            Начать
          </Button>
          <Button href="mailto:contact@smartanalyzer.example" variant="secondary">
            Связаться
          </Button>
        </div>
      </div>
    </section>
  );
}
