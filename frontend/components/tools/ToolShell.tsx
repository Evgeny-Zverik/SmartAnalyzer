import { ChevronRight } from "lucide-react";
import type { Tool } from "@/lib/config/tools";

type ToolShellProps = {
  tool: Tool;
  children: React.ReactNode;
  metaAction?: React.ReactNode;
};

export function ToolShell({ tool, children, metaAction }: ToolShellProps) {
  function handleHardNavigate(href: string) {
    window.location.href = href;
  }

  return (
    <main className="min-h-screen">
      <div className="mx-auto max-w-[1540px] px-4 py-5 sm:px-6 sm:py-6 lg:px-8">
        <nav
          className="mb-4 flex items-center gap-1 text-sm text-gray-500"
          aria-label="Breadcrumb"
        >
          <a
            href="/"
            onMouseDown={(e) => {
              if (e.button !== 0) return;
              e.preventDefault();
              handleHardNavigate("/");
            }}
            className="hover:text-gray-700 focus:text-gray-700 focus:outline-none"
          >
            Главная
          </a>
          <ChevronRight className="h-4 w-4 shrink-0" aria-hidden />
          <a
            href="/tools"
            onMouseDown={(e) => {
              if (e.button !== 0) return;
              e.preventDefault();
              handleHardNavigate("/tools");
            }}
            className="hover:text-gray-700 focus:text-gray-700 focus:outline-none"
          >
            Инструменты
          </a>
          <ChevronRight className="h-4 w-4 shrink-0" aria-hidden />
          <span className="font-medium text-gray-900">{tool.title}</span>
        </nav>

        <header className="mb-5 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">
              {tool.title}
            </h1>
            <p className="mt-2 max-w-3xl text-gray-600">{tool.description}</p>
          </div>
          {metaAction ? <div className="shrink-0">{metaAction}</div> : null}
        </header>

        <div>{children}</div>
      </div>
    </main>
  );
}
