import type { ButtonHTMLAttributes } from "react";

// Spreads native button props so it behaves like a real <button> (type, onClick, disabled,
// aria-*). The local className is appended last so callers can extend the base style.
export function Button(props: ButtonHTMLAttributes<HTMLButtonElement>) {
  const { className = "", ...rest } = props;

  return (
    <button
      className={`rounded-xl bg-gray-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-gray-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 disabled:opacity-50 ${className}`}
      {...rest}
    />
  );
}
