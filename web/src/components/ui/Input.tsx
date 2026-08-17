import { forwardRef, InputHTMLAttributes, LabelHTMLAttributes } from "react";

export function Label(props: LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      {...props}
      className={`mb-1 block text-xs font-semibold text-muted ${props.className ?? ""}`}
    />
  );
}

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function Input(props, ref) {
    return (
      <input
        ref={ref}
        {...props}
        className={`w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-accent ${props.className ?? ""}`}
      />
    );
  }
);
