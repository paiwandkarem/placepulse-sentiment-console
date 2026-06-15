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
  // Set only when a place is picked from the list, so the map flies to it (the nonce re-triggers a
  // fly even if the same place is re-picked). Picking a place on the map leaves this untouched.
  const [flyTo, setFlyTo] = useState<{ placeId: string; nonce: number } | null>(null);
  // A filter change requested while a place modal is open. The place lives in the intercepting
  // @modal slot, which Next keeps mounted across soft navigation, so we close it with a history pop
  // first and apply the queued filter once it has closed (see navigateToFilters).
  const pendingFilterRef = useRef<string | null>(null);

  // Mobile vs desktop: the suburb overview floats over the map on desktop, but on phones (where the
  // map is only 40vh) it renders as a card at the top of the scrollable list instead. Tracked in JS so
  // only one of the two mounts and the overview is fetched once. Defaults to mobile; set on mount.
  const [isDesktop, setIsDesktop] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    const update = () => setIsDesktop(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

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

  // The place URL carries the active filters so the map view and suburb context survive (and are
  // restored when the slide-over closes back to /places).
  function placeHref(placeId: string): string {
    const search = new URLSearchParams();
    if (query) search.set("q", query);
    if (suburb) search.set("suburb", suburb);
    if (category) search.set("category", category);
    const qs = search.toString();
    return `/places/${encodeURIComponent(placeId)}${qs ? `?${qs}` : ""}`;
  }

  // Open a place as a slide-over (intercepted route). Opening the first place pushes a history
  // entry (so closing returns to the list); switching to another place while one is already open
  // replaces it, so the slide-overs don't stack and closing returns straight to /places.
  function selectPlace(placeId: string) {
    if (placeOpen) {
      router.replace(placeHref(placeId), { scroll: false });
    } else {
      router.push(placeHref(placeId));
    }
  }

  // Open a place chosen from the list, and fly the map to it. Map-point clicks already have the
  // camera on the place, so they call selectPlace directly; only list picks need the camera moved.
  function selectPlaceFromList(placeId: string) {
    setFlyTo((current) => ({ placeId, nonce: (current?.nonce ?? 0) + 1 }));
    selectPlace(placeId);
  }

  // Warm the route and its cached profile on hover/focus, so opening the slide-over feels instant.
  function prefetchPlace(placeId: string) {
    router.prefetch(placeHref(placeId));
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

  // Only the very first load shows a spinner; a filter change keeps the current results on screen
  // (stale-while-revalidating) and swaps them in when the new set arrives, so nothing flashes.
  const placeList = loading && points.length === 0 ? (
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
              onClick={() => selectPlaceFromList(place.placeId)}
              onMouseEnter={() => prefetchPlace(place.placeId)}
              onFocus={() => prefetchPlace(place.placeId)}
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
                <p className="text-[11px] text-gray-500">{place.reviewsCount.toLocaleString()} reviews</p>
              </div>
            </button>
          </li>
        ))}
      </ul>
      {points.length > listed.length && (
        <p className="px-4 py-3 text-center text-xs text-gray-500">
          Showing {listed.length} of {points.length.toLocaleString()}. Refine your search to narrow it down.
        </p>
      )}
    </>
  );

  return (
    // Mobile: a vertical stack — controls bar, a bounded map, then a scrollable place list. Desktop:
    // a two-column grid — a left rail (controls on top, list below) and the map filling the right —
    // so results are always browsable alongside the map, on every screen.
    <div className="flex h-[calc(100dvh-3.5rem)] w-full flex-col md:grid md:h-[100dvh] md:grid-cols-[22rem_1fr] md:grid-rows-[auto_minmax(0,1fr)]">
      {/* Controls: full-width stacked, the rail header on desktop. */}
      <div className="z-30 shrink-0 border-b border-gray-200 bg-white p-3 md:col-start-1 md:row-start-1 md:border-r">
        <div className="flex flex-col gap-2">
          <form
            onSubmit={(event) => {
              event.preventDefault();
              track("places_searched", { query: queryInput.trim(), category: category || "all" });
              applyFilters({});
            }}
            className="flex h-10 w-full items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 focus-within:border-emerald-500 focus-within:ring-1 focus-within:ring-emerald-500"
          >
            <Search className="h-4 w-4 shrink-0 text-gray-500" aria-hidden="true" />
            <input
              value={queryInput}
              onChange={(event) => setQueryInput(event.target.value)}
              placeholder="Search places by name"
              aria-label="Search places by name"
              className="h-full w-full bg-transparent text-sm text-gray-900 outline-none placeholder:text-gray-500"
            />
          </form>
          <div className="flex gap-2">
            <div className="min-w-0 flex-1">
              <SearchableDropdown
                value={suburb}
                options={[ALL_SUBURBS, ...areaNames]}
                placeholder={ALL_SUBURBS}
                triggerClassName="h-10 w-full"
                onSelect={(value) => (value === ALL_SUBURBS ? clearSuburb() : selectSuburb(value))}
              />
            </div>
            <div className="min-w-0 flex-1">
              <SearchableDropdown
                value={category}
                options={[ALL_CATEGORIES, ...categories]}
                placeholder={ALL_CATEGORIES}
                triggerClassName="h-10 w-full"
                onSelect={(value) => applyFilters({ category: value === ALL_CATEGORIES ? "" : value })}
              />
            </div>
          </div>
          <span className="px-0.5 text-xs font-medium text-gray-500">
            {loading && points.length === 0
              ? "Loading places…"
              : `${points.length.toLocaleString()} places${loading ? " · updating…" : ""}`}
          </span>
        </div>
      </div>

      {/* Map: bounded panel on mobile, the right column on desktop (relative so the panels anchor). */}
      <div className="relative h-[40vh] w-full shrink-0 overflow-hidden md:col-start-2 md:row-span-2 md:h-full">
        <PlacesMap
          points={points}
          fitKey={fitKey}
          onSelectSuburb={selectSuburb}
          onSelectPlace={selectPlace}
          selectedSuburb={suburb || null}
          selectedPlaceId={openPlaceId || null}
          flyToPlaceId={flyTo?.placeId ?? null}
          flyToNonce={flyTo?.nonce}
        />

        {/* Suburb overview: floating over the map on desktop. */}
        {isDesktop && suburb && <SuburbPanel suburb={suburb} onClear={clearSuburb} />}

        {!placeOpen && (
          <div className="pointer-events-none absolute inset-x-0 bottom-6 hidden justify-center px-4 md:flex">
            <div className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white/95 px-4 py-2 text-center text-sm text-gray-600 shadow-md backdrop-blur">
              <MapPin className="h-4 w-4 shrink-0 text-emerald-600" />
              Click a place on the map to see its themes, reviews and word cloud
            </div>
          </div>
        )}
      </div>

      {/* Place list: below the map on mobile, the bottom of the left rail on desktop. */}
      <div
        className="min-h-0 flex-1 overflow-y-auto bg-white md:col-start-1 md:row-start-2 md:border-r md:border-gray-200"
        aria-label="Places"
      >
        {/* On phones the suburb overview cannot float over the small map, so it sits at the top of the
            scrollable list when a suburb is selected. */}
        {!isDesktop && suburb && (
          <div className="border-b border-gray-100 p-3">
            <SuburbPanel
              suburb={suburb}
              onClear={clearSuburb}
              className="overflow-hidden rounded-xl border border-gray-200 bg-white"
            />
          </div>
        )}
        {placeList}
      </div>
    </div>
  );
}
