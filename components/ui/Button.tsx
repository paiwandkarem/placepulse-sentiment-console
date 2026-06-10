import type { ButtonHTMLAttributes } from "react";

// Spreads native button props so it behaves like a real <button> (type, onClick, disabled,
// aria-*). The local className is appended last so callers can extend the base style.
export function Button(props: ButtonHTMLAttributes<HTMLButtonElement>) {
  const { className = "", ...rest } = props;

  return (
    <button
      className={`rounded-xl bg-zinc-950 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 ${className}`}
      {...rest}
    />
  );
}
