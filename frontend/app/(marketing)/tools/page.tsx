import { ToolsGrid } from "@/components/marketing/ToolsGrid";

export default function ToolsPage() {
  return (
    <main className="min-h-screen">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <h1 className="text-3xl font-bold text-gray-900">Инструменты</h1>
        <p className="mt-2 text-gray-600">
          Выберите инструмент для анализа документов и данных
        </p>
        <div className="mt-8">
          <input
            type="search"
            placeholder="Поиск по инструментам..."
            className="w-full max-w-md rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            aria-label="Поиск по инструментам"
          />
        </div>
        <div className="mt-12">
          <ToolsGrid buttonText="Открыть инструмент" />
        </div>
      </div>
    </main>
  );
}
