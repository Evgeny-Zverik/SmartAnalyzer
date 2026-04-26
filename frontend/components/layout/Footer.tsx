import Link from "next/link";

export function Footer() {
  return (
    <footer className="border-t border-stone-200/80 bg-[linear-gradient(180deg,#fafaf9_0%,#f4f4f5_100%)]">
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="rounded-[28px] border border-stone-200/80 bg-white/85 px-5 py-6 shadow-[0_14px_44px_rgba(15,23,42,0.08)] backdrop-blur sm:px-6">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-2">
              <p className="text-lg font-semibold tracking-[-0.03em] text-stone-900">SmartAnalyzer</p>
              <p className="text-sm text-stone-500">Платформа для анализа документов и юридической практики</p>
            </div>

            <nav className="flex flex-wrap gap-2">
              {[
                { href: "/tools", label: "Инструменты" },
                { href: "/pricing", label: "Кредиты" },
                { href: "/terms", label: "Условия" },
                { href: "/privacy", label: "Конфиденциальность" },
              ].map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="inline-flex items-center rounded-full border border-stone-200 bg-stone-50 px-4 py-2 text-sm font-medium text-stone-600 transition hover:border-stone-300 hover:bg-white hover:text-stone-900"
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>

          <div className="mt-6 border-t border-stone-200 pt-4 text-sm text-stone-500">
            © {new Date().getFullYear()} SmartAnalyzer
          </div>
        </div>
      </div>
    </footer>
  );
}
