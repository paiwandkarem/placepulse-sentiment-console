import { Card } from "@/components/ui/Card";
import type { SentimentRecord } from "@/lib/types";

// How much to trust the numbers above. Low review/text/theme coverage means the sentiment is
// drawn from a thin sample; a high rating/text conflict means stars and written sentiment
// disagree. Surfacing these next to the metrics keeps the dashboard honest — and it's the same
// signal the AI assistant is told to caveat when coverage is low.
export function CoverageConfidencePanel({ record }: { record: SentimentRecord }) {
  return (
    <Card>
      <h2 className="text-lg font-semibold">Coverage and confidence</h2>
      <dl className="mt-4 grid gap-3 text-sm">
        <Metric label="Review coverage" value={`${record.reviewCoveragePct.toFixed(1)}%`} />
        <Metric label="Text signal coverage" value={`${record.textSignalCoveragePct.toFixed(1)}%`} />
        <Metric label="Theme coverage" value={`${record.themeCoveragePct.toFixed(1)}%`} />
        <Metric label="Rating/text conflict" value={`${record.ratingTextConflictPct.toFixed(1)}%`} />
      </dl>
    </Card>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-zinc-500">{label}</dt>
      <dd className="font-medium text-zinc-900">{value}</dd>
    </div>
  );
}
