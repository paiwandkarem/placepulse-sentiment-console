import { KpiCard } from "@/components/dashboard/KpiCard";
import type { SentimentRecord, SentimentTrendPoint } from "@/lib/types";

// The four headline numbers with a year-on-year change (the same period one year earlier, taken
// from the trend series). No sparkline: the value plus the YoY delta is the whole card.
export function SentimentKpiCards({
  record,
  trend,
}: {
  record: SentimentRecord;
  trend: SentimentTrendPoint[];
}) {
  // "Last year" = the period exactly one year before the selected one.
  const lastYearDate = `${Number(record.date.slice(0, 4)) - 1}${record.date.slice(4)}`;
  const lastYear = trend.find((point) => point.date === lastYearDate);

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <KpiCard
        label="Overall Sentiment"
        value={record.overallSatisfaction100}
        unit="/ 100"
        previousValue={lastYear?.overallSatisfaction100 ?? null}
        changePercent={pctChange(record.overallSatisfaction100, lastYear?.overallSatisfaction100)}
        hoverText="A blended 0 to 100 score combining the star rating with the tone of the written review. 50 is neutral; 100 is overwhelmingly positive."
      />
      <KpiCard
        label="Average Star Rating"
        value={record.avgRating}
        unit="/ 5"
        previousValue={lastYear?.avgRating ?? null}
        changePercent={pctChange(record.avgRating, lastYear?.avgRating)}
        hoverText="Mean of the 1 to 5 star ratings attached to every review in the selected period."
      />
      <KpiCard
        label="Positive Reviews"
        value={record.positivePct}
        metric="percent"
        previousValue={lastYear?.positivePct ?? null}
        changePercent={pctChange(record.positivePct, lastYear?.positivePct)}
        hoverText="Share of reviews whose written tone reads as positive."
      />
      <KpiCard
        label="Negative Reviews"
        value={record.negativePct}
        metric="percent"
        previousValue={lastYear?.negativePct ?? null}
        changePercent={pctChange(record.negativePct, lastYear?.negativePct)}
        changeDirection="lower_better"
        hoverText="Share of reviews whose written tone reads as negative."
      />
    </div>
  );
}

function pctChange(current: number, previous: number | undefined): number | null {
  if (previous == null || previous === 0) return null;
  return ((current - previous) / Math.abs(previous)) * 100;
}
