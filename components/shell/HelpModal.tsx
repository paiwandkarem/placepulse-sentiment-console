"use client";

import { useEffect, useRef } from "react";
import { Bot, Database, FileText, Gauge, MapPin, X } from "lucide-react";

// Help & docs: where the data comes from, and a short tour of each surface. Opened from the "Help and
// docs" item in the sidebar and the mobile menu. A centred dialog with a backdrop that closes on the
// close button, the backdrop, or Escape, moves focus into the panel on open, keeps Tab within it, and
// restores focus to the trigger on close.

const GITHUB_URL = "https://github.com/paiwandkarem/placepulse-sentiment-console";

const SURFACES = [
  {
    icon: Gauge,
    name: "Dashboard",
    text: "Sentiment for a suburb, and optionally one category: headline scores with year-on-year change, a three-year trend, the categories that shape it, the themes driving positive and negative reviews, the words people use, and the star and tone distributions.",
  },
  {
    icon: Bot,
    name: "Assistant",
    text: "Ask questions in plain English. It answers only from the data (every figure traces to a lookup shown in the timeline under the answer), and it can drive the dashboard for you or compare suburbs.",
  },
  {
    icon: FileText,
    name: "Briefs",
    text: "Generate a polished PDF brief, overview, suburb comparison, category deep-dive or momentum, to send up the chain. The figures and named places are read from the data, not written by the model.",
  },
  {
    icon: MapPin,
    name: "Places",
    text: "Explore individual Queensland businesses on a map, each with its theme breakdown and real review quotes behind the suburb-level numbers.",
  },
];

export function HelpModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const panel = panelRef.current;
    previouslyFocused.current = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
        return;
      }
      if (event.key !== "Tab" || !panel) return;
      const focusables = panel.querySelectorAll<HTMLElement>(
        'a[href],button:not([disabled]),[tabindex]:not([tabindex="-1"])',
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
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      previouslyFocused.current?.focus?.();
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-gray-900/50" aria-hidden="true" onClick={onClose} />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="help-title"
        className="relative flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
          <h2 id="help-title" className="text-base font-bold text-gray-900">
            Help &amp; docs
          </h2>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Close help"
            className="rounded-lg p-1.5 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          <section className="mb-5">
            <div className="mb-2 flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gray-100">
                <Database className="h-4 w-4 text-gray-600" aria-hidden="true" />
              </span>
              <h3 className="text-sm font-bold text-gray-900">Where the data comes from</h3>
            </div>
            <p className="text-sm leading-relaxed text-gray-600">
              PlacePulse is built on public customer reviews for places across Queensland. The reviews are
              processed offline, scored for sentiment, grouped into recurring themes, and rolled up into
              suburb-by-category metrics for each month, then loaded into the database the app reads from.
            </p>
            <p className="mt-2 text-sm leading-relaxed text-gray-600">
              So every number here traces back to real review data. The app reads pre-computed aggregates,
              which keeps it fast and consistent; it is refreshed on a schedule rather than scraped live.
              Coverage is Queensland only, and the assistant says so for anywhere outside that rather than
              guessing.
            </p>
          </section>

          <section>
            <h3 className="mb-2 text-sm font-bold text-gray-900">What each part does</h3>
            <ul className="space-y-3">
              {SURFACES.map(({ icon: Icon, name, text }) => (
                <li key={name} className="flex gap-3">
                  <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gray-100">
                    <Icon className="h-4 w-4 text-gray-600" aria-hidden="true" />
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{name}</p>
                    <p className="text-sm leading-relaxed text-gray-600">{text}</p>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        </div>

        <div className="border-t border-gray-200 px-5 py-3">
          <a
            href={GITHUB_URL}
            target="_blank"
            rel="noreferrer"
            className="text-xs font-semibold text-emerald-700 hover:underline"
          >
            View the source on GitHub →
          </a>
        </div>
      </div>
    </div>
  );
}
