import { forwardRef } from "react";

type InputProps = React.InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
  error?: string;
};

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, className = "", ...props }, ref) => {
    return (
      <div className="w-full">
        {label && (
          <label className="mb-1.5 block text-sm font-medium text-zinc-700">
            {label}
          </label>
        )}
        <input
          ref={ref}
          className={`w-full rounded-xl border bg-white px-3 py-2.5 text-zinc-900 shadow-sm outline-none transition placeholder:text-zinc-400 focus:ring-2 disabled:opacity-50 ${
            error
              ? "border-rose-300 focus:border-rose-500 focus:ring-rose-200"
              : "border-zinc-300 focus:border-emerald-500 focus:ring-emerald-200"
          } ${className}`}
          {...props}
        />
        {error && (
          <p className="mt-1.5 text-sm text-rose-600" role="alert">
            {error}
          </p>
        )}
      </div>
    );
  }
);
Input.displayName = "Input";
