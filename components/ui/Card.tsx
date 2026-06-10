import type { ReactNode } from "react";

// Surface container used across the dashboard. Accepts a className so callers can set a
// height or span without forking the component.
export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm ${className}`}>
      {children}
    </section>
  );
}
