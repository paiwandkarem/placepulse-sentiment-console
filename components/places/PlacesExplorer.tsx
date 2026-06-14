"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { MapPin, Search } from "lucide-react";
import { track } from "@vercel/analytics";
import { cn } from "@/lib/ui/sentiment";
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
  // The open place id (decoded from the intercepted path), so the map can ring it like the dashboard
  // and briefs maps highlight a selected suburb.
  const openPlaceId = placeOpen ? decodeURIComponent(pathname.slice("/places/".length)) : "";
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

  // Mobile shows a capped list (the map clusters everything; a few thousand DOM rows would be a CWV
  // and scroll cost), with a footer when the result set is larger.
  const listed = points.slice(0, 60);

  return (
    // Mobile: a vertical stack — controls bar, a bounded map, then a scrollable place list, so the
    // map never traps the scroll and results are browsable. Desktop: a full-bleed map explorer with
    // the controls and panels floating over it.
    <div className="relative flex h-[calc(100dvh-3.5rem)] w-full flex-col md:block md:h-[100dvh]">
      {/* Controls: an in-flow bar on mobile (stacked, full-width), floating over the map on desktop. */}
      <div className="pointer-events-auto z-30 shrink-0 border-b border-gray-200 bg-white p-3 md:pointer-events-none md:absolute md:inset-x-0 md:top-0 md:border-0 md:bg-transparent md:p-4">
        <div className="flex flex-col gap-2 md:flex-row md:flex-wrap md:items-center">
          <form
            onSubmit={(event) => {
              event.preventDefault();
              track("places_searched", { query: queryInput.trim(), category: category || "all" });
              applyFilters({});
            }}
            className="pointer-events-auto flex h-10 w-full items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 shadow-sm focus-within:border-emerald-500 focus-within:ring-1 focus-within:ring-emerald-500 md:w-auto md:shadow-md"
          >
            <Search className="h-4 w-4 shrink-0 text-gray-400" aria-hidden="true" />
            <input
              value={queryInput}
              onChange={(event) => setQueryInput(event.target.value)}
              placeholder="Search places by name"
              aria-label="Search places by name"
              className="h-full w-full bg-transparent text-sm text-gray-900 outline-none placeholder:text-gray-500 md:w-56"
            />
          </form>

          <div className="pointer-events-auto w-full md:w-auto">
            <SearchableDropdown
              value={suburb}
              options={[ALL_SUBURBS, ...areaNames]}
              placeholder={ALL_SUBURBS}
              triggerClassName="h-10 w-full shadow-sm md:h-9 md:w-auto md:shadow-md"
              onSelect={(value) => (value === ALL_SUBURBS ? clearSuburb() : selectSuburb(value))}
            />
          </div>

          <div className="pointer-events-auto w-full md:w-auto">
            <SearchableDropdown
              value={category}
              options={[ALL_CATEGORIES, ...categories]}
              placeholder={ALL_CATEGORIES}
              triggerClassName="h-10 w-full shadow-sm md:h-9 md:w-auto md:shadow-md"
              onSelect={(value) => applyFilters({ category: value === ALL_CATEGORIES ? "" : value })}
            />
          </div>

          <span className="pointer-events-auto hidden h-9 items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 text-sm font-medium text-gray-600 shadow-md md:inline-flex">
            {loading ? <Spinner size="sm" /> : `${points.length.toLocaleString()} places`}
          </span>
        </div>
      </div>

      {/* Map: a bounded panel on mobile, full-bleed on desktop. */}
      <div className="h-[40vh] w-full shrink-0 overflow-hidden md:absolute md:inset-0 md:h-full">
        <PlacesMap
          points={points}
          fitKey={fitKey}
          onSelectSuburb={selectSuburb}
          onSelectPlace={selectPlace}
          selectedSuburb={suburb || null}
          selectedPlaceId={openPlaceId || null}
        />
      </div>

      {/* Mobile-only place list below the map. */}
      <div className="min-h-0 flex-1 overflow-y-auto md:hidden" aria-label="Places">
        {loading ? (
          <div className="flex items-center justify-center py-10">
            <Spinner />
          </div>
        ) : listed.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-gray-500">No places match these filters.</p>
        ) : (
          <>
            <ul className="divide-y divide-gray-100">
              {listed.map((place) => (
                <li key={place.placeId}>
                  <button
                    type="button"
                    onClick={() => selectPlace(place.placeId)}
                    aria-current={openPlaceId === place.placeId ? "true" : undefined}
                    className={cn(
                      "flex w-full items-center gap-3 px-4 py-3 text-left transition-colors",
                      openPlaceId === place.placeId ? "bg-gray-100" : "hover:bg-gray-50",
                    )}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-gray-900">{place.name}</p>
                      <p className="truncate text-xs text-gray-500">{place.category}</p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-sm font-semibold text-gray-900">
                        {place.rating ? place.rating.toFixed(1) : "-"}
                        <span className="text-amber-500"> ★</span>
                      </p>
                      <p className="text-[11px] text-gray-400">{place.reviewsCount.toLocaleString()} reviews</p>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
            {points.length > listed.length && (
              <p className="px-4 py-3 text-center text-xs text-gray-400">
                Showing {listed.length} of {points.length.toLocaleString()}. Refine your search to narrow it down.
              </p>
            )}
          </>
        )}
      </div>

      {/* Suburb overview: floating panel on desktop only (the list + filter cover it on mobile). */}
      {suburb && (
        <div className="hidden md:block">
          <SuburbPanel suburb={suburb} onClear={clearSuburb} />
        </div>
      )}

      {!placeOpen && (
        <div className="pointer-events-none absolute inset-x-0 bottom-6 hidden justify-center px-4 md:flex">
          <div className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white/95 px-4 py-2 text-center text-sm text-gray-600 shadow-md backdrop-blur">
            <MapPin className="h-4 w-4 shrink-0 text-emerald-600" />
            Click a place on the map to see its themes, reviews and word cloud
          </div>
        </div>
      )}
    </div>
  );
}
