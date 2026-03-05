import { ToolsPageClient } from "./ToolsPageClient";

export default function ToolsPage() {
  return (
    <main className="min-h-screen">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <h1 className="text-3xl font-bold text-gray-900">Инструменты</h1>
        <p className="mt-2 text-gray-600">
          Выберите анализатор и получите результат за минуты.
        </p>
        <ToolsPageClient />
      </div>
    </main>
  );
}
