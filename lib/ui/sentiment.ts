import type { ReviewSentiment } from "@/lib/types";

// Tiny class combiner that keeps conditional Tailwind readable without pulling in clsx.
export function cn(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(" ");
}

// One palette for sentiment, used everywhere a positive/neutral/negative cue appears so the
// dashboard reads consistently: emerald = positive, rose = negative, slate = neutral.
export const SENTIMENT_TOKENS: Record<
  ReviewSentiment,
  { label: string; text: string; bg: string; soft: string; dot: string; bar: string }
> = {
  positive: {
    label: "Positive",
    text: "text-emerald-700",
    bg: "bg-emerald-500",
    soft: "bg-emerald-50 text-emerald-700 ring-emerald-100",
    dot: "bg-emerald-500",
    bar: "bg-emerald-500",
  },
  neutral: {
    label: "Neutral",
    text: "text-slate-600",
    bg: "bg-slate-400",
    soft: "bg-slate-100 text-slate-600 ring-slate-200",
    dot: "bg-slate-400",
    bar: "bg-slate-300",
  },
  negative: {
    label: "Negative",
    text: "text-rose-700",
    bg: "bg-rose-500",
    soft: "bg-rose-50 text-rose-700 ring-rose-100",
    dot: "bg-rose-500",
    bar: "bg-rose-500",
  },
};
