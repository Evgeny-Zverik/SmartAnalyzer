import Link from "next/link";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-[#f5f6f7] px-4 py-10">
      <div className="relative mx-auto flex min-h-[calc(100vh-80px)] max-w-md flex-col justify-center">
        <Link href="/" className="mx-auto mb-6 flex items-center gap-3">
          <span className="flex h-12 w-12 items-center justify-center rounded-[20px] border border-stone-200 bg-white text-sm font-semibold text-stone-950 shadow-[0_12px_30px_rgba(28,25,23,0.08)]">
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
