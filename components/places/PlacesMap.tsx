"use client";

import { useEffect, useRef, useState } from "react";
import "mapbox-gl/dist/mapbox-gl.css";
import { MapStatusOverlay } from "@/components/ui/MapStatusOverlay";
import { MapLegend } from "@/components/ui/MapLegend";
import { MAP_COLORS, MAP_STYLE, escapeHtml, hasMapToken, popupCard } from "@/lib/map/config";
import type { PlacePoint } from "@/lib/repositories/poiRepository";

// The clustered point map behind the Places explorer. mapbox-gl is imported inside the effect (it
// needs `window`) and this whole component is code-split, so the library stays out of the directory
// shell's first load. The map is created once; changing the points (a new filter) updates the source
// in place rather than re-creating the map, so the view never flickers. Hovering a point shows a
// quick insight card; clicking it opens the place. It shares its basemap, controls, hover card,
// status overlay and legend with the dashboard map (see lib/map/config.ts).

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type MapboxFeature = any;

// The Queensland suburb boundaries (the dashboard map's source) double as a navigation layer here:
// visible when zoomed out, faded when zoomed in, and clicking one drills into that suburb.
const BOUNDARY_URL = process.env.NEXT_PUBLIC_SUBURB_GEOJSON_URL;

// The hover card for a place, built from the shared popup chrome.
function placeInsight(properties: Record<string, unknown>): string {
  const category = properties.category ? escapeHtml(String(properties.category)) : undefined;
  const rating = properties.rating ? Number(properties.rating).toFixed(1) : "—";
  const reviews = Number(properties.reviewsCount ?? 0).toLocaleString();
  const body = `<span style="color:#f59e0b">&#9733;</span> ${rating} &middot; ${reviews} reviews
    <div style="font-size:10px;color:#9ca3af;margin-top:4px">Click to open</div>`;
  return popupCard({ title: String(properties.name ?? "Unnamed place"), subtitle: category, body });
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

export function PlacesMap({
  points,
  fitKey,
  onSelectSuburb,
  onSelectPlace,
}: {
  points: PlacePoint[];
  fitKey: string;
  onSelectSuburb?: (suburb: string) => void;
  onSelectPlace?: (placeId: string) => void;
}) {
  // Kept in refs so the map (created once) always calls the latest handlers without re-creating.
  const onSelectSuburbRef = useRef(onSelectSuburb);
  const onSelectPlaceRef = useRef(onSelectPlace);
  useEffect(() => {
    onSelectSuburbRef.current = onSelectSuburb;
    onSelectPlaceRef.current = onSelectPlace;
  }, [onSelectSuburb, onSelectPlace]);
  const containerRef = useRef<HTMLDivElement | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapRef = useRef<any>(null);
  const [ready, setReady] = useState(false);
  const [status, setStatus] = useState<"loading" | "ready" | "error" | "no-token">(
    hasMapToken() ? "loading" : "no-token",
  );
  // The filter signature the camera was last framed to, so a plain points refresh (e.g. opening a
  // place) updates the dots without yanking the view back.
  const lastFitKeyRef = useRef<string | null>(null);

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
          style: MAP_STYLE,
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
                "fill-color": MAP_COLORS.fill,
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
                "line-color": MAP_COLORS.line,
                "line-opacity": ["interpolate", ["linear"], ["zoom"], 5, 0.5, 11, 0.12],
                "line-width": ["interpolate", ["linear"], ["zoom"], 5, 0.5, 11, 0.8],
              },
            });

            let hoveredSuburb: string | null = null;
            const suburbPopup = new mapboxgl.Popup({ closeButton: false, closeOnClick: false, offset: 12 });
            map.on("mousemove", "suburb-fill", (event: MapboxFeature) => {
              const id = event.features?.[0]?.id;
              if (id == null) return;
              if (hoveredSuburb != null && hoveredSuburb !== id) {
                map.setFeatureState({ source: "suburbs", id: hoveredSuburb }, { hover: false });
              }
              hoveredSuburb = id;
              map.setFeatureState({ source: "suburbs", id }, { hover: true });
              map.getCanvas().style.cursor = "pointer";
              suburbPopup.setLngLat(event.lngLat).setHTML(popupCard({ title: String(id) })).addTo(map);
            });
            map.on("mouseleave", "suburb-fill", () => {
              if (hoveredSuburb != null) map.setFeatureState({ source: "suburbs", id: hoveredSuburb }, { hover: false });
              hoveredSuburb = null;
              map.getCanvas().style.cursor = "";
              suburbPopup.remove();
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
              "circle-color": MAP_COLORS.cluster,
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
            paint: { "circle-color": MAP_COLORS.point, "circle-radius": 6, "circle-stroke-width": 1.5, "circle-stroke-color": "#ffffff" },
          });

          const hoverPopup = new mapboxgl.Popup({ closeButton: false, closeOnClick: false, offset: 12 });
          map.on("mousemove", "point", (event: MapboxFeature) => {
            const feature = event.features?.[0];
            if (!feature) return;
            map.getCanvas().style.cursor = "pointer";
            hoverPopup.setLngLat(feature.geometry.coordinates.slice()).setHTML(placeInsight(feature.properties)).addTo(map);
          });
          map.on("mouseleave", "point", () => {
            map.getCanvas().style.cursor = "";
            hoverPopup.remove();
          });
          map.on("click", "point", (event: MapboxFeature) => {
            const placeId = event.features?.[0]?.properties?.placeId;
            if (placeId) onSelectPlaceRef.current?.(String(placeId));
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
    // Create the map exactly once; all dynamic inputs are read through refs or the points effect.
  }, []);

  // Update the source (and frame the results) whenever the points change.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const source = map.getSource("places");
    if (!source) return;
    source.setData(toFeatureCollection(points));
    // Reframe only when the filter (fitKey) changed since the last frame, not on every points
    // update, so opening a place or a background refresh never moves the camera.
    if (points.length > 0 && fitKey !== lastFitKeyRef.current) {
      lastFitKeyRef.current = fitKey;
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
    // Driven by points changes; fitKey is read through the closure (current when points arrive for a
    // new filter). Listing fitKey here would fire before the new points load and frame the old set.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [points, ready]);

  return (
    <div className="relative h-full w-full">
      <div ref={containerRef} className="h-full w-full" />
      {status !== "ready" && <MapStatusOverlay status={status} />}
      {status === "ready" && (
        <MapLegend
          className="absolute bottom-6 left-4"
          items={[
            { color: MAP_COLORS.cluster, label: "Cluster" },
            { color: MAP_COLORS.point, label: "Place" },
          ]}
        />
      )}
    </div>
  );
}
