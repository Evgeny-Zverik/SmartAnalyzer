"use client";

import { Eye, EyeOff } from "lucide-react";
import { forwardRef, useState } from "react";

type PasswordInputProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> & {
  label?: string;
  error?: string;
  hint?: string;
};

export const PasswordInput = forwardRef<HTMLInputElement, PasswordInputProps>(
  ({ label, error, hint, className = "", onKeyUp, ...props }, ref) => {
    const [visible, setVisible] = useState(false);
    const [capsLock, setCapsLock] = useState(false);

    return (
      <div className="w-full">
        {label && (
          <label className="mb-1.5 block text-sm font-medium text-zinc-700">
            {label}
          </label>
        )}
        <div className="relative">
          <input
            ref={ref}
            type={visible ? "text" : "password"}
            onKeyUp={(e) => {
              if (typeof e.getModifierState === "function") {
                setCapsLock(e.getModifierState("CapsLock"));
              }
              onKeyUp?.(e);
            }}
            className={`w-full rounded-xl border bg-white px-3 py-2.5 pr-11 text-zinc-900 shadow-sm outline-none transition placeholder:text-zinc-400 focus:ring-2 disabled:opacity-50 ${
              error
                ? "border-rose-300 focus:border-rose-500 focus:ring-rose-200"
                : "border-zinc-300 focus:border-emerald-500 focus:ring-emerald-200"
            } ${className}`}
            {...props}
          />
          <button
            type="button"
            tabIndex={-1}
            onClick={() => setVisible((v) => !v)}
            aria-label={visible ? "Скрыть пароль" : "Показать пароль"}
            className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-zinc-400 transition hover:text-zinc-700"
          >
            {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        {capsLock && !error && (
          <p className="mt-1.5 text-xs text-amber-600">⚠ Включён Caps Lock</p>
        )}
        {hint && !error && !capsLock && (
          <p className="mt-1.5 text-xs text-zinc-500">{hint}</p>
        )}
        {error && (
          <p className="mt-1.5 text-sm text-rose-600" role="alert">
            {error}
          </p>
        )}
      </div>
    );
  }
);
PasswordInput.displayName = "PasswordInput";
