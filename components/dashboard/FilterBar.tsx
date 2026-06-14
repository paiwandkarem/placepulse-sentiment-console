"use client";

import { useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Map } from "lucide-react";
import { track } from "@vercel/analytics";
import { aggTypeForCategory } from "@/lib/filters";
import { cn } from "@/lib/ui/sentiment";
import { Spinner } from "@/components/ui/Spinner";
import { SearchableDropdown } from "@/components/ui/SearchableDropdown";
import { useMapDrawer } from "./MapDrawerContext";
import type { FilterCatalogue, RequiredSentimentFilters } from "@/lib/types";

// "All categories" is the no-category view (the suburb-level monthly aggregate). It sits at the top
// of the category control as the default, with each category below it as a drill-down. The label is
// kept identical to the Places explorer so the unfiltered default reads the same across surfaces.
const ALL_CATEGORIES = "All categories";

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
    const category = value === ALL_CATEGORIES ? undefined : value;
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
            value={selected.areaName}
            options={catalogue.areaNames}
            disabled={isPending}
            placeholder="Search suburbs"
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
            value={selected.category ?? ALL_CATEGORIES}
            options={[ALL_CATEGORIES, ...catalogue.categories]}
            disabled={isPending}
            placeholder="Search categories"
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
