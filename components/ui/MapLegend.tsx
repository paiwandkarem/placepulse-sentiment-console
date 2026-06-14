import { cn } from "@/lib/ui/sentiment";

// A small frosted legend chip, shared by both maps so they wear the same chrome as the Places
// floating controls. Each map supplies its own items (suburb scale vs cluster/place dots); the
// look is identical. Decorative, so it ignores pointer events and is hidden from assistive tech
// (the data it labels is conveyed in the hover cards and copy).
export type LegendItem = { color: string; label: string; outline?: boolean };

export function MapLegend({ items, className }: { items: LegendItem[]; className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "pointer-events-none flex items-center gap-3 rounded-xl border border-gray-200 bg-white/95 px-3 py-2 shadow-md backdrop-blur",
        className,
      )}
    >
      {items.map((item) => (
        <span key={item.label} className="flex items-center gap-1.5 text-xs font-medium text-gray-700">
          <span
            className="h-2.5 w-2.5 rounded-full"
            style={
              item.outline
                ? { boxShadow: `inset 0 0 0 2px ${item.color}` }
                : { backgroundColor: item.color }
            }
          />
          {item.label}
        </span>
      ))}
    </div>
  );
}
