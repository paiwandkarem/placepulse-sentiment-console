"use client";

import { Tooltip } from "flowbite-react";
import { ArrowDown, ArrowUp, Calendar } from "lucide-react";
import { cn } from "@/lib/ui/sentiment";

type Metric = "number" | "percent";

// A single headline KPI: uppercase label (with an optional hover note), a large value, and a
// year-on-year change pill. No sparkline: the value and the YoY delta carry the card.
export function KpiCard({
  label,
  value,
  unit = "",
  metric = "number",
  previousValue,
  changePercent,
  changeDirection = "higher_better",
  hoverText,
}: {
  label: string;
  value: number | null;
  unit?: string;
  metric?: Metric;
  previousValue?: number | null;
  changePercent?: number | null;
  changeDirection?: "higher_better" | "lower_better";
  hoverText?: string;
}) {
  const hasChange = changePercent != null && !Number.isNaN(changePercent) && Math.abs(changePercent) >= 0.05;
  const isUp = (changePercent ?? 0) > 0;
  const isGood = changeDirection === "lower_better" ? !isUp : isUp;
  const ChangeIcon = isUp ? ArrowUp : ArrowDown;

  return (
    <div className="flex h-full flex-col justify-between rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="mb-1 text-xs font-medium uppercase tracking-wide text-gray-500">
        {hoverText ? (
          <Tooltip content={hoverText} animation="duration-200">
            <span className="cursor-help">{label}</span>
          </Tooltip>
        ) : (
          <span>{label}</span>
        )}
      </div>

      <div className="flex items-baseline gap-2">
        <span className="text-3xl font-bold text-gray-900">{format(value, metric, unit)}</span>
        {unit && metric !== "percent" && <span className="text-sm font-medium text-gray-400">{unit}</span>}
      </div>

      <div className="mt-3 flex items-center gap-2 text-xs">
        {hasChange ? (
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 font-semibold tabular-nums",
              isGood ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700",
            )}
          >
            <ChangeIcon className="h-3.5 w-3.5" aria-hidden="true" />
            {Math.abs(changePercent as number).toFixed(2)}%
          </span>
        ) : (
          <span className="inline-flex items-center rounded-md bg-gray-100 px-1.5 py-0.5 font-semibold text-gray-500">
            No change
          </span>
        )}
        <span className="inline-flex items-center gap-1 text-gray-500">
          <Calendar className="h-4 w-4" aria-hidden="true" />
          Last year{previousValue != null ? ` · ${format(previousValue, metric, unit)}` : ""}
        </span>
      </div>
    </div>
  );
}

function format(value: number | null | undefined, metric: Metric, unit: string): string {
  if (value == null || Number.isNaN(value)) return "-";
  if (metric === "percent") return `${value.toFixed(2)}%`;
  if (unit === "/ 5") return value.toFixed(2);
  return value.toFixed(2);
}
