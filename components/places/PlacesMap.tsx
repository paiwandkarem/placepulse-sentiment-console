"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import "mapbox-gl/dist/mapbox-gl.css";
import { Spinner } from "@/components/ui/Spinner";
import type { PlacePoint } from "@/lib/repositories/poiRepository";

// The clustered point map behind the Places explorer. mapbox-gl is imported inside the effect (it
// needs `window`) and this whole component is code-split, so the library stays out of the directory
// shell's first load. The map is created once; changing the points (a new filter) updates the source
// in place rather than re-creating the map, so the view never flickers. Hovering a point shows a
// quick insight card; clicking it opens the place.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type MapboxFeature = any;

// The Queensland suburb boundaries (the dashboard map's source) double as a navigation layer here:
// visible when zoomed out, faded when zoomed in, and clicking one drills into that suburb.
const BOUNDARY_URL = process.env.NEXT_PUBLIC_SUBURB_GEOJSON_URL;

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => {
    const map: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
    return map[char] ?? char;
  });
}

function insightCard(properties: Record<string, unknown>): string {
  const name = escapeHtml(String(properties.name ?? "Unnamed place"));
  const category = escapeHtml(String(properties.category ?? ""));
  const rating = properties.rating ? Number(properties.rating).toFixed(1) : "—";
  const reviews = Number(properties.reviewsCount ?? 0).toLocaleString();
  return `<div style="font-family:'Plus Jakarta Sans',sans-serif;min-width:150px;max-width:210px;padding:2px 1px">
    <div style="font-weight:600;font-size:12px;color:#111827;line-height:1.3">${name}</div>
    ${category ? `<div style="font-size:11px;color:#6b7280;margin-top:2px">${category}</div>` : ""}
    <div style="font-size:11px;color:#374151;margin-top:5px">
      <span style="color:#f59e0b">&#9733;</span> ${rating} &middot; ${reviews} reviews
    </div>
    <div style="font-size:10px;color:#9ca3af;margin-top:4px">Click to open</div>
  </div>`;
}

function toFeatureCollection(points: PlacePoint[]) {
  return {
    type: "FeatureCollection" as const,
    features: points.map((place) => ({
      type: "Feature" as const,
      geometry: { type: "Point" as const, coordinates: [place.lon, place.lat] },
      properties: {
        placeId: place.placeId,
        name: place.name,
        category: place.category,
        rating: place.rating,
        reviewsCount: place.reviewsCount,
      },
    })),
  };
}

export function PlacesMap({ points, onSelectSuburb }: { points: PlacePoint[]; onSelectSuburb?: (suburb: string) => void }) {
  const router = useRouter();
  // Kept in a ref so the map (created once) always calls the latest handler without re-creating.
  const onSelectSuburbRef = useRef(onSelectSuburb);
  useEffect(() => {
    onSelectSuburbRef.current = onSelectSuburb;
  }, [onSelectSuburb]);
  const containerRef = useRef<HTMLDivElement | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapRef = useRef<any>(null);
  const [ready, setReady] = useState(false);
  const hasToken = Boolean(process.env.NEXT_PUBLIC_MAPBOX_TOKEN);
  const [status, setStatus] = useState<"loading" | "ready" | "error" | "no-token">(hasToken ? "loading" : "no-token");

  // Create the map once.
  useEffect(() => {
    const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
    if (!token) return;
    let cancelled = false;

    (async () => {
      try {
        const mapboxgl = (await import("mapbox-gl")).default;
        mapboxgl.accessToken = token;
        if (cancelled || !containerRef.current) return;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const map: any = new mapboxgl.Map({
          container: containerRef.current,
          style: "mapbox://styles/mapbox/light-v11",
          attributionControl: false,
          center: [146.8, -20.5],
          zoom: 4.2,
        });
        mapRef.current = map;
        map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), "top-right");

        map.on("load", () => {
          // Suburb boundaries first, so the place points and clusters sit on top and win clicks.
          if (BOUNDARY_URL) {
            map.addSource("suburbs", { type: "geojson", data: BOUNDARY_URL, promoteId: "areaName" });
            map.addLayer({
              id: "suburb-fill",
              type: "fill",
              source: "suburbs",
              paint: {
                "fill-color": "#10b981",
                // Fades out as you zoom in (boundaries are context, points take over).
                "fill-opacity": [
                  "interpolate",
                  ["linear"],
                  ["zoom"],
                  5,
                  ["case", ["boolean", ["feature-state", "hover"], false], 0.3, 0.1],
                  9,
                  ["case", ["boolean", ["feature-state", "hover"], false], 0.2, 0.04],
                  11,
                  0,
                ],
              },
            });
            map.addLayer({
              id: "suburb-line",
              type: "line",
              source: "suburbs",
              paint: {
                "line-color": "#047857",
                "line-opacity": ["interpolate", ["linear"], ["zoom"], 5, 0.5, 11, 0.12],
                "line-width": ["interpolate", ["linear"], ["zoom"], 5, 0.5, 11, 0.8],
              },
            });

            let hoveredSuburb: string | null = null;
            map.on("mousemove", "suburb-fill", (event: MapboxFeature) => {
              const id = event.features?.[0]?.id;
              if (id == null) return;
              if (hoveredSuburb != null && hoveredSuburb !== id) {
                map.setFeatureState({ source: "suburbs", id: hoveredSuburb }, { hover: false });
              }
              hoveredSuburb = id;
              map.setFeatureState({ source: "suburbs", id }, { hover: true });
              map.getCanvas().style.cursor = "pointer";
            });
            map.on("mouseleave", "suburb-fill", () => {
              if (hoveredSuburb != null) map.setFeatureState({ source: "suburbs", id: hoveredSuburb }, { hover: false });
              hoveredSuburb = null;
              map.getCanvas().style.cursor = "";
            });
            map.on("click", "suburb-fill", (event: MapboxFeature) => {
              const name = event.features?.[0]?.properties?.areaName;
              if (name) onSelectSuburbRef.current?.(String(name));
            });
          }

          map.addSource("places", { type: "geojson", data: toFeatureCollection([]), cluster: true, clusterRadius: 50, clusterMaxZoom: 14 });

          map.addLayer({
            id: "clusters",
            type: "circle",
            source: "places",
            filter: ["has", "point_count"],
            paint: {
              "circle-color": "#10b981",
              "circle-opacity": 0.85,
              "circle-radius": ["step", ["get", "point_count"], 15, 25, 20, 100, 28],
            },
          });
          map.addLayer({
            id: "cluster-count",
            type: "symbol",
            source: "places",
            filter: ["has", "point_count"],
            layout: { "text-field": ["get", "point_count_abbreviated"], "text-size": 12 },
            paint: { "text-color": "#ffffff" },
          });
          map.addLayer({
            id: "point",
            type: "circle",
            source: "places",
            filter: ["!", ["has", "point_count"]],
            paint: { "circle-color": "#047857", "circle-radius": 6, "circle-stroke-width": 1.5, "circle-stroke-color": "#ffffff" },
          });

          const hoverPopup = new mapboxgl.Popup({ closeButton: false, closeOnClick: false, offset: 12 });
          map.on("mousemove", "point", (event: MapboxFeature) => {
            const feature = event.features?.[0];
            if (!feature) return;
            map.getCanvas().style.cursor = "pointer";
            hoverPopup.setLngLat(feature.geometry.coordinates.slice()).setHTML(insightCard(feature.properties)).addTo(map);
          });
          map.on("mouseleave", "point", () => {
            map.getCanvas().style.cursor = "";
            hoverPopup.remove();
          });
          map.on("click", "point", (event: MapboxFeature) => {
            const placeId = event.features?.[0]?.properties?.placeId;
            if (placeId) router.push(`/places/${encodeURIComponent(String(placeId))}`);
          });

          map.on("click", "clusters", (event: MapboxFeature) => {
            const features = map.queryRenderedFeatures(event.point, { layers: ["clusters"] });
            const clusterId = features[0]?.properties?.cluster_id;
            if (clusterId == null) return;
            map.getSource("places").getClusterExpansionZoom(clusterId, (error: unknown, zoom: number) => {
              if (error) return;
              map.easeTo({ center: features[0].geometry.coordinates, zoom });
            });
          });
          map.on("mouseenter", "clusters", () => (map.getCanvas().style.cursor = "pointer"));
          map.on("mouseleave", "clusters", () => (map.getCanvas().style.cursor = ""));

          setReady(true);
          setStatus("ready");
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
      mapRef.current?.remove?.();
      mapRef.current = null;
    };
  }, [router]);

  // Update the source (and frame the results) whenever the points change.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const source = map.getSource("places");
    if (!source) return;
    source.setData(toFeatureCollection(points));
    if (points.length > 0) {
      let minLon = Infinity;
      let minLat = Infinity;
      let maxLon = -Infinity;
      let maxLat = -Infinity;
      for (const place of points) {
        minLon = Math.min(minLon, place.lon);
        minLat = Math.min(minLat, place.lat);
        maxLon = Math.max(maxLon, place.lon);
        maxLat = Math.max(maxLat, place.lat);
      }
      map.fitBounds(
        [
          [minLon, minLat],
          [maxLon, maxLat],
        ],
        { padding: 64, maxZoom: 13, duration: 400 },
      );
    }
  }, [points, ready]);

  return (
    <div className="relative h-full w-full">
      <div ref={containerRef} className="h-full w-full" />
      {status !== "ready" && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-50 text-sm text-gray-500">
          {status === "loading" && <Spinner />}
          {status === "no-token" && "Map token not configured."}
          {status === "error" && "Could not load the map."}
        </div>
      )}
    </div>
  );
}
