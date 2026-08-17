import { HTMLAttributes } from "react";

export function Card(props: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      {...props}
      className={`rounded-2xl border border-border bg-surface p-6 shadow-sm ${props.className ?? ""}`}
    />
  );
}

export function FormError({ message }: { message?: string | null }) {
  if (!message) return null;
  return (
    <p className="rounded-lg bg-bad/10 px-3 py-2 text-sm text-bad" role="alert">
      {message}
    </p>
  );
}
