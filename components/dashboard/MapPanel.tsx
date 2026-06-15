"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2, MapPin, X } from "lucide-react";
import "mapbox-gl/dist/mapbox-gl.css";
import { MapStatusOverlay } from "@/components/ui/MapStatusOverlay";
import { MapLegend } from "@/components/ui/MapLegend";
import {
  MAP_COLORS,
  MAP_STYLE,
  SUBURB_FILL_COLOR,
  SUBURB_FILL_OPACITY,
  SUBURB_LINE_COLOR,
  SUBURB_LINE_WIDTH,
  hasMapToken,
  popupCard,
} from "@/lib/map/config";
import { useMapDrawer } from "./MapDrawerContext";

// Slide-over map used to select which suburb the dashboard shows. The whole national suburb set is
// one static, near-full-detail GeoJSON loaded once into a single source (built by
// scripts/build-suburb-boundaries.mjs), so every suburb is present with no streaming and no holes.
// Hover and selection are driven by mapbox feature-state, so the fill recolours on the GPU with no
// data churn no matter how many polygons are drawn. `promoteId` lifts each suburb's name to the
// feature id so feature-state can address it. It shares its basemap, controls, hover card, status
// overlay and legend with the Places map (see lib/map/config.ts) so the two read as one product.

// The boundary file is a static asset by default; point this env at a CDN URL to serve it from
// object storage instead.
const BOUNDARY_URL = process.env.NEXT_PUBLIC_SUBURB_GEOJSON_URL || "/qld-suburbs.geojson";

export function MapPanel({ suburbs, selected }: { suburbs: string[]; selected: string }) {
  const router = useRouter();
  const params = useSearchParams();
  const { setOpen } = useMapDrawer();
  const containerRef = useRef<HTMLDivElement | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapRef = useRef<any>(null);
  const selectedRef = useRef(selected);
  // Feature ids (suburb names) currently carrying hover / selected state.
  const hoveredRef = useRef<string | null>(null);
  const selectedStateRef = useRef<string | null>(null);

  const [status, setStatus] = useState<"loading" | "ready" | "error" | "no-token">(
    hasMapToken() ? "loading" : "no-token",
  );
  // Selecting a suburb re-renders the dashboard on the server (the page reads searchParams), so the
  // navigation can take a moment. Drive it through a transition: React keeps the current view on
  // screen (no blank flash) and isPending lets us show that the new selection is loading. pendingName
  // is the suburb we're switching to, shown until the server render lands and `selected` catches up.
  const [isPending, startTransition] = useTransition();
  const [pendingName, setPendingName] = useState<string | null>(null);

  function setParam(mutate: (next: URLSearchParams) => void, label?: string) {
    const next = new URLSearchParams(params.toString());
    mutate(next);
    if (label) setPendingName(label);
    startTransition(() => {
      router.replace(`/?${next.toString()}`, { scroll: false });
    });
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
          style: MAP_STYLE,
          center: [134, -25.5],
          zoom: 3,
          attributionControl: false,
        });
        mapRef.current = map;
        map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), "top-right");

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
            paint: { "fill-color": SUBURB_FILL_COLOR, "fill-opacity": SUBURB_FILL_OPACITY },
          });
          map.addLayer({
            id: "suburb-line",
            type: "line",
            source: "suburbs",
            paint: { "line-color": SUBURB_LINE_COLOR, "line-width": SUBURB_LINE_WIDTH },
          });

          map.on("click", "suburb-fill", (event: { features?: GeoJSON.Feature[] }) => {
            const name = event.features?.[0]?.properties?.areaName;
            if (typeof name === "string") setParam((next) => next.set("areaName", name), name);
          });

          // Hover: recolour the feature under the cursor via feature-state (clearing the previous
          // one) and float the shared hover card with its name. Acts only when the hovered feature
          // changes so React state churn stays minimal. No data is re-sent, so it stays smooth.
          const hoverPopup = new mapboxgl.Popup({ closeButton: false, closeOnClick: false, offset: 12 });
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          map.on("mousemove", "suburb-fill", (event: any) => {
            map.getCanvas().style.cursor = "pointer";
            const id = event.features?.[0]?.id;
            if (id == null) return;
            if (id !== hoveredRef.current) {
              if (hoveredRef.current !== null) {
                map.setFeatureState({ source: "suburbs", id: hoveredRef.current }, { hover: false });
              }
              hoveredRef.current = id;
              map.setFeatureState({ source: "suburbs", id }, { hover: true });
            }
            hoverPopup.setLngLat(event.lngLat).setHTML(popupCard({ title: String(id) })).addTo(map);
          });
          map.on("mouseleave", "suburb-fill", () => {
            map.getCanvas().style.cursor = "";
            if (hoveredRef.current !== null) {
              map.setFeatureState({ source: "suburbs", id: hoveredRef.current }, { hover: false });
              hoveredRef.current = null;
            }
            hoverPopup.remove();
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

        map.on("error", () => {
          if (!cancelled) setStatus("error");
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
          <MapPin className="h-[18px] w-[18px] text-emerald-600" aria-hidden="true" />
          {/* While the transition runs, show the suburb we're switching to; once it lands `selected`
              is authoritative and any stale pendingName is ignored. */}
          {isPending ? pendingName ?? selected : selected}
          {isPending && (
            <Loader2 className="h-4 w-4 animate-spin text-emerald-600" aria-label="Loading suburb" />
          )}
        </div>
        <button
          type="button"
          className="rounded-lg p-2 text-gray-500 hover:bg-gray-200 hover:text-gray-800"
          aria-label="Close map"
          onClick={() => setOpen(false)}
        >
          <X className="h-[18px] w-[18px]" aria-hidden="true" />
        </button>
      </div>
      <p className="mb-2 px-1 text-xs text-gray-500">
        {suburbs.length.toLocaleString("en-AU")} suburbs. Click one to filter the dashboard.
      </p>
      <div className="relative min-h-0 flex-1 overflow-hidden rounded-xl border border-gray-200">
        <div ref={containerRef} className="h-full w-full" />
        {/* Thin indeterminate bar while the dashboard re-renders for the new selection. */}
        {isPending && (
          <div className="absolute inset-x-0 top-0 z-10 h-0.5 animate-pulse bg-emerald-500" aria-hidden="true" />
        )}
        {status !== "ready" && <MapStatusOverlay status={status} />}
        {status === "ready" && (
          <MapLegend
            className="absolute bottom-3 left-3"
            items={[
              { color: MAP_COLORS.fill, label: "Suburb" },
              { color: MAP_COLORS.selectedLine, label: "Selected", outline: true },
            ]}
          />
        )}
      </div>
    </div>
  );
}
