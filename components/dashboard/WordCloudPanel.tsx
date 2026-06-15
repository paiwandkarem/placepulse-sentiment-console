"use client";

import { useEffect, useMemo, useState } from "react";
import type { ReviewSentiment, WordCloudGroups, WordCloudTerm } from "@/lib/types";

// Two views of the same words across positive / negative / neutral tones:
//   Side by side : three spiral clouds (one per tone).
//   Combined     : one cloud, each word coloured by the tone it over-indexes in, sized by
//                  total mentions.
// Word widths are measured with canvas.measureText so the collision boxes match what the
// browser renders. Labels describe the SOURCE tone (the review the word came from), not a claim
// about the word itself: "food" can appear in all three.

const SENTIMENTS: ReviewSentiment[] = ["positive", "negative", "neutral"];

const SENTIMENT_META: Record<ReviewSentiment, { label: string; short: string; colour: string }> = {
  positive: { label: "In positive reviews", short: "positive", colour: "#16a34a" },
  negative: { label: "In negative reviews", short: "negative", colour: "#dc2626" },
  neutral: { label: "In neutral reviews", short: "neutral", colour: "#64748b" },
};

type WordItem = {
  term: string;
  label: string;
  mentions: number;
  reviews: number;
  dominant?: ReviewSentiment;
};

type Placed = WordItem & {
  displayLabel: string;
  x: number;
  y: number;
  w: number;
  h: number;
  fontSize: number;
  fontWeight: number;
};

function aggregateForSentiment(terms: WordCloudTerm[]): WordItem[] {
  return terms
    .filter((t) => t.term.trim().length > 0)
    .map((t) => ({ term: t.term, label: t.term, mentions: t.mentions, reviews: t.reviews }))
    .sort((a, b) => b.mentions - a.mentions)
    .slice(0, 35);
}

// Dominance is picked by SHARE WITHIN each tone, not raw mentions, so a word over-indexing in
// negative reviews lands red even if positive workhorses are mentioned more overall.
function aggregateCombined(groups: WordCloudGroups): WordItem[] {
  const map = new Map<string, { term: string; positive: number; negative: number; neutral: number; reviews: number }>();
  const totals: Record<ReviewSentiment, number> = { positive: 0, negative: 0, neutral: 0 };

  for (const sentiment of SENTIMENTS) {
    for (const t of groups[sentiment]) {
      const term = t.term.trim().toLowerCase();
      if (!term) continue;
      const cur = map.get(term) ?? { term, positive: 0, negative: 0, neutral: 0, reviews: 0 };
      cur[sentiment] += t.mentions;
      cur.reviews += t.reviews;
      totals[sentiment] += t.mentions;
      map.set(term, cur);
    }
  }

  return Array.from(map.values())
    .map((t) => {
      const mentions = t.positive + t.negative + t.neutral;
      let dominant: ReviewSentiment = "neutral";
      let best = -1;
      for (const s of SENTIMENTS) {
        const share = totals[s] ? t[s] / totals[s] : 0;
        if (share > best) {
          best = share;
          dominant = s;
        }
      }
      return { term: t.term, label: t.term, mentions, reviews: t.reviews, dominant };
    })
    .filter((t) => t.mentions > 0)
    .sort((a, b) => b.mentions - a.mentions);
}

let measureCtx: CanvasRenderingContext2D | null = null;
function measureTextWidth(text: string, fontSize: number, fontWeight: number): number {
  if (typeof document === "undefined") return text.length * fontSize * 0.65;
  if (!measureCtx) measureCtx = document.createElement("canvas").getContext("2d");
  if (!measureCtx) return text.length * fontSize * 0.65;
  measureCtx.font = `${fontWeight} ${fontSize}px ui-sans-serif, system-ui, -apple-system, "Plus Jakarta Sans", sans-serif`;
  return measureCtx.measureText(text).width;
}

const PADDING_X = 6;
const PADDING_Y = 4;

// Archimedean-spiral packing; items must be pre-sorted largest-first.
function layoutSpiral(items: WordItem[], width: number, height: number, minSize: number, maxSize: number): Placed[] {
  if (!items.length) return [];
  const maxMentions = items[0]?.mentions || 1;
  const placements: Placed[] = [];
  const occupied: Array<{ x: number; y: number; w: number; h: number }> = [];
  const collides = (x: number, y: number, w: number, h: number) =>
    occupied.some((o) => x < o.x + o.w && x + w > o.x && y < o.y + o.h && y + h > o.y);
  const cx = width / 2;
  const cy = height / 2;

  for (const t of items) {
    const ratio = Math.sqrt(Math.max(0, t.mentions) / maxMentions);
    const fontSize = Math.max(minSize, Math.round(minSize + ratio * (maxSize - minSize)));
    const fontWeight = fontSize > Math.round((minSize + maxSize) / 2) ? 700 : 500;
    const displayLabel = t.label || t.term;
    const w = Math.ceil(measureTextWidth(displayLabel, fontSize, fontWeight) + PADDING_X * 2);
    const h = Math.ceil(fontSize * 1.25 + PADDING_Y * 2);
    let radius = 0;
    let angle = 0;
    let attempt = 0;
    while (attempt < 800) {
      const x = cx + radius * Math.cos(angle) - w / 2;
      const y = cy + radius * Math.sin(angle) - h / 2;
      if (x >= 0 && y >= 0 && x + w <= width && y + h <= height && !collides(x, y, w, h)) {
        placements.push({ ...t, displayLabel, x, y, w, h, fontSize, fontWeight });
        occupied.push({ x, y, w, h });
        break;
      }
      angle += 0.35;
      radius += 0.9;
      attempt++;
    }
  }
  return placements;
}

function CloudSVG({
  placed,
  width,
  height,
  colourFor,
  onHover,
}: {
  placed: Placed[];
  width: number;
  height: number;
  colourFor: (p: Placed) => string;
  onHover: (p: Placed | null) => void;
}) {
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-full w-full">
      {placed.map((p) => (
        <text
          key={p.term}
          x={p.x + p.w / 2}
          y={p.y + p.h / 2}
          dominantBaseline="central"
          textAnchor="middle"
          fontSize={p.fontSize}
          fontWeight={p.fontWeight}
          fill={colourFor(p)}
          style={{ cursor: "pointer" }}
          onMouseEnter={() => onHover(p)}
          onMouseLeave={() => onHover(null)}
        >
          {p.displayLabel}
        </text>
      ))}
    </svg>
  );
}

function SplitCloud({ sentiment, words }: { sentiment: ReviewSentiment; words: WordItem[] }) {
  const [hover, setHover] = useState<Placed | null>(null);
  const meta = SENTIMENT_META[sentiment];
  const width = 360;
  const height = 320;
  const placed = useMemo(() => layoutSpiral(words, width, height, 13, 38), [words]);

  return (
    <div className="relative rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center gap-2">
        <span className="inline-block h-3 w-3 rounded-sm" style={{ backgroundColor: meta.colour }} />
        <span className="text-sm font-bold text-gray-900">{meta.label}</span>
        <span className="text-xs text-gray-500">· {words.length} words</span>
      </div>
      <div className="h-72">
        {placed.length ? (
          <CloudSVG placed={placed} width={width} height={height} colourFor={() => meta.colour} onHover={setHover} />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-gray-500">
            No words from {meta.short} reviews in this window.
          </div>
        )}
      </div>
      {hover ? (
        <div className="absolute inset-x-3 bottom-3 flex items-center gap-4 rounded-lg bg-gray-900/90 p-2 text-xs text-white">
          <span className="font-bold">{hover.displayLabel}</span>
          <span>{hover.mentions.toLocaleString("en-AU")} mentions</span>
          <span className="text-gray-300">{hover.reviews.toLocaleString("en-AU")} reviews</span>
        </div>
      ) : null}
    </div>
  );
}

function CombinedCloud({ items }: { items: WordItem[] }) {
  const [hover, setHover] = useState<Placed | null>(null);
  const width = 1120;
  const height = 460;
  const placed = useMemo(() => layoutSpiral(items, width, height, 10, 40), [items]);

  return (
    <div className="relative rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-4 text-xs text-gray-600">
          {SENTIMENTS.map((k) => (
            <span key={k} className="inline-flex items-center gap-1">
              <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: SENTIMENT_META[k].colour }} />
              <span>{SENTIMENT_META[k].label}</span>
            </span>
          ))}
        </div>
        <span className="text-xs text-gray-500">Each word is coloured by the tone of review it shows up most in</span>
      </div>
      <div className="h-[460px]">
        {placed.length ? (
          <CloudSVG
            placed={placed}
            width={width}
            height={height}
            colourFor={(p) => SENTIMENT_META[p.dominant ?? "neutral"].colour}
            onHover={setHover}
          />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-gray-500">No words in this window.</div>
        )}
      </div>
      {hover ? (
        <div className="absolute inset-x-3 bottom-3 flex items-baseline justify-between gap-3 rounded-lg bg-gray-900/90 p-2.5 text-xs text-white">
          <span className="text-sm font-bold">{hover.displayLabel}</span>
          <span className="tabular-nums text-gray-300">
            {hover.mentions.toLocaleString("en-AU")} mentions across positive, neutral and negative reviews
          </span>
        </div>
      ) : null}
    </div>
  );
}

function ViewToggle({ value, onChange }: { value: "split" | "combined"; onChange: (v: "split" | "combined") => void }) {
  const base =
    "rounded-md px-3 py-1.5 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-1";
  const active = "bg-white text-gray-900 shadow-sm";
  const inactive = "text-gray-500 hover:text-gray-800";
  return (
    <div className="inline-flex items-center gap-1 rounded-lg bg-gray-100 p-1" role="group" aria-label="Word cloud view">
      <button
        type="button"
        onClick={() => onChange("split")}
        aria-pressed={value === "split"}
        className={`${base} ${value === "split" ? active : inactive}`}
      >
        Side by side
      </button>
      <button
        type="button"
        onClick={() => onChange("combined")}
        aria-pressed={value === "combined"}
        className={`${base} ${value === "combined" ? active : inactive}`}
      >
        Combined
      </button>
    </div>
  );
}

export function WordCloudPanel({ wordCloud }: { wordCloud: WordCloudGroups }) {
  const [view, setView] = useState<"split" | "combined">("combined");
  // The spiral layout measures word widths with canvas.measureText, which doesn't exist during
  // SSR, so the server and client would place words differently and React would flag a hydration
  // mismatch. Render the cloud only after mount; until then show a same-height placeholder so the
  // section doesn't shift when it swaps in.
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  const positive = useMemo(() => aggregateForSentiment(wordCloud.positive), [wordCloud]);
  const negative = useMemo(() => aggregateForSentiment(wordCloud.negative), [wordCloud]);
  const neutral = useMemo(() => aggregateForSentiment(wordCloud.neutral), [wordCloud]);
  const combined = useMemo(() => aggregateCombined(wordCloud), [wordCloud]);

  return (
    <div>
      <div className="mb-3 flex justify-end">
        <ViewToggle value={view} onChange={setView} />
      </div>
      {!mounted ? (
        <div className="animate-pulse rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="h-[460px] rounded-lg bg-gray-100" />
        </div>
      ) : view === "split" ? (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <SplitCloud sentiment="positive" words={positive} />
          <SplitCloud sentiment="negative" words={negative} />
          <SplitCloud sentiment="neutral" words={neutral} />
        </div>
      ) : (
        <CombinedCloud items={combined} />
      )}
    </div>
  );
}
