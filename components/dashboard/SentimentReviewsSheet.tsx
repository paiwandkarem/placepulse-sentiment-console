"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { X } from "lucide-react";
import dayjs from "dayjs";
import type { ReviewEvidence, ReviewSentiment, TopReviewGroups } from "@/lib/types";

// Slide-in drawer of example reviews, opened on demand from the drivers card. Two tabs,
// Positive and Negative. Neutral is left out: the classifier's per-review "neutral" label is
// noisy (five-star reviews routinely land there), so it adds little. Reviews are shown newest
// first with the internal sentiment score hidden.

const SENTIMENTS: Array<Exclude<ReviewSentiment, "neutral">> = ["positive", "negative"];

const SENTIMENT_META: Record<Exclude<ReviewSentiment, "neutral">, { label: string; colour: string; accentBar: string; quoteGlyph: string; emptyText: string }> = {
  positive: {
    label: "Positive",
    colour: "#16a34a",
    accentBar: "bg-emerald-500",
    quoteGlyph: "text-emerald-300",
    emptyText: "No positive reviews in this window.",
  },
  negative: {
    label: "Negative",
    colour: "#dc2626",
    accentBar: "bg-rose-500",
    quoteGlyph: "text-rose-300",
    emptyText: "No negative reviews in this window.",
  },
};

function sortByDateNewestFirst(reviews: ReviewEvidence[]): ReviewEvidence[] {
  return reviews
    .filter((r) => r.text.trim().length >= 10)
    .slice()
    .sort((a, b) => {
      const da = a.date ? dayjs(a.date).valueOf() : -Infinity;
      const db = b.date ? dayjs(b.date).valueOf() : -Infinity;
      return db - da;
    });
}

function StarBar({ rating }: { rating: number | undefined }) {
  if (rating == null || Number.isNaN(rating)) {
    return <span className="text-xs italic text-gray-500">No rating</span>;
  }
  const full = Math.round(rating);
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`${rating.toFixed(1)} stars`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <span key={i} className={i <= full ? "text-amber-400" : "text-gray-300"} aria-hidden>
          ★
        </span>
      ))}
    </span>
  );
}

function ReviewCard({ review, meta }: { review: ReviewEvidence; meta: (typeof SENTIMENT_META)[keyof typeof SENTIMENT_META] }) {
  const dateLabel = review.date && dayjs(review.date).isValid() ? dayjs(review.date).format("D MMM YYYY") : "";
  return (
    <li className="flex overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm transition-shadow hover:shadow-md">
      <div className={`w-1 shrink-0 ${meta.accentBar}`} aria-hidden="true" />
      <div className="flex min-w-0 flex-1 flex-col gap-3 px-4 py-3.5">
        <div className="flex items-start gap-2">
          <span className={`select-none font-serif text-4xl leading-none ${meta.quoteGlyph}`} aria-hidden="true">
            &ldquo;
          </span>
          <p className="break-words pt-1 text-[15px] leading-relaxed text-gray-800">{review.text}</p>
        </div>
        <div className="flex items-center gap-3 border-t border-gray-100 pt-2 text-xs text-gray-500">
          <StarBar rating={review.rating} />
          {dateLabel ? (
            <>
              <span className="text-gray-300" aria-hidden="true">
                ·
              </span>
              <span className="tabular-nums">{dateLabel}</span>
            </>
          ) : null}
        </div>
      </div>
    </li>
  );
}

function TabButton({ active, sentiment, count, onClick }: { active: boolean; sentiment: Exclude<ReviewSentiment, "neutral">; count: number; onClick: () => void }) {
  const meta = SENTIMENT_META[sentiment];
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-2 rounded-lg border px-3.5 py-2 text-sm font-semibold transition-colors ${
        active ? "border-gray-200 bg-white text-gray-900 shadow-sm" : "border-transparent bg-transparent text-gray-500 hover:text-gray-800"
      }`}
    >
      <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: meta.colour }} />
      <span>{meta.label}</span>
      <span className="text-xs text-gray-500">{count.toLocaleString("en-AU")}</span>
    </button>
  );
}

export function SentimentReviewsSheet({
  open,
  onClose,
  reviews,
  defaultTab = "positive",
  areaLabel = "",
}: {
  open: boolean;
  onClose: () => void;
  reviews: TopReviewGroups;
  defaultTab?: ReviewSentiment;
  areaLabel?: string;
}) {
  const normalisedDefault: Exclude<ReviewSentiment, "neutral"> = defaultTab === "negative" ? "negative" : "positive";
  const [activeTab, setActiveTab] = useState(normalisedDefault);

  // Snap the tab back to the requested side each time the drawer opens, while still letting the
  // user switch tabs while it stays open. Tracking the previous open state and adjusting during
  // render keeps this out of an effect.
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setActiveTab(normalisedDefault);
  }

  // Close on Escape, as expected of a modal dialog.
  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // It is aria-modal, so honour the contract: move focus into the sheet on open, keep Tab within it,
  // and restore focus to whatever opened it on close.
  const sheetRef = useRef<HTMLElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    const sheet = sheetRef.current;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    closeButtonRef.current?.focus();
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Tab" || !sheet) return;
      const focusables = sheet.querySelectorAll<HTMLElement>(
        'a[href],button:not([disabled]),textarea,input,select,[tabindex]:not([tabindex="-1"])',
      );
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
    sheet?.addEventListener("keydown", onKeyDown);
    return () => {
      sheet?.removeEventListener("keydown", onKeyDown);
      previouslyFocused?.focus?.();
    };
  }, [open]);

  const buckets = useMemo(
    () => ({
      positive: sortByDateNewestFirst(reviews.positive),
      negative: sortByDateNewestFirst(reviews.negative),
    }),
    [reviews],
  );

  const active = buckets[activeTab];
  const meta = SENTIMENT_META[activeTab];

  return (
    <>
      <div
        onClick={onClose}
        aria-hidden="true"
        className={`fixed inset-0 z-50 bg-gray-900/40 transition-opacity duration-300 ${
          open ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      />
      <aside
        ref={sheetRef}
        role="dialog"
        aria-label="Example reviews"
        aria-modal="true"
        className={`fixed inset-y-0 right-0 z-50 flex w-full transform flex-col bg-gray-50 shadow-2xl transition-transform duration-300 ease-in-out sm:max-w-2xl ${
          open ? "translate-x-0" : "pointer-events-none translate-x-full"
        }`}
      >
        <div className="flex items-start justify-between gap-3 border-b border-gray-200 bg-white px-6 pb-4 pt-6">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Example reviews</h2>
            <p className="mt-0.5 text-sm text-gray-500">
              {areaLabel ? `Representative reviews about ${areaLabel}.` : "Representative review snippets for the selected area."}{" "}
              Sorted newest first.
            </p>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            aria-label="Close reviews"
            className="rounded-lg p-1.5 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <div className="border-b border-gray-200 bg-white px-6 py-4">
          <div className="inline-flex items-center gap-1 rounded-lg bg-gray-100 p-1">
            {SENTIMENTS.map((s) => (
              <TabButton key={s} sentiment={s} active={activeTab === s} count={buckets[s].length} onClick={() => setActiveTab(s)} />
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          {active.length === 0 ? (
            <div className="flex h-40 items-center justify-center px-6 text-center text-sm text-gray-500">{meta.emptyText}</div>
          ) : (
            <ul className="space-y-3">
              {active.map((r, i) => (
                <ReviewCard key={r.id ?? `${activeTab}-${i}`} review={r} meta={meta} />
              ))}
            </ul>
          )}
        </div>
      </aside>
    </>
  );
}
