import type { DriverBucket, EnrichedTheme, ThemeSentiment } from "@/lib/types";

// Single source of truth for the rule that splits review themes into "What's working" /
// "What's not working" / "Mixed reception". The drivers card renders from it. Keeping the
// thresholds here (not in the component) means one edit moves the whole classification.
//
// Our themes arrive already aggregated per theme (one entry per theme inside
// theme_sentiment_json), so unlike a raw-row pipeline there is nothing to sum: we classify,
// attach the year-on-year deltas, and rank within each bucket.

// Classify by the dominant side first. A theme is a decisive winner when the leading side
// clears CLEAR_THRESHOLD outright, or clears MAJORITY_THRESHOLD with at least GAP_MIN points
// between the two sides. Anything else only counts as Mixed when both sides carry real
// opinion (each above MIXED_SIDE_MIN, combined above MIXED_OPINION_MIN); the rest are dropped.
const CLEAR_THRESHOLD = 60;
const MAJORITY_THRESHOLD = 50;
const GAP_MIN = 15;
const MIXED_SIDE_MIN = 20;
const MIXED_OPINION_MIN = 50;

function humanise(theme: string): string {
  return theme.replaceAll("_", " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function classifyTheme(positivePct: number, negativePct: number): DriverBucket | null {
  const pos = Number(positivePct || 0);
  const neg = Number(negativePct || 0);
  const dominant = Math.max(pos, neg);
  const gap = Math.abs(pos - neg);
  const opinion = pos + neg;

  const decisive = dominant >= CLEAR_THRESHOLD || (dominant >= MAJORITY_THRESHOLD && gap >= GAP_MIN);
  if (decisive) return pos >= neg ? "working" : "not_working";

  if (Math.min(pos, neg) >= MIXED_SIDE_MIN && opinion >= MIXED_OPINION_MIN) return "mixed";
  return null;
}

// Merge the current themes with the matching slice from a year earlier (keyed by theme), so
// each row can show "1.86pp worse vs last year". Themes with no prior-year match keep
// hasYoy=false and the UI leaves the chip empty rather than inventing a delta.
function attachYoy(themes: ThemeSentiment[], lastYear: ThemeSentiment[] | null): EnrichedTheme[] {
  const lastByTheme = new Map((lastYear ?? []).map((t) => [t.theme, t]));

  return themes.map((t) => {
    const base: EnrichedTheme = {
      ...t,
      label: humanise(t.theme),
      uiBucket: classifyTheme(t.positivePct, t.negativePct),
      uiRankInBucket: null,
      hasYoy: false,
    };

    const ly = lastByTheme.get(t.theme);
    if (!ly || ly.reviews === 0) return base;

    return {
      ...base,
      hasYoy: true,
      positivePctLastYear: ly.positivePct,
      negativePctLastYear: ly.negativePct,
      neutralPctLastYear: ly.neutralPct,
      positivePctDelta: t.positivePct - ly.positivePct,
      negativePctDelta: t.negativePct - ly.negativePct,
      neutralPctDelta: t.neutralPct - ly.neutralPct,
      reviewsTotalLastYear: ly.reviews,
    };
  });
}

// Order each bucket the way the card reads it: praise and criticism by the loudest side's
// review count, mixed by total volume. The stable uiRankInBucket lets the UI label rows
// without re-deriving the sort.
export function enrichThemes(themes: ThemeSentiment[], lastYear: ThemeSentiment[] | null): EnrichedTheme[] {
  const enriched = attachYoy(themes, lastYear);

  const working = enriched.filter((t) => t.uiBucket === "working").sort((a, b) => b.positiveReviews - a.positiveReviews);
  const notWorking = enriched
    .filter((t) => t.uiBucket === "not_working")
    .sort((a, b) => b.negativeReviews - a.negativeReviews);
  const mixed = enriched.filter((t) => t.uiBucket === "mixed").sort((a, b) => b.reviews - a.reviews);
  const unbucketed = enriched.filter((t) => t.uiBucket === null);

  working.forEach((t, i) => (t.uiRankInBucket = i + 1));
  notWorking.forEach((t, i) => (t.uiRankInBucket = i + 1));
  mixed.forEach((t, i) => (t.uiRankInBucket = i + 1));

  return [...working, ...notWorking, ...mixed, ...unbucketed];
}

export function groupDrivers(themes: EnrichedTheme[]): Record<DriverBucket, EnrichedTheme[]> {
  return {
    working: themes.filter((t) => t.uiBucket === "working"),
    not_working: themes.filter((t) => t.uiBucket === "not_working"),
    mixed: themes.filter((t) => t.uiBucket === "mixed"),
  };
}
