import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/ui/sentiment";

// Shared prev/next pagination for the Places directory and a place's reviews. The caller supplies a
// function that builds the URL for a given page, so each surface keeps its own query contract.
export function Pagination({
  page,
  totalPages,
  hrefFor,
  className,
}: {
  page: number;
  totalPages: number;
  hrefFor: (page: number) => string;
  className?: string;
}) {
  if (totalPages <= 1) return null;
  return (
    <nav className={cn("flex items-center justify-between", className)}>
      <PageLink href={hrefFor(page - 1)} disabled={page <= 1} direction="prev" />
      <span className="text-sm text-gray-500">
        Page {page} of {totalPages.toLocaleString()}
      </span>
      <PageLink href={hrefFor(page + 1)} disabled={page >= totalPages} direction="next" />
    </nav>
  );
}

function PageLink({ href, disabled, direction }: { href: string; disabled: boolean; direction: "prev" | "next" }) {
  const label = direction === "prev" ? "Previous" : "Next";
  const Icon = direction === "prev" ? ChevronLeft : ChevronRight;
  const content = (
    <span className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700">
      {direction === "prev" && <Icon className="h-4 w-4" />}
      {label}
      {direction === "next" && <Icon className="h-4 w-4" />}
    </span>
  );
  if (disabled) return <span className="pointer-events-none opacity-40">{content}</span>;
  return <Link href={href}>{content}</Link>;
}
