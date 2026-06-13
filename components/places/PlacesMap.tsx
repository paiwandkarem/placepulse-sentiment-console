"use client";

import { useEffect, useRef, useState } from "react";
import "mapbox-gl/dist/mapbox-gl.css";
import { Spinner } from "@/components/ui/Spinner";
import type { PlacePoint } from "@/lib/repositories/poiRepository";

// A clustered point map of the directory's places. mapbox-gl is imported inside the effect (it needs
// `window`) and this whole component is code-split, so neither the library nor this code touch the
// directory's first load. Points are clustered on the GPU, so a few hundred markers stay smooth.

export function PlacesMap({ points }: { points: PlacePoint[] }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapRef = useRef<any>(null);
  const hasToken = Boolean(process.env.NEXT_PUBLIC_MAPBOX_TOKEN);
  const [status, setStatus] = useState<"loading" | "ready" | "error" | "no-token">(hasToken ? "loading" : "no-token");

  useEffect(() => {
    const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
    if (!token || points.length === 0) return;
    let cancelled = false;

    (async () => {
      try {
        const mapboxgl = (await import("mapbox-gl")).default;
        mapboxgl.accessToken = token;
        if (cancelled || !containerRef.current) return;

        const featureCollection = {
          type: "FeatureCollection" as const,
          features: points.map((place) => ({
            type: "Feature" as const,
            geometry: { type: "Point" as const, coordinates: [place.lon, place.lat] },
            properties: { placeId: place.placeId, name: place.name, rating: place.rating },
          })),
        };

        // Treated as any for the dynamic GL calls below (cluster expansion, feature geometry), the
        // same way the dashboard map does; the mapbox-gl types do not narrow these cleanly.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const map: any = new mapboxgl.Map({
          container: containerRef.current,
          style: "mapbox://styles/mapbox/light-v11",
          attributionControl: false,
        });
        mapRef.current = map;
        map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), "top-right");

        map.on("load", () => {
          map.addSource("places", { type: "geojson", data: featureCollection, cluster: true, clusterRadius: 50, clusterMaxZoom: 14 });

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

          const bounds = new mapboxgl.LngLatBounds();
          for (const place of points) bounds.extend([place.lon, place.lat]);
          map.fitBounds(bounds, { padding: 40, maxZoom: 13, duration: 0 });
          setStatus("ready");
        });

        // Click a cluster to zoom into it.
        map.on("click", "clusters", (event: { point: unknown }) => {
          const features = map.queryRenderedFeatures(event.point, { layers: ["clusters"] });
          const clusterId = features[0]?.properties?.cluster_id;
          if (clusterId == null) return;
          map.getSource("places").getClusterExpansionZoom(clusterId, (error: unknown, zoom: number) => {
            if (error) return;
            map.easeTo({ center: features[0].geometry.coordinates, zoom });
          });
        });

        // Click a point to see its name and a link to the detail page.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        map.on("click", "point", (event: any) => {
          const feature = event.features?.[0];
          if (!feature) return;
          const { name, placeId, rating } = feature.properties;
          const coordinates = feature.geometry.coordinates.slice();
          const ratingLabel = rating ? `${Number(rating).toFixed(1)} stars` : "Unrated";
          new mapboxgl.Popup({ closeButton: false, offset: 12 })
            .setLngLat(coordinates)
            .setHTML(
              `<div style="font-family:inherit;font-size:12px;max-width:180px">
                 <strong>${name}</strong><br/><span style="color:#6b7280">${ratingLabel}</span><br/>
                 <a href="/places/${encodeURIComponent(placeId)}" style="color:#047857;font-weight:600">View place</a>
               </div>`,
            )
            .addTo(map);
        });

        for (const layer of ["clusters", "point"]) {
          map.on("mouseenter", layer, () => (map.getCanvas().style.cursor = "pointer"));
          map.on("mouseleave", layer, () => (map.getCanvas().style.cursor = ""));
        }
      } catch {
        if (!cancelled) setStatus("error");
      }
    })();

    return () => {
      cancelled = true;
      mapRef.current?.remove?.();
      mapRef.current = null;
    };
  }, [points]);

  return (
    <div className="relative h-[420px] w-full overflow-hidden rounded-xl border border-gray-200">
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
