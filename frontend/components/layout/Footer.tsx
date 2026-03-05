import Link from "next/link";

export function Footer() {
  return (
    <footer className="border-t border-gray-200 bg-gray-50">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="flex flex-col items-center justify-between gap-6 sm:flex-row">
          <nav className="flex flex-wrap justify-center gap-6">
            <Link
              href="/tools"
              className="text-sm text-gray-600 hover:text-gray-900"
            >
              Инструменты
            </Link>
            <Link
              href="/pricing"
              className="text-sm text-gray-600 hover:text-gray-900"
            >
              Тарифы
            </Link>
            <Link
              href="/terms"
              className="text-sm text-gray-600 hover:text-gray-900"
            >
              Условия
            </Link>
            <Link
              href="/privacy"
              className="text-sm text-gray-600 hover:text-gray-900"
            >
              Конфиденциальность
            </Link>
          </nav>
          <p className="text-sm text-gray-500">
            © {new Date().getFullYear()} SmartAnalyzer
          </p>
        </div>
      </div>
    </footer>
  );
}
