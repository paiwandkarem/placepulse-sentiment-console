"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { HiLocationMarker, HiX } from "react-icons/hi";
import type { ExpressionSpecification } from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";

// Slide-over map used to select which suburb the dashboard shows. The
// whole national suburb set is one static, near-full-detail GeoJSON loaded once into a single
// source (built by scripts/build-suburb-boundaries.mjs), so every suburb is present with no
// streaming and no holes. Hover and selection are driven by mapbox feature-state, so the fill
// recolours on the GPU with no data churn no matter how many polygons are drawn. `promoteId`
// lifts each suburb's name to the feature id so feature-state can address it. mapbox-gl runs only
// in the effect (it needs `window`).

// The boundary file is a static asset by default; point this env at a CDN URL to serve it from
// object storage instead.
const BOUNDARY_URL = process.env.NEXT_PUBLIC_SUBURB_GEOJSON_URL || "/qld-suburbs.geojson";

// Green coverage, a deeper green on hover, purple when selected. Driven entirely by
// feature-state so mapbox recolours on the GPU without re-sending data.
const FILL_COLOR: ExpressionSpecification = [
  "case",
  ["boolean", ["feature-state", "hover"], false],
  "#047857",
  ["boolean", ["feature-state", "selected"], false],
  "#7c3aed",
  "#10b981",
];
const BORDER_COLOR = "#065f46";

export function MapPanel({ suburbs, selected }: { suburbs: string[]; selected: string }) {
  const router = useRouter();
  const params = useSearchParams();
  const containerRef = useRef<HTMLDivElement | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapRef = useRef<any>(null);
  const selectedRef = useRef(selected);
  // Feature ids (suburb names) currently carrying hover / selected state.
  const hoveredRef = useRef<string | null>(null);
  const selectedStateRef = useRef<string | null>(null);

  const hasToken = Boolean(process.env.NEXT_PUBLIC_MAPBOX_TOKEN);
  const [status, setStatus] = useState<"loading" | "ready" | "error" | "no-token">(hasToken ? "loading" : "no-token");
  const [hoverName, setHoverName] = useState<string | null>(null);

  function setParam(mutate: (next: URLSearchParams) => void) {
    const next = new URLSearchParams(params.toString());
    mutate(next);
    router.replace(`/?${next.toString()}`, { scroll: false });
  }

  // Move the "selected" feature-state onto the current selection (and off the previous one).
  const applySelected = useCallback((name: string) => {
    const map = mapRef.current;
    if (!map?.getSource?.("suburbs")) return;
    const prev = selectedStateRef.current;
    if (prev && prev !== name) map.setFeatureState({ source: "suburbs", id: prev }, { selected: false });
    if (name) map.setFeatureState({ source: "suburbs", id: name }, { selected: true });
    selectedStateRef.current = name;
  }, []);

  useEffect(() => {
    const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
    if (!token) return;
    let cancelled = false;

    (async () => {
      try {
        const mapboxgl = (await import("mapbox-gl")).default;
        mapboxgl.accessToken = token;
        if (cancelled || !containerRef.current) return;

        const map = new mapboxgl.Map({
          container: containerRef.current,
          style: "mapbox://styles/mapbox/streets-v12",
          center: [134, -25.5],
          zoom: 3,
        });
        mapRef.current = map;

        map.on("load", async () => {
          // promoteId lifts each suburb's name to the feature id so feature-state can address it.
          map.addSource("suburbs", {
            type: "geojson",
            data: { type: "FeatureCollection", features: [] },
            promoteId: "areaName",
          });
          map.addLayer({
            id: "suburb-fill",
            type: "fill",
            source: "suburbs",
            paint: { "fill-color": FILL_COLOR, "fill-opacity": 0.6 },
          });
          map.addLayer({
            id: "suburb-line",
            type: "line",
            source: "suburbs",
            paint: { "line-color": BORDER_COLOR, "line-width": 1 },
          });

          map.on("click", "suburb-fill", (event: { features?: GeoJSON.Feature[] }) => {
            const name = event.features?.[0]?.properties?.areaName;
            if (typeof name === "string") setParam((next) => next.set("areaName", name));
          });

          // Hover: paint the feature under the cursor red via feature-state, clearing the previous
          // one, and surface its name in the label box. Acts only when the hovered feature changes
          // so React state churn stays minimal. No data is re-sent, so it stays smooth.
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          map.on("mousemove", "suburb-fill", (event: any) => {
            map.getCanvas().style.cursor = "pointer";
            const id = event.features?.[0]?.id;
            if (id == null || id === hoveredRef.current) return;
            if (hoveredRef.current !== null) {
              map.setFeatureState({ source: "suburbs", id: hoveredRef.current }, { hover: false });
            }
            hoveredRef.current = id;
            map.setFeatureState({ source: "suburbs", id }, { hover: true });
            setHoverName(String(id));
          });
          map.on("mouseleave", "suburb-fill", () => {
            map.getCanvas().style.cursor = "";
            if (hoveredRef.current !== null) {
              map.setFeatureState({ source: "suburbs", id: hoveredRef.current }, { hover: false });
              hoveredRef.current = null;
            }
            setHoverName(null);
          });

          // Load every suburb in one go.
          try {
            const fc = await fetch(BOUNDARY_URL).then((r) => r.json());
            if (cancelled) return;
            const source = map.getSource("suburbs") as { setData: (data: unknown) => void } | undefined;
            source?.setData(fc);
            applySelected(selectedRef.current);

            // Frame the current selection if we can find it, otherwise stay on the national view.
            const sel = (fc.features as GeoJSON.Feature[] | undefined)?.find(
              (f) => (f.properties as { areaName?: string } | null)?.areaName === selectedRef.current,
            );
            if (sel) {
              const turf = await import("@turf/turf");
              map.fitBounds(turf.bbox(sel) as [number, number, number, number], { padding: 40, maxZoom: 12, duration: 0 });
            }
            setStatus("ready");
          } catch {
            if (!cancelled) setStatus("error");
          }
        });
      } catch {
        if (!cancelled) setStatus("error");
      }
    })();

    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep the selected highlight in sync as the URL selection changes.
  useEffect(() => {
    selectedRef.current = selected;
    applySelected(selected);
  }, [selected, applySelected]);

  return (
    <div className="flex h-full flex-col p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2 rounded-xl bg-gray-100 px-3 py-2 text-sm font-medium text-gray-800">
          <HiLocationMarker className="text-amber-500" size={18} />
          {selected}
        </div>
        <button
          type="button"
          className="rounded-lg p-2 text-gray-500 hover:bg-gray-200 hover:text-gray-800"
          aria-label="Close map"
          onClick={() => setParam((next) => next.delete("map"))}
        >
          <HiX size={18} />
        </button>
      </div>
      <p className="mb-2 px-1 text-xs text-gray-500">
        {suburbs.length.toLocaleString("en-AU")} suburbs. Click one to filter the dashboard.
      </p>
      <div className="relative min-h-0 flex-1 overflow-hidden rounded-xl border border-gray-200">
        <div ref={containerRef} className="h-full w-full" />
        {status !== "ready" && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-50 text-sm text-gray-500">
            {status === "loading" && "Loading map…"}
            {status === "error" && "Map unavailable."}
            {status === "no-token" && "Map token not configured."}
          </div>
        )}
        {status === "ready" && hoverName && (
          <div className="pointer-events-none absolute left-3 top-3 flex items-center gap-2 rounded-lg bg-white/95 px-3 py-1.5 text-sm font-semibold text-gray-800 shadow-md ring-1 ring-gray-200">
            <HiLocationMarker className="text-emerald-600" size={16} />
            {hoverName}
          </div>
        )}
      </div>
    </div>
  );
}
