import { Card } from "@/components/ui/Card";
import type { ThemeSentiment } from "@/lib/types";

// The themes that drive sentiment for the selected slice. Capped at the top 8 so the panel
// stays scannable; the underlying record carries the full list if a detail view ever needs
// it. Theme keys arrive snake_cased from the source data, so they're humanised for display.
export function ThemeRankingPanel({ themes }: { themes: ThemeSentiment[] }) {
  return (
    <Card>
      <h2 className="text-lg font-semibold">Theme drivers</h2>
      <div className="mt-4 space-y-3">
        {themes.slice(0, 8).map((theme) => (
          <div key={`${theme.theme}-${theme.sentiment}`} className="rounded-xl border border-zinc-100 p-3">
            <div className="flex items-center justify-between gap-3">
              <p className="font-medium text-zinc-900">{theme.theme.replaceAll("_", " ")}</p>
              <span className="text-xs font-medium text-zinc-500">{theme.sentiment}</span>
            </div>
            <p className="mt-1 text-sm text-zinc-600">{theme.summary ?? `${theme.reviewCount} related reviews`}</p>
          </div>
        ))}
      </div>
    </Card>
  );
}
