"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronDown, Map } from "lucide-react";
import { track } from "@vercel/analytics";
import { aggTypeForCategory } from "@/lib/filters";
import { cn } from "@/lib/ui/sentiment";
import { Spinner } from "@/components/ui/Spinner";
import { useMapDrawer } from "./MapDrawerContext";
import type { FilterCatalogue, RequiredSentimentFilters } from "@/lib/types";

// "Overall" is the no-category view (the suburb-level monthly aggregate). It sits at the top of
// the category control as the default, with each category below it as a drill-down.
const OVERALL = "Overall";

// Horizontal filter strip: Area, map toggle, Category. There is no period control: the
// dashboard always shows the latest month as the snapshot and the full trend over time. The
// category control switches between the overall aggregate and a single category, which also
// picks the agg_type family. Every change writes the selection to the URL and the server
// re-renders, so the view stays shareable. While a navigation is pending the controls disable so
// rapid re-clicks cannot stack requests.
export function FilterBar({
  catalogue,
  selected,
}: {
  catalogue: FilterCatalogue;
  selected: RequiredSentimentFilters;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [isPending, startTransition] = useTransition();
  // Open/close is instant client state (see MapDrawerContext); only suburb and category navigate.
  const { open: mapOpen, toggle: toggleMap } = useMapDrawer();

  // Each filter change rewrites the URL and the server re-renders the dashboard. Wrapping the
  // navigation in a transition keeps the current view interactive and gives us isPending, which
  // drives the spinner so a slow refetch reads as "working" rather than "frozen".
  function navigate(mutate: (next: URLSearchParams) => void) {
    const next = new URLSearchParams(params.toString());
    mutate(next);
    startTransition(() => router.replace(`/?${next.toString()}`, { scroll: false }));
  }

  function setParams(updates: Record<string, string>) {
    navigate((next) => {
      for (const [key, value] of Object.entries(updates)) next.set(key, value);
    });
  }

  // Overall clears the category and reads the suburb-level aggregate; a specific category reads
  // the per-category aggregate.
  function selectCategory(value: string) {
    const category = value === OVERALL ? undefined : value;
    track("dashboard_filter_changed", { kind: "category", value });
    navigate((next) => {
      next.set("aggType", aggTypeForCategory(category));
      if (category) next.set("category", category);
      else next.delete("category");
    });
  }

  return (
    <div className="w-full overflow-x-auto overscroll-x-contain rounded-xl border border-gray-200 bg-white px-4 py-3 font-sans shadow-sm">
      <div className="flex min-w-max flex-row items-center gap-5 whitespace-nowrap">
        <Field label="Suburb">
          <SearchableDropdown
            label={selected.areaName}
            options={catalogue.areaNames}
            disabled={isPending}
            onSelect={(value) => {
              track("dashboard_filter_changed", { kind: "suburb", value });
              setParams({ areaName: value });
            }}
          />
        </Field>

        <button
          type="button"
          className={cn(
            "h-9 shrink-0 rounded-lg border border-gray-200 p-2 text-gray-700 transition-colors hover:bg-gray-100",
            mapOpen && "bg-gray-900 text-white hover:bg-gray-900",
          )}
          aria-label={mapOpen ? "Close map panel" : "Open map panel"}
          aria-pressed={mapOpen}
          title={mapOpen ? "Close map panel" : "Open map panel"}
          onClick={toggleMap}
        >
          <Map className="h-4 w-4" aria-hidden="true" />
        </button>

        <Field label="Category">
          <SearchableDropdown
            label={selected.category ?? OVERALL}
            options={[OVERALL, ...catalogue.categories]}
            disabled={isPending}
            onSelect={selectCategory}
          />
        </Field>

        {isPending ? (
          <span className="ml-1 inline-flex shrink-0 items-center gap-2 text-xs font-semibold text-gray-500">
            <Spinner size="sm" />
            Updating
          </span>
        ) : null}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex min-w-fit shrink-0 items-center gap-2">
      <label className="text-xs font-semibold tracking-wide text-gray-700">{label}</label>
      {children}
    </div>
  );
}

// A searchable single-select: a trigger button that opens a filtered, scrollable list with a search
// box. The menu is positioned with fixed coordinates measured from the trigger, so the filter bar's
// horizontal overflow can never clip it. Closes on outside pointer, Escape, scroll or resize.
function SearchableDropdown({
  label,
  options,
  onSelect,
  disabled,
}: {
  label: string;
  options: string[];
  onSelect: (value: string) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [coords, setCoords] = useState<{ top: number; left: number; width: number } | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  function openMenu() {
    const rect = buttonRef.current?.getBoundingClientRect();
    if (rect) setCoords({ top: rect.bottom + 4, left: rect.left, width: Math.max(rect.width, 224) });
    setOpen(true);
  }

  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();
    function onPointer(event: PointerEvent) {
      const target = event.target as Node;
      if (!buttonRef.current?.contains(target) && !panelRef.current?.contains(target)) setOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    function onReposition() {
      setOpen(false);
    }
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", onReposition, true);
    window.addEventListener("resize", onReposition);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onReposition, true);
      window.removeEventListener("resize", onReposition);
    };
  }, [open]);

  const filtered = options.filter((option) => option.toLowerCase().includes(query.toLowerCase())).slice(0, 200);

  function choose(value: string) {
    onSelect(value);
    setOpen(false);
    setQuery("");
  }

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        disabled={disabled}
        onClick={() => (open ? setOpen(false) : openMenu())}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 text-sm font-medium text-gray-900 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <span className="max-w-[11rem] truncate">{label || "Select"}</span>
        <ChevronDown className="h-4 w-4 shrink-0 text-gray-400" aria-hidden="true" />
      </button>
      {open && coords && (
        <div
          ref={panelRef}
          style={{ position: "fixed", top: coords.top, left: coords.left, width: coords.width }}
          className="z-50 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-lg"
        >
          <div className="p-2">
            <input
              ref={inputRef}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search"
              aria-label="Search options"
              className="h-8 w-full rounded-md border border-gray-200 px-2 text-sm text-gray-900 outline-none focus:border-gray-400"
            />
          </div>
          <ul role="listbox" className="max-h-64 overflow-y-auto pb-1">
            {filtered.length === 0 ? (
              <li className="px-3 py-2 text-sm text-gray-400">No matches</li>
            ) : (
              filtered.map((option) => (
                <li key={option}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={option === label}
                    onClick={() => choose(option)}
                    className={cn(
                      "block w-full px-3 py-1.5 text-left text-sm transition-colors hover:bg-gray-100",
                      option === label ? "font-semibold text-gray-900" : "text-gray-700",
                    )}
                  >
                    {option}
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>
      )}
    </>
  );
}
