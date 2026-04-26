import { PricingTable } from "./PricingTable";
import { Button } from "@/components/ui/Button";

export function PricingPreview() {
  return (
    <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
      <h2 className="text-center text-3xl font-bold text-gray-900">
        Кредиты
      </h2>
      <p className="mx-auto mt-4 max-w-2xl text-center text-gray-600">
        Пополняйте баланс и платите только за фактический анализ документов
      </p>
      <div className="mt-12">
        <PricingTable compact />
      </div>
      <div className="mt-8 text-center">
        <Button href="/pricing" variant="primary">
          Подробнее о кредитах
        </Button>
      </div>
    </section>
  );
}
