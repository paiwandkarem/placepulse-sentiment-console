"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { Map as MapIcon, X } from "lucide-react";
import { track } from "@vercel/analytics";
import { Spinner } from "@/components/ui/Spinner";
import type { PlacePoint } from "@/lib/repositories/poiRepository";

// Lazy map for the directory. The points and the Mapbox bundle are only fetched/loaded when the user
// opens the map, so the directory's first load stays lean. The parent re-keys this by the active
// filters, so opening it always reflects the current search.

const PlacesMap = dynamic(() => import("./PlacesMap").then((module) => module.PlacesMap), {
  ssr: false,
  loading: () => <MapPlaceholder />,
});

function MapPlaceholder() {
  return (
    <div className="flex h-[420px] items-center justify-center rounded-xl border border-gray-200 bg-gray-50">
      <Spinner />
    </div>
  );
}

export function PlacesMapPanel({ filters }: { filters: { query: string; suburb: string; category: string } }) {
  const [open, setOpen] = useState(false);
  const [points, setPoints] = useState<PlacePoint[] | null>(null);
  const [loading, setLoading] = useState(false);

  async function openMap() {
    setOpen(true);
    if (points) return;
    setLoading(true);
    track("places_map_opened");
    const params = new URLSearchParams();
    if (filters.query) params.set("q", filters.query);
    if (filters.suburb) params.set("suburb", filters.suburb);
    if (filters.category) params.set("category", filters.category);
    try {
      const response = await fetch(`/api/places/points?${params.toString()}`);
      const data = (await response.json()) as { points: PlacePoint[] };
      setPoints(data.points ?? []);
    } catch {
      setPoints([]);
    } finally {
      setLoading(false);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={openMap}
        className="mt-6 inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50"
      >
        <MapIcon className="h-4 w-4" />
        Show map
      </button>
    );
  }

  return (
    <div className="mt-6">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-sm font-semibold text-gray-700">
          {points ? `${points.length.toLocaleString()} places on the map` : "Loading map"}
        </span>
        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-label="Hide map"
          className="inline-flex items-center gap-1 rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      {loading || !points ? (
        <MapPlaceholder />
      ) : points.length === 0 ? (
        <div className="flex h-[200px] items-center justify-center rounded-xl border border-gray-200 bg-gray-50 text-sm text-gray-500">
          No mappable places for this search.
        </div>
      ) : (
        <PlacesMap points={points} />
      )}
    </div>
  );
}
