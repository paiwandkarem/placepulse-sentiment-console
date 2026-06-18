"use client";

import { useMemo } from "react";
import { ThumbsDown, ThumbsUp } from "lucide-react";
import { DistributionBarChart, type DistributionBar } from "./DistributionBarChart";
import type { SentimentRecord } from "@/lib/types";

// Vertical bar histogram of review tone (positive / neutral / negative / unknown), matching the
// platform's SentimentLabelDistribution footprint so it sits level with the star chart.
export function SentimentLabelDistribution({ record }: { record: SentimentRecord }) {
  const bars = useMemo<DistributionBar[]>(
    () =>
      [
        { label: "Positive", pct: record.positivePct, colour: "#16a34a" },
        { label: "Neutral", pct: record.neutralPct, colour: "#64748b" },
        { label: "Negative", pct: record.negativePct, colour: "#dc2626" },
        { label: "Unknown", pct: record.unknownPct, colour: "#94a3b8" },
      ]
        .filter((b) => !(b.label === "Unknown" && b.pct < 0.05))
        // Order by share so the largest tone reads first.
        .sort((a, b) => b.pct - a.pct),
    [record],
  );

  const hasData = bars.some((b) => b.pct > 0);

  return (
    <div className="flex h-80 flex-col rounded-xl border border-gray-200 bg-white p-4 shadow-sm font-sans md:h-[340px]">
      <div className="mb-2 flex items-center gap-5 px-1">
        <div className="inline-flex items-baseline gap-1.5">
          <ThumbsUp className="h-5 w-5 self-center text-emerald-500" aria-hidden="true" />
          <span className="text-2xl font-extrabold tracking-tight tabular-nums text-gray-900">
            {record.positivePct.toFixed(0)}%
          </span>
          <span className="text-xs text-gray-500">positive</span>
        </div>
        <div className="inline-flex items-baseline gap-1.5">
          <ThumbsDown className="h-5 w-5 self-center text-rose-500" aria-hidden="true" />
          <span className="text-2xl font-extrabold tracking-tight tabular-nums text-gray-900">
            {record.negativePct.toFixed(0)}%
          </span>
          <span className="text-xs text-gray-500">negative</span>
        </div>
      </div>
      {hasData ? (
        <DistributionBarChart
          bars={bars}
          ariaLabel="Bar chart of the share of reviews that are positive, neutral, or negative."
        />
      ) : (
        <div className="flex min-h-0 flex-1 items-center justify-center rounded-xl border border-dashed border-gray-200 text-sm text-gray-500">
          No sentiment breakdown for this selection.
        </div>
      )}
    </div>
  );
}
