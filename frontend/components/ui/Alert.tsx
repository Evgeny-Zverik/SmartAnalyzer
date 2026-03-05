type AlertProps = {
  variant?: "error" | "info";
  children: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
};

const variantStyles = {
  error:
    "border-red-200 bg-red-50 text-red-700",
  info:
    "border-blue-200 bg-blue-50 text-blue-700",
};

export function Alert({
  variant = "error",
  children,
  action,
  className = "",
}: AlertProps) {
  return (
    <div
      className={`rounded-lg border px-3 py-2 text-sm ${variantStyles[variant]} ${className}`}
      role="alert"
    >
      <div className="flex flex-col gap-2">
        <div>{children}</div>
        {action && <div>{action}</div>}
      </div>
    </div>
  );
}
