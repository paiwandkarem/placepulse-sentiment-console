"use client";

import { useMemo } from "react";
import dynamic from "next/dynamic";
import { TrendingUp } from "lucide-react";
import type { EChartsOption } from "echarts";
import { Card } from "@/components/ui/Card";
import type { SentimentTrendPoint } from "@/lib/types";

const ReactECharts = dynamic(() => import("echarts-for-react"), { ssr: false });

const CHART_FONT = "'Plus Jakarta Sans', ui-sans-serif, system-ui, -apple-system, sans-serif";

const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// Distinct hues per year so the three years read apart at a glance, with the most recent year
// in the brand emerald. When fewer than three years are present we take the trailing colours,
// keeping the most recent year emerald.
const YEAR_COLORS = ["#f59e0b", "#6366f1", "#10b981"];

// Year-on-year comparison: each calendar month sits side by side across the most recent
// three years, making seasonal shifts and overall trajectory legible at a glance.
export function SentimentOverTimeChart({ trend }: { trend: SentimentTrendPoint[] }) {
  const option = useMemo<EChartsOption>(() => {
    const byDate = new Map(trend.map((p) => [p.date, p.overallSatisfaction100]));

    const years = [...new Set(trend.map((p) => p.date.slice(0, 4)))].sort().slice(-3);

    // Align colours to the right so the newest year always uses the strongest green.
    const colors = YEAR_COLORS.slice(YEAR_COLORS.length - years.length);

    const series = years.map((year, yearIndex) => ({
      name: year,
      type: "bar" as const,
      data: MONTH_LABELS.map((_, monthIndex) => {
        const mm = String(monthIndex + 1).padStart(2, "0");
        const value = byDate.get(`${year}-${mm}-01`);
        return value == null ? null : Number(value.toFixed(1));
      }),
      itemStyle: { color: colors[yearIndex], borderRadius: [3, 3, 0, 0] as [number, number, number, number] },
      barMaxWidth: 30,
      barCategoryGap: "28%",
      barGap: "10%",
    }));

    return {
      aria: { enabled: true },
      textStyle: { fontFamily: CHART_FONT, color: "#374151" },
      tooltip: { trigger: "axis", textStyle: { fontFamily: CHART_FONT } },
      legend: { bottom: 0, textStyle: { fontFamily: CHART_FONT, color: "#6b7280", fontSize: 12 } },
      grid: { left: 40, right: 16, top: 24, bottom: 48 },
      xAxis: {
        type: "category",
        data: MONTH_LABELS,
        axisTick: { show: false },
        axisLine: { lineStyle: { color: "#e5e7eb" } },
        axisLabel: { color: "#6b7280", fontFamily: CHART_FONT },
      },
      yAxis: {
        type: "value",
        min: 0,
        max: 100,
        axisLabel: { color: "#6b7280", fontFamily: CHART_FONT },
        splitLine: { lineStyle: { color: "#eef2f7" } },
      },
      series,
    };
  }, [trend]);

  return (
    <Card>
      {trend.length === 0 ? (
        <div className="flex h-72 flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-gray-200 px-6 text-center">
          <TrendingUp className="h-6 w-6 text-gray-400" aria-hidden="true" />
          <p className="text-sm font-semibold text-gray-700">No sentiment history yet</p>
          <p className="text-xs text-gray-500">
            We do not have enough months of reviews to chart a trend for this suburb. Try another suburb above.
          </p>
        </div>
      ) : (
        <div
          role="img"
          aria-label="Grouped bar chart of monthly overall sentiment across the most recent three years."
          className="h-72 sm:h-80 md:h-[340px]"
        >
          <ReactECharts option={option} style={{ height: "100%" }} lazyUpdate />
        </div>
      )}
    </Card>
  );
}
