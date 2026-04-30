"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function ToolsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("ToolsError:", error);
  }, [error]);

  return (
    <div className="flex min-h-[40vh] flex-col items-center justify-center px-4">
      <h2 className="text-lg font-semibold text-gray-900">Ошибка загрузки каталога</h2>
      <p className="mt-2 max-w-md text-center text-sm text-gray-600">
        {error.message}
      </p>
      <div className="mt-6 flex gap-4">
        <button
          type="button"
          onClick={() => reset()}
          className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700"
        >
          Повторить
        </button>
        <Link
          href="/"
          className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          На главную
        </Link>
      </div>
    </div>
  );
}
