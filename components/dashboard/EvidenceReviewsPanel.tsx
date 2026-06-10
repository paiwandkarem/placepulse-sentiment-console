import { Card } from "@/components/ui/Card";
import type { TopReviewGroups } from "@/lib/types";

// Verbatim review quotes backing the metrics. Negative evidence is listed first on purpose —
// it's the most actionable for a stakeholder ("what are people actually complaining about?").
// Capped at 6 so the panel shows representative evidence, not a full feed.
export function EvidenceReviewsPanel({ reviews }: { reviews: TopReviewGroups }) {
  const items = [...reviews.negative, ...reviews.positive, ...reviews.neutral].slice(0, 6);

  return (
    <Card>
      <h2 className="text-lg font-semibold">Review evidence</h2>
      <div className="mt-4 space-y-3">
        {items.map((review, index) => (
          <blockquote
            key={`${review.text}-${index}`}
            className="rounded-xl border border-zinc-100 p-3 text-sm text-zinc-700"
          >
            “{review.text}”
            <footer className="mt-2 text-xs text-zinc-500">
              {review.sentiment}
              {review.rating ? ` • ${review.rating} stars` : ""}
            </footer>
          </blockquote>
        ))}
      </div>
    </Card>
  );
}
