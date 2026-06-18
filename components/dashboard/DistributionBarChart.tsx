"use client";

import { useMemo } from "react";
import dynamic from "next/dynamic";
import type { EChartsOption } from "echarts";

const ReactECharts = dynamic(() => import("echarts-for-react"), { ssr: false });

const CHART_FONT = "'Plus Jakarta Sans', ui-sans-serif, system-ui, -apple-system, sans-serif";

export type DistributionBar = { label: string; pct: number; colour: string };

// A distributed (per-bar coloured) vertical bar chart of percentages on a 0–100 scale, with the value
// sitting just above each bar in dark text so a short bar's label stays readable on the white card
// instead of going white-on-white inside the bar. Shared by the star-rating and sentiment-tone
// distributions so the two read identically — and, by using echarts (the same engine as the trend
// chart), it lets the dashboard ship a single charting library instead of also bundling ApexCharts.
export function DistributionBarChart({ bars, ariaLabel }: { bars: DistributionBar[]; ariaLabel: string }) {
  const option = useMemo<EChartsOption>(
    () => ({
      aria: { enabled: true },
      textStyle: { fontFamily: CHART_FONT, color: "#374151" },
      tooltip: {
        trigger: "axis",
        axisPointer: { type: "shadow" },
        textStyle: { fontFamily: CHART_FONT },
        valueFormatter: (v) => `${Number(v).toFixed(1)}%`,
      },
      grid: { left: 40, right: 16, top: 28, bottom: 24 },
      xAxis: {
        type: "category",
        data: bars.map((b) => b.label),
        axisTick: { show: false },
        axisLine: { lineStyle: { color: "#e5e7eb" } },
        axisLabel: { color: "#6b7280", fontFamily: CHART_FONT },
      },
      yAxis: {
        type: "value",
        min: 0,
        max: 100,
        axisLabel: { color: "#6b7280", fontFamily: CHART_FONT, formatter: "{value}%" },
        splitLine: { lineStyle: { color: "#eef2f7" } },
      },
      series: [
        {
          type: "bar",
          barWidth: "55%",
          data: bars.map((b) => ({
            value: Number(b.pct.toFixed(2)),
            itemStyle: { color: b.colour, borderRadius: [6, 6, 0, 0] as [number, number, number, number] },
          })),
          label: {
            show: true,
            position: "top",
            offset: [0, -2],
            color: "#374151",
            fontWeight: 800,
            fontSize: 13,
            fontFamily: CHART_FONT,
            // `data[i].value` is a number here; round to a whole percent to mirror the prior labels.
            formatter: (p) => `${Math.round(Number(p.value))}%`,
          },
        },
      ],
    }),
    [bars],
  );

  return (
    <div className="min-h-0 flex-1" role="img" aria-label={ariaLabel}>
      <ReactECharts option={option} style={{ height: "100%" }} lazyUpdate />
    </div>
  );
}
