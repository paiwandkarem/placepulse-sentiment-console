import type { ReactNode } from "react";

// One page-title treatment shared by the top-level surfaces (dashboard, briefs, assistant) so the
// heading scale and the muted subtitle read identically everywhere. A server component: it is pure
// markup with no interactivity, so it stays out of the client bundle. An optional `aside` slot holds
// a right-aligned meta chip (for example the data-availability range on the dashboard).
export function PageHeader({
  title,
  subtitle,
  aside,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  aside?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
      <div className="flex-1">
        <h1 className="text-3xl font-extrabold tracking-tight text-gray-900">{title}</h1>
        {subtitle && <p className="mt-1 text-sm font-semibold text-gray-600">{subtitle}</p>}
      </div>
      {aside && <div className="shrink-0">{aside}</div>}
    </div>
  );
}
