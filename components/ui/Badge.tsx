import type { ReactNode } from "react";

// Small pill label for status/metadata (e.g. runtime tags, sentiment markers).
export function Badge({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-xs font-medium text-zinc-700">
      {children}
    </span>
  );
}
