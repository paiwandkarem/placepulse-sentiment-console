import type { ReactNode } from "react";
import { cn } from "@/lib/ui/sentiment";

// Surface container for every dashboard panel. An optional title/subtitle/action renders a
// consistent header so panels line up visually without each one re-implementing it.
export function Card({
  children,
  className = "",
  title,
  subtitle,
  action,
}: {
  children: ReactNode;
  className?: string;
  title?: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <section className={cn("rounded-xl border border-gray-200 bg-white p-5 shadow-sm", className)}>
      {(title || action) && (
        <header className="mb-4 flex items-start justify-between gap-3">
          <div>
            {title && <h2 className="text-sm font-semibold text-gray-900">{title}</h2>}
            {subtitle && <p className="mt-0.5 text-xs text-gray-500">{subtitle}</p>}
          </div>
          {action}
        </header>
      )}
      {children}
    </section>
  );
}
