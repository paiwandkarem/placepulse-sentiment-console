import { Card } from "@/components/ui/Card";
import type { SentimentRecord } from "@/lib/types";

// The four headline numbers for the selected slice. Server-rendered from the record, so the
// figures are in the initial HTML — no client fetch, no loading flash.
export function SentimentKpiCards({ record }: { record: SentimentRecord }) {
  const kpis: Array<[label: string, value: string]> = [
    ["Overall satisfaction", record.overallSatisfaction100.toFixed(1)],
    ["Avg rating", record.avgRating.toFixed(2)],
    ["Total reviews", record.totalReviews.toLocaleString()],
    ["Negative share", `${record.negativePct.toFixed(1)}%`],
  ];

  return (
    <div className="grid gap-4 md:grid-cols-4">
      {kpis.map(([label, value]) => (
        <Card key={label}>
          <p className="text-sm text-zinc-500">{label}</p>
          <p className="mt-2 text-3xl font-semibold tracking-tight text-zinc-950">{value}</p>
        </Card>
      ))}
    </div>
  );
}
