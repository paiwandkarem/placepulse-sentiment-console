"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { MapPin, Search } from "lucide-react";
import { track } from "@vercel/analytics";
import { Spinner } from "@/components/ui/Spinner";
import { SuburbPanel } from "@/components/places/SuburbPanel";
import type { PlacePoint } from "@/lib/repositories/poiRepository";

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

export function PlacesExplorer({ categories }: { categories: string[] }) {
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
  const [suburbInput, setSuburbInput] = useState(suburb);

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

  function applyFilters(overrides: { query?: string; suburb?: string; category?: string }) {
    const next = { query: queryInput, suburb: suburbInput, category, ...overrides };
    const search = new URLSearchParams();
    if (next.query.trim()) search.set("q", next.query.trim());
    if (next.suburb.trim()) search.set("suburb", next.suburb.trim());
    if (next.category) search.set("category", next.category);
    const qs = search.toString();
    router.replace(qs ? `/places?${qs}` : "/places", { scroll: false });
  }

  // Clicking a suburb boundary drills into it: set the suburb filter, which refetches and reframes.
  function selectSuburb(name: string) {
    setSuburbInput(name);
    track("places_suburb_selected", { suburb: name });
    applyFilters({ suburb: name });
  }

  function clearSuburb() {
    setSuburbInput("");
    applyFilters({ suburb: "" });
  }

  return (
    <div className="relative h-[100dvh] w-full">
      <PlacesMap points={points} onSelectSuburb={selectSuburb} />

      {suburb && <SuburbPanel suburb={suburb} onClear={clearSuburb} />}

      {/* Floating controls. The wrapper ignores pointer events so the map stays draggable; the
          controls themselves re-enable them. */}
      <div className="pointer-events-none absolute inset-x-0 top-0 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <form
            onSubmit={(event) => {
              event.preventDefault();
              track("places_searched", { query: queryInput.trim(), category: category || "all" });
              applyFilters({});
            }}
            className="pointer-events-auto flex items-center gap-2 rounded-xl border border-gray-200 bg-white/95 px-3 py-1.5 shadow-md backdrop-blur"
          >
            <Search className="h-4 w-4 shrink-0 text-gray-400" />
            <input
              value={queryInput}
              onChange={(event) => setQueryInput(event.target.value)}
              placeholder="Search places by name"
              className="h-8 w-48 bg-transparent text-sm text-gray-900 outline-none placeholder:text-gray-400 sm:w-56"
            />
            <input
              value={suburbInput}
              onChange={(event) => setSuburbInput(event.target.value)}
              placeholder="Suburb"
              className="h-8 w-28 border-l border-gray-200 bg-transparent pl-2 text-sm text-gray-900 outline-none placeholder:text-gray-400"
            />
          </form>

          <select
            value={category}
            onChange={(event) => applyFilters({ category: event.target.value })}
            className="pointer-events-auto h-[42px] rounded-xl border border-gray-200 bg-white/95 px-3 text-sm text-gray-900 shadow-md outline-none backdrop-blur"
          >
            <option value="">All categories</option>
            {categories.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>

          <span className="pointer-events-auto inline-flex h-[42px] items-center gap-2 rounded-xl border border-gray-200 bg-white/95 px-3 text-sm font-medium text-gray-600 shadow-md backdrop-blur">
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
