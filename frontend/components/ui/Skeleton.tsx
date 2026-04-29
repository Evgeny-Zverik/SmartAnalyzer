type SkeletonProps = {
  className?: string;
};

function cx(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(" ");
}

export function Skeleton({ className }: SkeletonProps) {
  return (
    <span
      aria-hidden="true"
      className={cx(
        "block animate-pulse rounded-full bg-gradient-to-r from-stone-100 via-white to-stone-200/80 bg-[length:220%_100%] shadow-sm",
        className
      )}
    />
  );
}

export function AppShellSkeleton({ variant = "dashboard" }: { variant?: "dashboard" | "files" | "admin" }) {
  const showSidebar = variant === "files";
  const metricCount = variant === "admin" ? 4 : 3;

  return (
    <main className="relative min-h-[calc(100vh-104px)] overflow-hidden bg-[linear-gradient(170deg,#f7f8f7,#f3f4f6_45%,#eef2ff)] px-4 py-6 sm:px-6 lg:px-8">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-[-8%] top-[-14%] h-72 w-72 rounded-full bg-emerald-200/30 blur-3xl" />
        <div className="absolute right-[-12%] top-[20%] h-96 w-96 rounded-full bg-sky-200/25 blur-3xl" />
      </div>

      <div className={cx("relative mx-auto flex w-full max-w-[1520px] gap-5", showSidebar ? "lg:flex-row" : "flex-col")}>
        {showSidebar && (
          <aside className="hidden w-72 flex-shrink-0 rounded-[28px] border border-stone-200/80 bg-white/85 p-4 shadow-[0_18px_60px_rgba(15,23,42,0.08)] backdrop-blur lg:block">
            <Skeleton className="h-8 w-32" />
            <div className="mt-6 space-y-2">
              {Array.from({ length: 7 }).map((_, index) => (
                <Skeleton key={index} className="h-11 w-full rounded-2xl" />
              ))}
            </div>
          </aside>
        )}

        <div className="min-w-0 flex-1 space-y-5">
          <section className="rounded-[30px] border border-zinc-200/90 bg-white/85 px-5 py-5 shadow-[0_20px_70px_rgba(15,23,42,0.08)] backdrop-blur sm:px-6">
            <Skeleton className="h-7 w-44" />
            <Skeleton className="mt-4 h-10 w-full max-w-xl rounded-2xl" />
            <Skeleton className="mt-3 h-5 w-full max-w-3xl" />
          </section>

          <div className="grid gap-4 md:grid-cols-3">
            {Array.from({ length: metricCount }).map((_, index) => (
              <section key={index} className="rounded-3xl border border-zinc-200 bg-white/90 p-5 shadow-[0_14px_50px_rgba(15,23,42,0.06)]">
                <Skeleton className="h-10 w-10 rounded-2xl" />
                <Skeleton className="mt-4 h-5 w-28" />
                <Skeleton className="mt-3 h-8 w-36 rounded-xl" />
              </section>
            ))}
          </div>

          <section className="rounded-3xl border border-zinc-200 bg-white/90 p-5 shadow-[0_14px_50px_rgba(15,23,42,0.06)]">
            <div className="flex items-center justify-between gap-4">
              <Skeleton className="h-7 w-44" />
              <Skeleton className="h-9 w-32 rounded-xl" />
            </div>
            <div className="mt-5 space-y-3">
              {Array.from({ length: 6 }).map((_, index) => (
                <Skeleton key={index} className="h-14 w-full rounded-2xl" />
              ))}
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}

export function AdminPanelSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <section className="mt-6 rounded-3xl border border-zinc-200 bg-white/95 p-5 shadow-[0_14px_50px_rgba(15,23,42,0.07)] sm:p-6">
      <div className="flex items-start gap-3">
        <Skeleton className="h-10 w-10 rounded-xl" />
        <div className="flex-1">
          <Skeleton className="h-6 w-44" />
          <Skeleton className="mt-3 h-4 w-full max-w-xl" />
        </div>
      </div>
      <div className="mt-6 space-y-3">
        {Array.from({ length: rows }).map((_, index) => (
          <Skeleton key={index} className="h-16 w-full rounded-2xl" />
        ))}
      </div>
    </section>
  );
}

export function RootPageSkeleton() {
  return (
    <main className="min-h-screen bg-[linear-gradient(170deg,#f7f8f7,#f3f4f6_45%,#eef2ff)] px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-5">
        <section className="rounded-[30px] border border-zinc-200/90 bg-white/85 p-6 shadow-[0_20px_70px_rgba(15,23,42,0.08)]">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="mt-5 h-14 w-full max-w-2xl rounded-2xl" />
          <Skeleton className="mt-4 h-5 w-full max-w-3xl" />
        </section>
        <div className="grid gap-4 md:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <Skeleton key={index} className="h-40 rounded-3xl" />
          ))}
        </div>
      </div>
    </main>
  );
}
