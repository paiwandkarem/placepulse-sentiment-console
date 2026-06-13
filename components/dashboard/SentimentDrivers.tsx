"use client";

import { useMemo, useState } from "react";
import {
  HiArrowSmDown,
  HiArrowSmUp,
  HiOutlineChatAlt2,
  HiOutlineCheck,
  HiOutlineChevronLeft,
  HiOutlineChevronRight,
  HiOutlineExclamationCircle,
  HiOutlineSwitchHorizontal,
} from "react-icons/hi";
import { groupDrivers } from "@/lib/sentiment/themeBuckets";
import type { DriverBucket, EnrichedTheme, ReviewSentiment } from "@/lib/types";

// Single card with three sentiment buckets surfaced as tab pills:
//   What's working      themes overwhelmingly praised
//   What's not working  themes overwhelmingly criticised
//   Mixed reception     themes with real praise and criticism
//
// The list area holds a fixed minimum height (six row slots) so the card never resizes as the
// user paginates or switches tab. Each row leads with a rank, the theme label, and the
// sentiment share, with a year-on-year delta beneath. Hovering a row reveals the full
// positive / neutral / negative split. The CTA below opens the reviews drawer on the matching
// side.

const PAGE_SIZE = 6;
const LIST_MIN_HEIGHT = 456;
const MIN_DELTA_PP = 0.5;

type SideMeta = {
  Icon: typeof HiOutlineCheck;
  label: string;
  iconColour: string;
  iconBg: string;
  tabActive: string;
  pctColour: string;
  buttonAccent: string;
  caption: string;
  buttonLabel: string;
  drawerSide: ReviewSentiment;
  emptyText: string;
};

const SIDE_META: Record<DriverBucket, SideMeta> = {
  working: {
    Icon: HiOutlineCheck,
    label: "What's working",
    iconColour: "text-emerald-600",
    iconBg: "bg-emerald-100",
    tabActive: "bg-emerald-50 border-emerald-300",
    pctColour: "text-emerald-700",
    buttonAccent: "bg-emerald-600 border-emerald-600 text-white hover:bg-emerald-700 hover:border-emerald-700",
    caption:
      "Each %: of this theme's mentions, how many leaned positive. Hover a row for the full positive / neutral / negative split.",
    buttonLabel: "Read example positive reviews",
    drawerSide: "positive",
    emptyText: "No themes were strongly praised in this window.",
  },
  not_working: {
    Icon: HiOutlineExclamationCircle,
    label: "What's not working",
    iconColour: "text-rose-600",
    iconBg: "bg-rose-100",
    tabActive: "bg-rose-50 border-rose-300",
    pctColour: "text-rose-700",
    buttonAccent: "bg-rose-600 border-rose-600 text-white hover:bg-rose-700 hover:border-rose-700",
    caption:
      "Each %: of this theme's mentions, how many leaned negative. Hover a row for the full positive / neutral / negative split.",
    buttonLabel: "Read example negative reviews",
    drawerSide: "negative",
    emptyText: "No themes were strongly criticised in this window.",
  },
  mixed: {
    Icon: HiOutlineSwitchHorizontal,
    label: "Mixed reception",
    iconColour: "text-amber-600",
    iconBg: "bg-amber-100",
    tabActive: "bg-amber-50 border-amber-300",
    pctColour: "text-gray-700",
    buttonAccent: "bg-amber-500 border-amber-500 text-white hover:bg-amber-600 hover:border-amber-600",
    caption: "Themes with no clear winner. Hover a row for the full positive / neutral / negative split.",
    buttonLabel: "Read example reviews",
    drawerSide: "positive",
    emptyText: "No themes had a meaningfully mixed reception in this window.",
  },
};

const TAB_INACTIVE = "bg-white border-gray-200 hover:bg-gray-50";

const YOY_TONE_CLS = {
  good: "text-emerald-600",
  bad: "text-rose-600",
  flat: "text-gray-500",
} as const;

type YoyDirection = "good_up" | "bad_up";

// Resolve whether a percentage-point delta reads as better, worse or flat for the side it
// belongs to. Up is good for positive shares (working); up is bad for negative shares
// (not_working). Deltas under MIN_DELTA_PP are treated as no change so rounding noise stays
// quiet.
function resolveYoyTone(delta: number | undefined, direction: YoyDirection) {
  if (delta == null || Number.isNaN(delta)) return null;
  const abs = Math.abs(delta);
  if (abs < MIN_DELTA_PP) return { tone: "flat" as const, abs, up: false };
  const isGood = direction === "bad_up" ? delta < 0 : delta > 0;
  return { tone: (isGood ? "good" : "bad") as "good" | "bad", abs, up: delta > 0 };
}

function YoyDelta({
  delta,
  direction = "good_up",
  size = "sm",
  compact = false,
}: {
  delta: number | undefined;
  direction?: YoyDirection;
  size?: "sm" | "xs";
  compact?: boolean;
}) {
  const resolved = resolveYoyTone(delta, direction);
  if (!resolved) return null;
  const { tone, abs, up } = resolved;
  const flat = tone === "flat";
  const Icon = flat ? null : up ? HiArrowSmUp : HiArrowSmDown;
  const sizeCls = size === "xs" ? "text-[10px]" : "text-[11px]";
  const word = flat ? "" : tone === "good" ? "better" : "worse";
  const text = flat
    ? compact
      ? "flat"
      : "No change vs last year"
    : compact
      ? `${abs.toFixed(2)}pp`
      : `${abs.toFixed(2)}pp ${word} vs last year`;

  return (
    <span className={`inline-flex items-center gap-0.5 font-bold tabular-nums ${sizeCls} ${YOY_TONE_CLS[tone]}`}>
      {Icon ? <Icon className="h-3 w-3" /> : null}
      {text}
    </span>
  );
}

function TooltipShareRow({
  label,
  labelCls,
  current,
  last,
  delta,
  direction,
}: {
  label: string;
  labelCls: string;
  current: number;
  last: number | undefined;
  delta: number | undefined;
  direction: YoyDirection;
}) {
  const showYoy = last != null;
  return (
    <div className="flex items-center justify-between gap-4">
      <span className={labelCls}>{label}</span>
      <span className="flex items-center gap-2">
        <span className="font-semibold tabular-nums text-gray-900">{current.toFixed(2)}%</span>
        {showYoy ? <span className="text-[10px] tabular-nums text-gray-400">vs {last.toFixed(2)}%</span> : null}
        {showYoy ? <YoyDelta delta={delta} direction={direction} size="xs" compact /> : null}
      </span>
    </div>
  );
}

// The hover panel: the full pos/neutral/neg split for a theme, with last-year comparison rows
// when prior-year data merged in. Anchored to the row, it overlays on hover.
function BreakdownTooltip({ t }: { t: EnrichedTheme }) {
  return (
    <div className="pointer-events-none absolute bottom-full right-0 z-20 mb-2 hidden w-72 rounded-lg border border-gray-200 bg-white p-3 text-xs shadow-xl group-hover:block">
      <div className="mb-1.5 font-semibold text-gray-900">{t.label}</div>
      <div className="space-y-0.5">
        <TooltipShareRow
          label="Positive"
          labelCls="text-emerald-600"
          current={t.positivePct}
          last={t.positivePctLastYear}
          delta={t.positivePctDelta}
          direction="good_up"
        />
        <TooltipShareRow
          label="Neutral"
          labelCls="text-slate-500"
          current={t.neutralPct}
          last={t.neutralPctLastYear}
          delta={t.neutralPctDelta}
          direction="good_up"
        />
        <TooltipShareRow
          label="Negative"
          labelCls="text-rose-600"
          current={t.negativePct}
          last={t.negativePctLastYear}
          delta={t.negativePctDelta}
          direction="bad_up"
        />
      </div>
      <div className="mt-1.5 border-t border-gray-100 pt-1.5 text-[11px] tabular-nums text-gray-500">
        {t.reviews.toLocaleString("en-AU")} mentions total
        {t.reviewsTotalLastYear != null ? ` · ${t.reviewsTotalLastYear.toLocaleString("en-AU")} last year` : ""}
      </div>
    </div>
  );
}

function RankCell({ rank }: { rank: number }) {
  return <div className="text-sm font-semibold tabular-nums text-gray-400">{rank}</div>;
}

function TabPill({ side, count, active, onClick }: { side: DriverBucket; count: number; active: boolean; onClick: () => void }) {
  const meta = SIDE_META[side];
  const Icon = meta.Icon;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`flex min-w-0 flex-1 items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors ${active ? meta.tabActive : TAB_INACTIVE}`}
    >
      <span className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${meta.iconBg}`}>
        <Icon className={`h-5 w-5 ${meta.iconColour}`} />
      </span>
      <span className="min-w-0">
        <span className="block truncate text-sm font-bold text-gray-900">{meta.label}</span>
        <span className="block text-[11px] tabular-nums text-gray-500">
          {count} {count === 1 ? "theme" : "themes"}
        </span>
      </span>
    </button>
  );
}

function SingleSideRow({ t, rank, side }: { t: EnrichedTheme; rank: number; side: DriverBucket }) {
  const isPositive = side === "working";
  const pct = isPositive ? t.positivePct : t.negativePct;
  const reviews = isPositive ? t.positiveReviews : t.negativeReviews;
  const delta = isPositive ? t.positivePctDelta : t.negativePctDelta;
  const direction: YoyDirection = isPositive ? "good_up" : "bad_up";
  const meta = SIDE_META[side];

  return (
    <li
      className="group relative grid cursor-default items-center gap-3 py-3"
      style={{ gridTemplateColumns: "28px minmax(0, 1fr) auto" }}
    >
      <RankCell rank={rank} />
      <div className="min-w-0">
        <span className="block truncate text-sm font-semibold text-gray-900">{t.label}</span>
      </div>
      <div className="shrink-0 text-right">
        <div className={`text-lg font-bold leading-tight tabular-nums ${meta.pctColour}`}>{pct.toFixed(2)}%</div>
        {delta != null ? (
          <div className="mt-0.5">
            <YoyDelta delta={delta} direction={direction} />
          </div>
        ) : null}
        <div className="text-[11px] tabular-nums text-gray-400">{reviews.toLocaleString("en-AU")} reviews</div>
      </div>
      <BreakdownTooltip t={t} />
    </li>
  );
}

function MixedRow({ t, rank }: { t: EnrichedTheme; rank: number }) {
  return (
    <li
      className="group relative grid cursor-default items-center gap-3 py-3"
      style={{ gridTemplateColumns: "28px minmax(0, 1fr) auto" }}
    >
      <RankCell rank={rank} />
      <div className="min-w-0">
        <span className="block truncate text-sm font-semibold text-gray-900">{t.label}</span>
      </div>
      <div className="shrink-0 text-right">
        <div className="inline-flex flex-wrap items-start justify-end gap-4">
          <div className="flex flex-col items-end gap-1">
            <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-0.5 text-xs font-bold tabular-nums text-emerald-700">
              <HiOutlineCheck className="h-3.5 w-3.5" />
              {t.positivePct.toFixed(2)}%
            </span>
            <YoyDelta delta={t.positivePctDelta} direction="good_up" />
          </div>
          <div className="flex flex-col items-end gap-1">
            <span className="inline-flex items-center gap-1 rounded-md bg-rose-50 px-2 py-0.5 text-xs font-bold tabular-nums text-rose-700">
              <HiOutlineExclamationCircle className="h-3.5 w-3.5" />
              {t.negativePct.toFixed(2)}%
            </span>
            <YoyDelta delta={t.negativePctDelta} direction="bad_up" />
          </div>
        </div>
        <div className="mt-0.5 text-[11px] tabular-nums text-gray-400">{t.reviews.toLocaleString("en-AU")} mentions</div>
      </div>
      <BreakdownTooltip t={t} />
    </li>
  );
}

export function SentimentDrivers({
  drivers,
  onReadReviews,
}: {
  drivers: EnrichedTheme[];
  onReadReviews: (side: ReviewSentiment) => void;
}) {
  const buckets = useMemo(() => groupDrivers(drivers), [drivers]);

  const firstNonEmpty: DriverBucket = useMemo(() => {
    if (buckets.working.length) return "working";
    if (buckets.not_working.length) return "not_working";
    if (buckets.mixed.length) return "mixed";
    return "working";
  }, [buckets]);

  const [requestedTab, setRequestedTab] = useState<DriverBucket>(firstNonEmpty);
  const [page, setPage] = useState(0);

  // If the data shifts and the requested tab has emptied, fall back to the first bucket with
  // rows. Deriving this (rather than correcting it in an effect) keeps the render in one pass.
  const activeTab = buckets[requestedTab]?.length ? requestedTab : firstNonEmpty;

  function selectTab(side: DriverBucket) {
    setRequestedTab(side);
    setPage(0);
  }

  const meta = SIDE_META[activeTab];
  const sorted = buckets[activeTab] ?? [];
  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));

  // Clamp the page in case the active bucket shrank under the current page index.
  const safePage = Math.min(page, totalPages - 1);
  const start = safePage * PAGE_SIZE;
  const slice = sorted.slice(start, start + PAGE_SIZE);
  const showingFrom = sorted.length === 0 ? 0 : start + 1;
  const showingTo = Math.min(start + PAGE_SIZE, sorted.length);

  if (!drivers.length) {
    return (
      <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="flex h-32 items-center justify-center text-sm text-gray-500">
          No driver data for the selected window.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <TabPill side="working" count={buckets.working.length} active={activeTab === "working"} onClick={() => selectTab("working")} />
        <TabPill
          side="not_working"
          count={buckets.not_working.length}
          active={activeTab === "not_working"}
          onClick={() => selectTab("not_working")}
        />
        <TabPill side="mixed" count={buckets.mixed.length} active={activeTab === "mixed"} onClick={() => selectTab("mixed")} />
      </div>

      <p className="-mt-1 text-[11px] text-gray-500">{meta.caption}</p>

      {sorted.length === 0 ? (
        <div className="flex items-center justify-center text-sm italic text-gray-500" style={{ minHeight: LIST_MIN_HEIGHT }}>
          {meta.emptyText}
        </div>
      ) : (
        <ul className="divide-y divide-gray-100" style={{ minHeight: LIST_MIN_HEIGHT }}>
          {slice.map((t, i) =>
            activeTab === "mixed" ? (
              <MixedRow key={t.theme} t={t} rank={start + i + 1} />
            ) : (
              <SingleSideRow key={t.theme} t={t} rank={start + i + 1} side={activeTab} />
            ),
          )}
        </ul>
      )}

      <div className="flex flex-wrap items-center gap-3">
        {sorted.length > PAGE_SIZE ? (
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <span className="tabular-nums">
              Showing {showingFrom}-{showingTo} of {sorted.length}
            </span>
            <span className="inline-flex items-center gap-1">
              <button
                type="button"
                aria-label="Previous page"
                onClick={() => setPage(Math.max(0, safePage - 1))}
                disabled={safePage === 0}
                className="rounded p-1 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-30"
              >
                <HiOutlineChevronLeft className="h-4 w-4" />
              </button>
              <span className="px-1 tabular-nums">
                {safePage + 1} / {totalPages}
              </span>
              <button
                type="button"
                aria-label="Next page"
                onClick={() => setPage(Math.min(totalPages - 1, safePage + 1))}
                disabled={safePage >= totalPages - 1}
                className="rounded p-1 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-30"
              >
                <HiOutlineChevronRight className="h-4 w-4" />
              </button>
            </span>
          </div>
        ) : null}
        {activeTab !== "mixed" ? (
          <button
            type="button"
            onClick={() => onReadReviews(meta.drawerSide)}
            disabled={sorted.length === 0}
            className={`ml-auto inline-flex items-center justify-center gap-2 rounded-lg border px-4 py-2 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${meta.buttonAccent}`}
          >
            <HiOutlineChatAlt2 className="h-4 w-4" />
            {meta.buttonLabel}
          </button>
        ) : null}
      </div>
    </div>
  );
}
