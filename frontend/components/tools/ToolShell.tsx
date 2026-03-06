import Link from "next/link";
import { ChevronRight } from "lucide-react";
import type { Tool } from "@/lib/config/tools";
import { Badge } from "@/components/ui/Badge";

type ToolShellProps = {
  tool: Tool;
  children: React.ReactNode;
  metaAction?: React.ReactNode;
};

export function ToolShell({ tool, children, metaAction }: ToolShellProps) {
  return (
    <main className="min-h-screen">
      <div className="mx-auto max-w-[1540px] px-4 py-5 sm:px-6 sm:py-6 lg:px-8">
        <nav
          className="mb-4 flex items-center gap-1 text-sm text-gray-500"
          aria-label="Breadcrumb"
        >
          <Link
            href="/"
            className="hover:text-gray-700 focus:text-gray-700 focus:outline-none"
          >
            Главная
          </Link>
          <ChevronRight className="h-4 w-4 shrink-0" aria-hidden />
          <Link
            href="/tools"
            className="hover:text-gray-700 focus:text-gray-700 focus:outline-none"
          >
            Инструменты
          </Link>
          <ChevronRight className="h-4 w-4 shrink-0" aria-hidden />
          <span className="font-medium text-gray-900">{tool.title}</span>
        </nav>

        <header className="mb-5">
          <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">
            {tool.title}
          </h1>
          <p className="mt-2 max-w-3xl text-gray-600">{tool.description}</p>
        </header>

        <section className="mb-5 rounded-2xl border border-gray-200 bg-gray-50/80 px-4 py-3">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                Форматы
              </span>
              <div className="flex flex-wrap gap-2">
                {tool.mvp.accepts.map((ext) => (
                  <Badge key={ext}>{ext}</Badge>
                ))}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                Результат
              </span>
              <div className="flex flex-wrap gap-2">
                {tool.mvp.output.map((out) => (
                  <Badge key={out} className="bg-white text-gray-600 ring-1 ring-gray-200">
                    {out}
                  </Badge>
                ))}
              </div>
              {metaAction ? <div className="ml-2">{metaAction}</div> : null}
            </div>
          </div>
        </section>

        <div>{children}</div>
      </div>
    </main>
  );
}
