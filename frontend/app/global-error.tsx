"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="ru">
      <body>
        <div className="flex min-h-screen flex-col items-center justify-center p-8">
          <h1 className="text-xl font-semibold text-gray-900">Что-то пошло не так</h1>
          <button
            type="button"
            onClick={reset}
            className="mt-4 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
          >
            Повторить
          </button>
        </div>
      </body>
    </html>
  );
}
