import Link from "next/link";
import { ChevronRight } from "lucide-react";
import type { Tool } from "@/lib/config/tools";
import { Badge } from "@/components/ui/Badge";

type ToolShellProps = {
  tool: Tool;
  children: React.ReactNode;
};

export function ToolShell({ tool, children }: ToolShellProps) {
  return (
    <main className="min-h-screen">
      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
        <nav
          className="mb-6 flex items-center gap-1 text-sm text-gray-500"
          aria-label="Breadcrumb"
        >
          <Link
            href="/"
            className="hover:text-gray-700 focus:text-gray-700 focus:outline-none"
          >
            Home
          </Link>
          <ChevronRight className="h-4 w-4 shrink-0" aria-hidden />
          <Link
            href="/tools"
            className="hover:text-gray-700 focus:text-gray-700 focus:outline-none"
          >
            Tools
          </Link>
          <ChevronRight className="h-4 w-4 shrink-0" aria-hidden />
          <span className="font-medium text-gray-900">{tool.title}</span>
        </nav>

        <header className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">
            {tool.title}
          </h1>
          <p className="mt-2 text-gray-600">{tool.description}</p>
        </header>

        <section className="mb-6">
          <h2 className="text-sm font-semibold text-gray-700">
            Accepted files
          </h2>
          <div className="mt-2 flex flex-wrap gap-2">
            {tool.mvp.accepts.map((ext) => (
              <Badge key={ext}>{ext}</Badge>
            ))}
          </div>
        </section>

        <section className="mb-8">
          <h2 className="text-sm font-semibold text-gray-700">Outputs</h2>
          <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-gray-600">
            {tool.mvp.output.map((out) => (
              <li key={out}>{out}</li>
            ))}
          </ul>
        </section>

        <hr className="border-gray-200" />

        <div className="mt-8">{children}</div>
      </div>
    </main>
  );
}
