"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowRight } from "lucide-react";
import { tools, type Tool } from "@/lib/config/tools";
import { getEnabledToolSlugs } from "@/lib/features/toolFeatureGate";
import { onAuthChange, getToken } from "@/lib/auth/token";

export function HomeToolsGrid() {
  const [enabledSlugs, setEnabledSlugs] = useState<Set<string> | null>(null);
  const [authed, setAuthed] = useState<boolean>(() =>
    typeof window === "undefined" ? false : Boolean(getToken())
  );

  useEffect(() => {
    return onAuthChange(() => setAuthed(Boolean(getToken())));
  }, []);

  useEffect(() => {
    let cancelled = false;
    setEnabledSlugs(new Set());
    getEnabledToolSlugs(tools.map((t) => t.slug))
      .then((set) => {
        if (!cancelled) setEnabledSlugs(set);
      })
      .catch(() => {
        if (!cancelled) setEnabledSlugs(new Set());
      });
    return () => {
      cancelled = true;
    };
  }, [authed]);

  const visible: Tool[] = useMemo(() => {
    if (!enabledSlugs) return [];
    return tools.filter((t) => enabledSlugs.has(t.slug));
  }, [enabledSlugs]);

  return (
    <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {visible.map((tool, index) => (
        <article
          key={tool.slug}
          className="home-fade-up rounded-[32px] border border-zinc-200 bg-[linear-gradient(180deg,#ffffff,#fafafa)] p-5 transition hover:-translate-y-0.5 hover:shadow-[0_16px_46px_rgba(15,23,42,0.12)]"
          style={{ animationDelay: `${0.08 + index * 0.06}s` }}
        >
          <h3 className="text-xl leading-tight text-zinc-900 [font-family:var(--font-home-display)]">
            {tool.title}
          </h3>
          <p className="mt-2 min-h-16 text-sm leading-relaxed text-zinc-600 [font-family:var(--font-home-body)]">
            {tool.description}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {tool.mvp.accepts.slice(0, 3).map((format) => (
              <span
                key={`${tool.slug}-${format}`}
                className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-emerald-700 [font-family:var(--font-home-body)]"
              >
                {format}
              </span>
            ))}
          </div>
          <Link
            href={`/tools/${tool.slug}`}
            className="mt-5 inline-flex items-center gap-1.5 text-sm font-medium text-zinc-900 transition hover:text-emerald-700 [font-family:var(--font-home-body)]"
          >
            Открыть инструмент
            <ArrowRight className="h-4 w-4" />
          </Link>
        </article>
      ))}
    </div>
  );
}
