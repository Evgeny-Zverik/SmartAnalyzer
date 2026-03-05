"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/Button";

export default function MarketingError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("MarketingError:", error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4">
      <h1 className="text-xl font-semibold text-gray-900">
        Что-то пошло не так
      </h1>
      <p className="mt-2 max-w-md text-center text-sm text-gray-600">
        {error.message}
      </p>
      <Button
        type="button"
        variant="primary"
        className="mt-6"
        onClick={() => reset()}
      >
        Повторить
      </Button>
    </div>
  );
}
