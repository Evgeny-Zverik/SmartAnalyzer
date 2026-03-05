import { PricingTable } from "@/components/marketing/PricingTable";

export default function PricingPage() {
  return (
    <main className="min-h-screen">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <h1 className="text-center text-3xl font-bold text-gray-900">Тарифы</h1>
        <p className="mx-auto mt-4 max-w-2xl text-center text-gray-600">
          Выберите план под ваши задачи
        </p>
        <div className="mt-12">
          <PricingTable />
        </div>
      </div>
    </main>
  );
}
