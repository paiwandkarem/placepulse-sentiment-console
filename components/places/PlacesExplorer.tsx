"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { MapPin, Search } from "lucide-react";
import { track } from "@vercel/analytics";
import { Spinner } from "@/components/ui/Spinner";
import { SearchableDropdown } from "@/components/ui/SearchableDropdown";
import { SuburbPanel } from "@/components/places/SuburbPanel";
import type { PlacePoint } from "@/lib/repositories/poiRepository";

const ALL_SUBURBS = "All suburbs";
const ALL_CATEGORIES = "All categories";

// The map-native Places explorer. The map fills the surface; search and filters float over it. Filter
// state lives in the URL (shareable, back-button friendly), and the points are fetched from the API
// on the client whenever the filters change, so the directory shell paints instantly and the heavy
// map bundle loads only here.

const PlacesMap = dynamic(() => import("./PlacesMap").then((module) => module.PlacesMap), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center bg-gray-50">
      <Spinner />
    </div>
  ),
});

export function PlacesExplorer({ categories, areaNames }: { categories: string[]; areaNames: string[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  // A place is open when the intercepted route is active (the URL is /places/<id>, not /places).
  const placeOpen = pathname !== "/places";
  const query = params.get("q") ?? "";
  const suburb = params.get("suburb") ?? "";
  const category = params.get("category") ?? "";

  const [points, setPoints] = useState<PlacePoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [queryInput, setQueryInput] = useState(query);
  // A filter change requested while a place modal is open. The place lives in the intercepting
  // @modal slot, which Next keeps mounted across soft navigation, so we close it with a history pop
  // first and apply the queued filter once it has closed (see navigateToFilters).
  const pendingFilterRef = useRef<string | null>(null);

  // Refetch points whenever the URL filters change.
  useEffect(() => {
    let cancelled = false;
    // Show the loading state while points for the new filters are fetched.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    const search = new URLSearchParams();
    if (query) search.set("q", query);
    if (suburb) search.set("suburb", suburb);
    if (category) search.set("category", category);
    fetch(`/api/places/points?${search.toString()}`)
      .then((response) => response.json())
      .then((data: { points: PlacePoint[] }) => {
        if (!cancelled) {
          setPoints(data.points ?? []);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setPoints([]);
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [query, suburb, category]);

  // Once a queued filter change exists and the place modal has closed, apply it. Driving this off
  // the placeOpen transition (rather than sequencing two navigations) avoids racing the history pop.
  useEffect(() => {
    if (placeOpen || pendingFilterRef.current == null) return;
    const url = pendingFilterRef.current;
    pendingFilterRef.current = null;
    router.replace(url, { scroll: false });
  }, [placeOpen, router]);

  function navigateToFilters(search: string) {
    const url = search ? `/places?${search}` : "/places";
    if (placeOpen) {
      // Close the intercepted place first (soft navigation would leave it mounted), then apply.
      pendingFilterRef.current = url;
      router.back();
    } else {
      router.replace(url, { scroll: false });
    }
  }

  function applyFilters(overrides: { query?: string; suburb?: string; category?: string }) {
    const next = { query: queryInput, suburb, category, ...overrides };
    const search = new URLSearchParams();
    if (next.query.trim()) search.set("q", next.query.trim());
    if (next.suburb.trim()) search.set("suburb", next.suburb.trim());
    if (next.category) search.set("category", next.category);
    navigateToFilters(search.toString());
  }

  // Open a place as a slide-over, carrying the active filters in the URL so the map view and the
  // suburb context survive (and are restored when the modal closes back to /places).
  function selectPlace(placeId: string) {
    const search = new URLSearchParams();
    if (query) search.set("q", query);
    if (suburb) search.set("suburb", suburb);
    if (category) search.set("category", category);
    const qs = search.toString();
    router.push(`/places/${encodeURIComponent(placeId)}${qs ? `?${qs}` : ""}`);
  }

  // Clicking a suburb boundary (or picking one from the dropdown) drills into it: set the suburb
  // filter, which refetches and reframes.
  function selectSuburb(name: string) {
    track("places_suburb_selected", { suburb: name });
    applyFilters({ suburb: name });
  }

  function clearSuburb() {
    applyFilters({ suburb: "" });
  }

  // The camera only reframes when this changes (the user changed what they are viewing). Opening a
  // place or any other plain points refresh keeps the current zoom and centre.
  const fitKey = `${query}|${suburb}|${category}`;

  return (
    <div className="relative h-[calc(100dvh-3.5rem)] w-full md:h-[100dvh]">
      <PlacesMap points={points} fitKey={fitKey} onSelectSuburb={selectSuburb} onSelectPlace={selectPlace} />

      {suburb && <SuburbPanel suburb={suburb} onClear={clearSuburb} />}

      {/* Floating controls. The wrapper ignores pointer events so the map stays draggable; the
          controls themselves re-enable them. */}
      <div className="pointer-events-none absolute inset-x-0 top-0 p-4">
        <div className="flex max-w-full flex-wrap items-center gap-2">
          <form
            onSubmit={(event) => {
              event.preventDefault();
              track("places_searched", { query: queryInput.trim(), category: category || "all" });
              applyFilters({});
            }}
            className="pointer-events-auto flex h-9 items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 shadow-md focus-within:border-emerald-500 focus-within:ring-1 focus-within:ring-emerald-500 md:h-10"
          >
            <Search className="h-4 w-4 shrink-0 text-gray-400" aria-hidden="true" />
            <input
              value={queryInput}
              onChange={(event) => setQueryInput(event.target.value)}
              placeholder="Search places by name"
              aria-label="Search places by name"
              className="h-full w-44 bg-transparent text-sm text-gray-900 outline-none placeholder:text-gray-500 sm:w-56"
            />
          </form>

          <div className="pointer-events-auto">
            <SearchableDropdown
              value={suburb}
              options={[ALL_SUBURBS, ...areaNames]}
              placeholder={ALL_SUBURBS}
              triggerClassName="shadow-md"
              onSelect={(value) => (value === ALL_SUBURBS ? clearSuburb() : selectSuburb(value))}
            />
          </div>

          <div className="pointer-events-auto">
            <SearchableDropdown
              value={category}
              options={[ALL_CATEGORIES, ...categories]}
              placeholder={ALL_CATEGORIES}
              triggerClassName="shadow-md"
              onSelect={(value) => applyFilters({ category: value === ALL_CATEGORIES ? "" : value })}
            />
          </div>

          <span className="pointer-events-auto inline-flex h-9 items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 text-sm font-medium text-gray-600 shadow-md">
            {loading ? <Spinner size="sm" /> : `${points.length.toLocaleString()} places`}
          </span>
        </div>
      </div>

      {!placeOpen && (
        <div className="pointer-events-none absolute inset-x-0 bottom-6 flex justify-center px-4">
          <div className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white/95 px-4 py-2 text-center text-sm text-gray-600 shadow-md backdrop-blur">
            <MapPin className="h-4 w-4 shrink-0 text-emerald-600" />
            Click a place on the map to see its themes, reviews and word cloud
          </div>
        </div>
      )}
    </div>
  );
}
