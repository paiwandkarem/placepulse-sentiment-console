"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowDown, ArrowUp } from "lucide-react";
import { aggTypeForCategory } from "@/lib/filters";
import { cn } from "@/lib/ui/sentiment";
import type { CategorySentiment } from "@/lib/types";

// A Cleveland dot plot of every category's sentiment for the suburb. Category scores cluster in a
// narrow band (roughly 60 to 85 out of 100), so a zero-based bar would leave every bar looking
// three-quarters full. A dot plot encodes the value by POSITION on an axis scaled to the suburb's
// own range, which makes the differences between categories legible. Sorted, colour-banded, and
// each row drills into that category on click.

type SortKey = "sentiment" | "reviews" | "name";

// Dot colour by score band, so a weaker category reads amber or red without reading the number.
function bandColour(score: number): string {
  if (score >= 75) return "#10b981";
  if (score >= 65) return "#f59e0b";
  return "#f43f5e";
}

const MIN_DELTA = 0.5;

function YoyDelta({ delta }: { delta: number }) {
  const abs = Math.abs(delta);
  if (abs < MIN_DELTA) {
    return <span className="text-[11px] tabular-nums text-gray-400">flat</span>;
  }
  const up = delta > 0;
  const Icon = up ? ArrowUp : ArrowDown;
  return (
    <span className={cn("inline-flex items-center justify-end gap-0.5 text-[11px] font-semibold tabular-nums", up ? "text-emerald-600" : "text-rose-600")}>
      <Icon className="h-3 w-3" aria-hidden="true" />
      {abs.toFixed(1)}
    </span>
  );
}

function SortButton({ label, active, dir, onClick }: { label: string; active: boolean; dir: "asc" | "desc"; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-md px-2.5 py-1 text-xs font-semibold transition-colors",
        active ? "bg-gray-900 text-white" : "text-gray-500 hover:bg-gray-100 hover:text-gray-800",
      )}
    >
      {label}
      {active ? <span className="ml-1">{dir === "desc" ? "↓" : "↑"}</span> : null}
    </button>
  );
}

export function CategorySentimentBreakdown({ categories, areaLabel }: { categories: CategorySentiment[]; areaLabel: string }) {
  const router = useRouter();
  const params = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [sortKey, setSortKey] = useState<SortKey>("sentiment");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  // Axis domain: the suburb's own score range with a little padding, so the spread fills the
  // plot. Labelled in the footer so the zoomed scale stays honest.
  const { lo, hi } = useMemo(() => {
    if (categories.length === 0) return { lo: 0, hi: 100 };
    const scores = categories.map((c) => c.overallSatisfaction100);
    const min = Math.min(...scores);
    const max = Math.max(...scores);
    const pad = Math.max(3, (max - min) * 0.2);
    return { lo: Math.max(0, Math.floor(min - pad)), hi: Math.min(100, Math.ceil(max + pad)) };
  }, [categories]);

  const position = (score: number) => (hi === lo ? 50 : ((score - lo) / (hi - lo)) * 100);

  const sorted = useMemo(() => {
    const factor = sortDir === "desc" ? -1 : 1;
    return [...categories].sort((a, b) => {
      if (sortKey === "name") return factor * a.category.localeCompare(b.category);
      if (sortKey === "reviews") return factor * (a.totalReviews - b.totalReviews);
      return factor * (a.overallSatisfaction100 - b.overallSatisfaction100);
    });
  }, [categories, sortKey, sortDir]);

  function toggleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    } else {
      setSortKey(key);
      setSortDir(key === "name" ? "asc" : "desc");
    }
  }

  function drillInto(category: string) {
    const next = new URLSearchParams(params.toString());
    next.set("aggType", aggTypeForCategory(category));
    next.set("category", category);
    startTransition(() => router.replace(`/?${next.toString()}`, { scroll: false }));
  }

  if (categories.length === 0) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-5 text-sm text-gray-500 shadow-sm">
        No category breakdown for {areaLabel}.
      </div>
    );
  }

  const COLS = "minmax(120px, 180px) 1fr 3rem 6.5rem 3rem";

  return (
    <div className={cn("rounded-xl border border-gray-200 bg-white p-4 shadow-sm transition-opacity", isPending && "opacity-60")}>
      <div className="mb-3 flex items-center justify-end gap-1.5">
        <span className="mr-1 text-xs font-medium text-gray-400">Sort by</span>
        <SortButton label="Sentiment" active={sortKey === "sentiment"} dir={sortDir} onClick={() => toggleSort("sentiment")} />
        <SortButton label="Reviews" active={sortKey === "reviews"} dir={sortDir} onClick={() => toggleSort("reviews")} />
        <SortButton label="Name" active={sortKey === "name"} dir={sortDir} onClick={() => toggleSort("name")} />
      </div>

      <ul className="divide-y divide-gray-100">
        {sorted.map((c) => {
          const left = position(c.overallSatisfaction100);
          const colour = bandColour(c.overallSatisfaction100);
          const yoy = c.overallSatisfaction100LastYear == null ? null : c.overallSatisfaction100 - c.overallSatisfaction100LastYear;
          const yoyWords =
            yoy == null || Math.abs(yoy) < MIN_DELTA
              ? ""
              : `, ${yoy > 0 ? "up" : "down"} ${Math.abs(yoy).toFixed(1)} versus last year`;
          const label = `${c.category}, ${c.overallSatisfaction100.toFixed(1)} out of 100, ${c.totalReviews.toLocaleString("en-AU")} reviews${yoyWords}. Select to view in detail.`;
          return (
            <li key={c.category}>
              <button
                type="button"
                onClick={() => drillInto(c.category)}
                aria-label={label}
                title={`View ${c.category} in detail`}
                className="grid w-full items-center gap-3 py-2 text-left transition-colors hover:bg-gray-50"
                style={{ gridTemplateColumns: COLS }}
              >
                <span className="truncate text-sm font-semibold text-gray-900">{c.category}</span>

                {/* Lollipop: a stem along the zoomed axis tipped with the value dot. */}
                <span className="relative h-4">
                  <span className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-gray-200" aria-hidden="true" />
                  <span
                    className="absolute top-1/2 left-0 h-1.5 -translate-y-1/2 rounded-full"
                    style={{ width: `${left}%`, backgroundColor: colour, opacity: 0.45 }}
                    aria-hidden="true"
                  />
                  <span
                    className="absolute top-1/2 h-3.5 w-3.5 -translate-y-1/2 rounded-full ring-2 ring-white"
                    style={{ left: `calc(${left}% - 7px)`, backgroundColor: colour }}
                    aria-hidden="true"
                  />
                </span>

                <span className="text-right text-sm font-bold tabular-nums text-gray-900">{c.overallSatisfaction100.toFixed(1)}</span>

                <span className="text-right text-[11px] tabular-nums text-gray-400">{c.totalReviews.toLocaleString("en-AU")} reviews</span>

                <span className="text-right">
                  {c.overallSatisfaction100LastYear != null ? (
                    <YoyDelta delta={c.overallSatisfaction100 - c.overallSatisfaction100LastYear} />
                  ) : null}
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      <div className="mt-3 grid items-center gap-3 border-t border-gray-100 pt-2" style={{ gridTemplateColumns: COLS }}>
        <span className="text-[11px] text-gray-400">Sentiment score</span>
        <span className="flex justify-between text-[11px] tabular-nums text-gray-400">
          <span>{lo}</span>
          <span>{hi}</span>
        </span>
        <span />
        <span />
        <span />
      </div>
    </div>
  );
}
