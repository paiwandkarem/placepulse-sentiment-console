"use client";

import { useMemo } from "react";
import dynamic from "next/dynamic";
import { HiOutlineThumbDown, HiOutlineThumbUp } from "react-icons/hi";
import type { SentimentRecord } from "@/lib/types";

const ReactApexChart = dynamic(() => import("react-apexcharts"), { ssr: false });

const CHART_FONT = "'Plus Jakarta Sans', ui-sans-serif, system-ui, sans-serif";

// Vertical bar histogram of review tone (positive / neutral / negative / unknown), matching the
// platform's SentimentLabelDistribution footprint so it sits level with the star chart.
export function SentimentLabelDistribution({ record }: { record: SentimentRecord }) {
  const buckets = useMemo(
    () =>
      [
        { x: "Positive", pct: record.positivePct, colour: "#16a34a" },
        { x: "Neutral", pct: record.neutralPct, colour: "#64748b" },
        { x: "Negative", pct: record.negativePct, colour: "#dc2626" },
        { x: "Unknown", pct: record.unknownPct, colour: "#94a3b8" },
      ]
        .filter((b) => !(b.x === "Unknown" && b.pct < 0.05))
        // Order by share so the largest tone reads first.
        .sort((a, b) => b.pct - a.pct),
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

  return (
    <div className="flex h-[340px] flex-col rounded-xl border border-gray-200 bg-white p-4 shadow-sm font-sans">
      <div className="mb-2 flex items-center gap-5 px-1">
        <div className="inline-flex items-baseline gap-1.5">
          <HiOutlineThumbUp className="h-5 w-5 self-center text-emerald-500" />
          <span className="text-2xl font-extrabold tracking-tight tabular-nums text-gray-900">
            {record.positivePct.toFixed(0)}%
          </span>
          <span className="text-xs text-gray-500">positive</span>
        </div>
        <div className="inline-flex items-baseline gap-1.5">
          <HiOutlineThumbDown className="h-5 w-5 self-center text-rose-500" />
          <span className="text-2xl font-extrabold tracking-tight tabular-nums text-gray-900">
            {record.negativePct.toFixed(0)}%
          </span>
          <span className="text-xs text-gray-500">negative</span>
        </div>
      </div>
      <div className="min-h-0 flex-1" role="img" aria-label="Bar chart of the share of reviews that are positive, neutral, or negative.">
        <ReactApexChart options={options} series={series} type="bar" height="100%" />
      </div>
    </div>
  );
}
