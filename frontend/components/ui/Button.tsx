import Link from "next/link";

type ButtonVariant = "primary" | "secondary" | "ghost";

const variantClasses: Record<
  ButtonVariant,
  string
> = {
  primary:
    "bg-[#ffd43b] text-stone-950 shadow-[0_12px_30px_rgba(245,158,11,0.18)] hover:bg-[#f6c343] focus:ring-amber-300",
  secondary:
    "border border-stone-300 bg-white text-stone-900 hover:bg-stone-50 focus:ring-amber-300",
  ghost:
    "text-stone-700 hover:bg-stone-100 focus:ring-amber-300",
};

type ButtonProps = {
  variant?: ButtonVariant;
  href?: string;
  children: React.ReactNode;
  className?: string;
  type?: "button" | "submit";
  disabled?: boolean;
  onClick?: () => void;
};

export function Button({
  variant = "primary",
  href,
  children,
  className = "",
  type = "button",
  disabled = false,
  onClick,
}: ButtonProps) {
  const base =
    "inline-flex items-center justify-center rounded-full px-4 py-2.5 text-sm font-semibold transition focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none";

  const classes = `${base} ${variantClasses[variant]} ${className}`;

  if (href && !disabled) {
    return (
      <Link href={href} className={classes}>
        {children}
      </Link>
    );
  }

  return (
    <button
      type={type}
      className={classes}
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </button>
  );
}
