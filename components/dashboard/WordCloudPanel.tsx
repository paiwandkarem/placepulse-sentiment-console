import { Card } from "@/components/ui/Card";
import type { WordCloudGroups } from "@/lib/types";

// The most common terms pulled from review text, across all three sentiment groups. Capped
// at 28 to fill the panel without overflowing. The index is part of the key because a term's
// optional `sentiment` can be undefined, which would otherwise let two identical terms
// collide on the same React key.
export function WordCloudPanel({ wordCloud }: { wordCloud: WordCloudGroups }) {
  const terms = [...wordCloud.positive, ...wordCloud.negative, ...wordCloud.neutral].slice(0, 28);

  return (
    <Card>
      <h2 className="text-lg font-semibold">Common terms</h2>
      <div className="mt-4 flex flex-wrap gap-2">
        {terms.map((term, index) => (
          <span
            key={`${term.text}-${index}`}
            className="rounded-full bg-zinc-100 px-3 py-1 text-sm text-zinc-700"
          >
            {term.text}
          </span>
        ))}
      </div>
    </Card>
  );
}
