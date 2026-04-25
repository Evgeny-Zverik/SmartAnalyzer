import Link from "next/link";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-[linear-gradient(170deg,#f7f8f7,#f3f4f6_45%,#eef2ff)] px-4 py-10">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-[-10%] top-[-12%] h-80 w-80 rounded-full bg-emerald-200/35 blur-3xl" />
        <div className="absolute right-[-12%] top-[18%] h-96 w-96 rounded-full bg-sky-200/30 blur-3xl" />
        <div className="absolute bottom-[-15%] left-[30%] h-80 w-80 rounded-full bg-violet-200/25 blur-3xl" />
      </div>
      <div className="relative mx-auto flex min-h-[calc(100vh-80px)] max-w-md flex-col justify-center">
        <Link href="/" className="mx-auto mb-6 flex items-center gap-3">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl border border-emerald-200 bg-[radial-gradient(circle_at_top,_rgba(110,231,183,0.32),rgba(255,255,255,0.96)_62%)] text-sm font-semibold text-emerald-700 shadow-[0_10px_30px_rgba(16,185,129,0.16)]">
            SA
          </span>
          <span className="flex flex-col">
            <span className="text-xl font-semibold tracking-[-0.04em] text-stone-900">
              SmartAnalyzer
            </span>
            <span className="text-[11px] uppercase tracking-[0.24em] text-stone-400">
              Document intelligence
            </span>
          </span>
        </Link>
        {children}
      </div>
    </div>
  );
}
