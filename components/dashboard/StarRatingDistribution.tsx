"use client";

import { useMemo } from "react";
import dynamic from "next/dynamic";
import { Star } from "lucide-react";
import type { SentimentRecord } from "@/lib/types";

const ReactApexChart = dynamic(() => import("react-apexcharts"), { ssr: false });

const CHART_FONT = "'Plus Jakarta Sans', ui-sans-serif, system-ui, sans-serif";

// Share of reviews by star rating (1 to 5, plus Unrated when present), as a distributed bar
// chart. Sits level with the sentiment-label chart in the distributions section.
export function StarRatingDistribution({ record }: { record: SentimentRecord }) {
  const buckets = useMemo(
    () =>
      [
        { x: "1★", pct: record.oneStarPct, colour: "#dc2626" },
        { x: "2★", pct: record.twoStarPct, colour: "#ea580c" },
        { x: "3★", pct: record.threeStarPct, colour: "#d97706" },
        { x: "4★", pct: record.fourStarPct, colour: "#65a30d" },
        { x: "5★", pct: record.fiveStarPct, colour: "#16a34a" },
        { x: "Unrated", pct: record.unratedPct, colour: "#94a3b8" },
      ].filter((b) => !(b.x === "Unrated" && b.pct < 0.05)),
    [record],
  );

  const options = useMemo(
    () => ({
      chart: { type: "bar" as const, toolbar: { show: false }, animations: { enabled: false }, fontFamily: CHART_FONT },
      plotOptions: { bar: { columnWidth: "55%", borderRadius: 6, distributed: true, dataLabels: { position: "center" } } },
      colors: buckets.map((b) => b.colour),
      legend: { show: false },
      dataLabels: {
        enabled: true,
        formatter: (v: number) => `${Number(v).toFixed(0)}%`,
        offsetY: 0,
        style: { fontSize: "15px", fontWeight: 800, colors: ["#ffffff"] },
        dropShadow: { enabled: true, top: 1, left: 0, blur: 2, opacity: 0.45 },
      },
      xaxis: {
        categories: buckets.map((b) => b.x),
        axisBorder: { show: false },
        axisTicks: { show: false },
        labels: { style: { fontSize: "12px", colors: "#6b7280" } },
      },
      yaxis: { labels: { formatter: (v: number) => `${Math.round(v)}%`, style: { colors: "#6b7280" } } },
      grid: { strokeDashArray: 3, borderColor: "#e5e7eb" },
      tooltip: { y: { formatter: (v: number) => `${v.toFixed(1)}%` } },
    }),
    [buckets],
  );

  const series = useMemo(() => [{ name: "Share", data: buckets.map((b) => Number(b.pct.toFixed(2))) }], [buckets]);

  const hasData = buckets.some((b) => b.pct > 0);

  return (
    <div className="flex h-[340px] flex-col rounded-xl border border-gray-200 bg-white p-4 shadow-sm font-sans">
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
        <div className="min-h-0 flex-1" role="img" aria-label="Bar chart of the share of reviews by star rating.">
          <ReactApexChart options={options} series={series} type="bar" height="100%" />
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 items-center justify-center rounded-xl border border-dashed border-gray-200 text-sm text-gray-500">
          No rating distribution for this selection.
        </div>
      )}
    </div>
  );
}
