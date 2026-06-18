"use client";

import { useMemo } from "react";
import { Star } from "lucide-react";
import { DistributionBarChart, type DistributionBar } from "./DistributionBarChart";
import type { SentimentRecord } from "@/lib/types";

// Share of reviews by star rating (1 to 5, plus Unrated when present), as a distributed bar
// chart. Sits level with the sentiment-label chart in the distributions section.
export function StarRatingDistribution({ record }: { record: SentimentRecord }) {
  const bars = useMemo<DistributionBar[]>(
    () =>
      [
        { label: "1★", pct: record.oneStarPct, colour: "#dc2626" },
        { label: "2★", pct: record.twoStarPct, colour: "#ea580c" },
        { label: "3★", pct: record.threeStarPct, colour: "#d97706" },
        { label: "4★", pct: record.fourStarPct, colour: "#65a30d" },
        { label: "5★", pct: record.fiveStarPct, colour: "#16a34a" },
        { label: "Unrated", pct: record.unratedPct, colour: "#94a3b8" },
      ].filter((b) => !(b.label === "Unrated" && b.pct < 0.05)),
    [record],
  );

  const hasData = bars.some((b) => b.pct > 0);

  return (
    <div className="flex h-80 flex-col rounded-xl border border-gray-200 bg-white p-4 shadow-sm font-sans md:h-[340px]">
      <div className="mb-2 flex items-center justify-between px-1">
        <div className="inline-flex items-baseline gap-1.5">
          <Star className="h-5 w-5 self-center fill-amber-400 text-amber-400" aria-hidden="true" />
          <span className="text-2xl font-extrabold tracking-tight tabular-nums text-gray-900">
            {record.avgRating.toFixed(2)}
          </span>
          <span className="text-xs text-gray-500">avg rating</span>
        </div>
      </div>
      {hasData ? (
        <DistributionBarChart bars={bars} ariaLabel="Bar chart of the share of reviews by star rating." />
      ) : (
        <div className="flex min-h-0 flex-1 items-center justify-center rounded-xl border border-dashed border-gray-200 text-sm text-gray-500">
          No rating distribution for this selection.
        </div>
      )}
    </div>
  );
}
