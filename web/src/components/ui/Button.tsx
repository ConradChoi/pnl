import { ButtonHTMLAttributes } from "react";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "danger";
};

const variants: Record<NonNullable<Props["variant"]>, string> = {
  primary: "bg-accent text-white hover:bg-accent-deep",
  secondary:
    "bg-surface text-foreground border border-border hover:border-accent",
  danger: "bg-bad text-white hover:opacity-90",
};

export function Button({ variant = "primary", className = "", ...props }: Props) {
  return (
    <button
      className={`inline-flex items-center justify-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${variants[variant]} ${className}`}
      {...props}
    />
  );
}
