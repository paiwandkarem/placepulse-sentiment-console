import type { ReactNode } from "react";

// Small pill label for status/metadata (e.g. runtime tags, sentiment markers).
export function Badge({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex rounded-full border border-gray-200 bg-gray-50 px-2.5 py-1 text-xs font-medium text-gray-700">
      {children}
    </span>
  );
}
