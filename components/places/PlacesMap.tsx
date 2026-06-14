"use client";

import { useEffect, useRef, useState } from "react";
import "mapbox-gl/dist/mapbox-gl.css";
import { MapStatusOverlay } from "@/components/ui/MapStatusOverlay";
import { MapLegend } from "@/components/ui/MapLegend";
import {
  MAP_COLORS,
  MAP_STYLE,
  PLACES_SUBURB_FILL_OPACITY,
  PLACES_SUBURB_LINE_COLOR,
  PLACES_SUBURB_LINE_OPACITY,
  PLACES_SUBURB_LINE_WIDTH,
  SELECTED_PLACE_RING,
  SUBURB_FILL_COLOR,
  escapeHtml,
  hasMapToken,
  popupCard,
} from "@/lib/map/config";
import type { PlacePoint } from "@/lib/repositories/poiRepository";

// The clustered point map behind the Places explorer. mapbox-gl is imported inside the effect (it
// needs `window`) and this whole component is code-split, so the library stays out of the directory
// shell's first load. The map is created once; changing the points (a new filter) updates the source
// in place rather than re-creating the map, so the view never flickers. Hovering a point shows a
// quick insight card; clicking it opens the place. It shares its basemap, controls, hover card,
// status overlay and legend with the dashboard map (see lib/map/config.ts).

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type MapboxFeature = any;

// The Queensland suburb boundaries (the same source the dashboard and briefs maps use) double as a
// navigation layer here: visible when zoomed out, faded when zoomed in, and clicking one drills into
// that suburb. Falls back to the bundled static file when the CDN env var is unset, exactly like the
// other two maps, so the suburb overlay always loads (without it Places shows only points).
const BOUNDARY_URL = process.env.NEXT_PUBLIC_SUBURB_GEOJSON_URL || "/qld-suburbs.geojson";

// The hover card for a place: a single photo, the name and category, the star rating and review
// count, and a short real review. Built as an HTML string because Mapbox popups take markup, not
// React; the photo is a plain lazy <img> that hides itself on error so a stale Google thumbnail
// never shows as a broken image.
function placeInsight(properties: Record<string, unknown>): string {
  const name = escapeHtml(String(properties.name ?? "Unnamed place"));
  const category = properties.category ? escapeHtml(String(properties.category)) : "";
  const rating = properties.rating ? Number(properties.rating).toFixed(1) : "-";
  const reviews = Number(properties.reviewsCount ?? 0).toLocaleString();
  const rawImage = String(properties.image ?? "");
  const image = /^https?:\/\//i.test(rawImage) ? rawImage.replace(/"/g, "%22") : "";
  const review = properties.review ? escapeHtml(String(properties.review)) : "";

  const imageHtml = image
    ? `<img src="${image}" loading="lazy" alt="" onerror="this.style.display='none'" style="width:100%;height:104px;object-fit:cover;border-radius:8px;margin-bottom:7px;display:block" />`
    : "";
  const reviewHtml = review
    ? `<div style="font-size:11px;color:#4b5563;font-style:italic;margin-top:6px;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden">&ldquo;${review}&rdquo;</div>`
    : "";

  return `<div style="font-family:'Plus Jakarta Sans',ui-sans-serif,system-ui,sans-serif;width:220px">
    ${imageHtml}
    <div style="font-weight:600;font-size:13px;color:#111827;line-height:1.3">${name}</div>
    ${category ? `<div style="font-size:11px;color:#6b7280;margin-top:1px">${category}</div>` : ""}
    <div style="font-size:11px;color:#374151;margin-top:5px"><span style="color:#f59e0b">&#9733;</span> ${rating} &middot; ${reviews} reviews</div>
    ${reviewHtml}
    <div style="font-size:10px;color:#9ca3af;margin-top:6px">Click to open</div>
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
        image: place.image ?? "",
        review: place.review ?? "",
      },
    })),
  };
}

export function PlacesMap({
  points,
  fitKey,
  onSelectSuburb,
  onSelectPlace,
  selectedSuburb,
  selectedPlaceId,
  flyToPlaceId,
  flyToNonce,
}: {
  points: PlacePoint[];
  fitKey: string;
  onSelectSuburb?: (suburb: string) => void;
  onSelectPlace?: (placeId: string) => void;
  // The open suburb and place, so the map mirrors what the slide-over panels are showing with the
  // shared near-black selected highlight.
  selectedSuburb?: string | null;
  selectedPlaceId?: string | null;
  // Set (with an incrementing nonce) only when a place is chosen from the LIST, so the camera flies
  // to it. A place clicked on the map already has the camera on it, so that path leaves these unset.
  flyToPlaceId?: string | null;
  flyToNonce?: number;
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
                // Shared fill expression: emerald-700 when hovered or selected (matching the briefs
                // map), emerald-500 otherwise. Opacity stays faded for context but full for a selection.
                "fill-color": SUBURB_FILL_COLOR,
                "fill-opacity": PLACES_SUBURB_FILL_OPACITY,
              },
            });
            map.addLayer({
              id: "suburb-line",
              type: "line",
              source: "suburbs",
              paint: {
                "line-color": PLACES_SUBURB_LINE_COLOR,
                "line-opacity": PLACES_SUBURB_LINE_OPACITY,
                "line-width": PLACES_SUBURB_LINE_WIDTH,
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

          // The open place gets a near-black ring on top, the point equivalent of the selected-suburb
          // border. A dedicated single-feature source avoids fighting the clustered places source for
          // per-point feature-state.
          map.addSource("selected-place", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
          map.addLayer({
            id: "selected-place-ring",
            type: "circle",
            source: "selected-place",
            paint: {
              "circle-radius": SELECTED_PLACE_RING.radius,
              "circle-color": MAP_COLORS.point,
              "circle-stroke-width": SELECTED_PLACE_RING.strokeWidth,
              "circle-stroke-color": SELECTED_PLACE_RING.strokeColor,
            },
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

  // Move the near-black "selected" border onto the open suburb (and off the previous one).
  const selectedSuburbStateRef = useRef<string | null>(null);
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready || !map.getSource?.("suburbs")) return;
    const prev = selectedSuburbStateRef.current;
    if (prev && prev !== selectedSuburb) {
      map.setFeatureState({ source: "suburbs", id: prev }, { selected: false });
    }
    if (selectedSuburb) {
      map.setFeatureState({ source: "suburbs", id: selectedSuburb }, { selected: true });
    }
    selectedSuburbStateRef.current = selectedSuburb ?? null;
  }, [selectedSuburb, ready]);

  // Ring the open place. If it is not in the current point set (e.g. filtered out) the ring clears.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const source = map.getSource("selected-place");
    if (!source) return;
    const place = selectedPlaceId ? points.find((candidate) => candidate.placeId === selectedPlaceId) : undefined;
    source.setData({
      type: "FeatureCollection",
      features: place
        ? [{ type: "Feature", geometry: { type: "Point", coordinates: [place.lon, place.lat] }, properties: {} }]
        : [],
    });
  }, [selectedPlaceId, points, ready]);

  // Fly to a place chosen from the list. Triggered by the nonce so re-picking the same place still
  // flies. On wide screens the slide-over covers the right ~460px, so nudge the target left to keep
  // the place centred in the visible map area. Map-point clicks never set these, so they don't fly.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready || !flyToPlaceId) return;
    const place = points.find((candidate) => candidate.placeId === flyToPlaceId);
    if (!place) return;
    const modalOffset = window.innerWidth >= 640 ? -230 : 0;
    map.flyTo({
      center: [place.lon, place.lat],
      zoom: Math.max(map.getZoom?.() ?? 0, 14),
      offset: [modalOffset, 0],
      duration: 800,
    });
    // Trigger only on a new list pick (the nonce); reading the latest id/points through the closure.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flyToNonce, ready]);

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
