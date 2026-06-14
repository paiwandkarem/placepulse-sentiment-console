"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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
import { cn } from "@/lib/ui/sentiment";

// A multi-select suburb map for building briefs. It reuses the dashboard map's boundary source and
// feature-state colouring (ADR D17), but instead of writing a single selection to the URL it toggles
// names through onToggle and highlights every selected suburb. The parent owns the selection and its
// cap (one suburb for overview and momentum, two or three for comparison). Only suburbs that carry
// brief data are clickable; the rest are context. mapbox-gl is imported inside the effect so it is
// code-split with this component.
const BOUNDARY_URL = process.env.NEXT_PUBLIC_SUBURB_GEOJSON_URL || "/qld-suburbs.geojson";

export function SuburbSelectMap({
  selected,
  selectable,
  onToggle,
  className,
}: {
  selected: string[];
  selectable: string[];
  onToggle: (name: string) => void;
  className?: string;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapRef = useRef<any>(null);
  const hoveredRef = useRef<string | null>(null);
  const appliedRef = useRef<Set<string>>(new Set());
  const selectedRef = useRef(selected);
  const selectableRef = useRef<Set<string>>(new Set(selectable));
  const onToggleRef = useRef(onToggle);
  const [status, setStatus] = useState<"loading" | "ready" | "error" | "no-token">(
    hasMapToken() ? "loading" : "no-token",
  );

  useEffect(() => {
    selectableRef.current = new Set(selectable);
    onToggleRef.current = onToggle;
  }, [selectable, onToggle]);

  // Move the "selected" feature-state to exactly the current selection set: clear names that left,
  // light up names that joined. A handful of cheap GPU state flips, no source re-send.
  const applySelected = useCallback((names: string[]) => {
    const map = mapRef.current;
    if (!map?.getSource?.("suburbs")) return;
    const next = new Set(names);
    for (const name of appliedRef.current) {
      if (!next.has(name)) map.setFeatureState({ source: "suburbs", id: name }, { selected: false });
    }
    for (const name of next) {
      if (!appliedRef.current.has(name)) map.setFeatureState({ source: "suburbs", id: name }, { selected: true });
    }
    appliedRef.current = next;
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
          center: [146.5, -20.5],
          zoom: 4,
          attributionControl: false,
        });
        mapRef.current = map;
        map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), "top-right");

        map.on("load", async () => {
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
            if (typeof name === "string" && selectableRef.current.has(name)) onToggleRef.current(name);
          });

          const hoverPopup = new mapboxgl.Popup({ closeButton: false, closeOnClick: false, offset: 12 });
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          map.on("mousemove", "suburb-fill", (event: any) => {
            const id = event.features?.[0]?.id;
            if (id == null) return;
            const has = selectableRef.current.has(String(id));
            map.getCanvas().style.cursor = has ? "pointer" : "";
            if (id !== hoveredRef.current) {
              if (hoveredRef.current !== null) map.setFeatureState({ source: "suburbs", id: hoveredRef.current }, { hover: false });
              hoveredRef.current = id;
              map.setFeatureState({ source: "suburbs", id }, { hover: true });
            }
            hoverPopup
              .setLngLat(event.lngLat)
              .setHTML(popupCard({ title: String(id), subtitle: has ? "Click to select" : "No brief data" }))
              .addTo(map);
          });
          map.on("mouseleave", "suburb-fill", () => {
            map.getCanvas().style.cursor = "";
            if (hoveredRef.current !== null) {
              map.setFeatureState({ source: "suburbs", id: hoveredRef.current }, { hover: false });
              hoveredRef.current = null;
            }
            hoverPopup.remove();
          });

          try {
            const fc = await fetch(BOUNDARY_URL).then((response) => response.json());
            if (cancelled) return;
            const source = map.getSource("suburbs") as { setData: (data: unknown) => void } | undefined;
            source?.setData(fc);
            appliedRef.current = new Set();
            applySelected(selectedRef.current);
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

  // Keep highlights in sync as the selection changes from anywhere (map clicks or the name search).
  useEffect(() => {
    selectedRef.current = selected;
    applySelected(selected);
  }, [selected, applySelected]);

  return (
    <div className={cn("relative h-full w-full overflow-hidden", className)}>
      <div ref={containerRef} className="h-full w-full" />
      {status !== "ready" && <MapStatusOverlay status={status} />}
      {status === "ready" && (
        <MapLegend
          className="absolute bottom-3 left-3"
          items={[
            { color: MAP_COLORS.fill, label: "Suburb" },
            { color: MAP_COLORS.hover, label: "Selected" },
          ]}
        />
      )}
    </div>
  );
}
