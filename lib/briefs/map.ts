import "server-only";
import { bbox, simplify } from "@turf/turf";
import type { Feature, FeatureCollection, Geometry } from "geojson";

// A static suburb map for the brief: the suburb's own boundary, drawn over a light basemap whose
// place labels carry the suburb name. We pull the polygon from the Queensland boundary GeoJSON we
// already host, simplify it to fit the Static Images API URL limit, and render it as a styled
// overlay framed to the shape. The map is enrichment, not load bearing: on any failure we fall back
// to a centre pin, and failing that to null, so the brief always renders.

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
const BOUNDARY_URL = process.env.NEXT_PUBLIC_SUBURB_GEOJSON_URL;

// The Static API encodes the overlay in the URL path, which Mapbox caps near 8KB. Stay well under.
const MAX_OVERLAY_CHARS = 7000;

// Fetch the boundary file once per process and reuse it. It is a few megabytes, so this avoids
// refetching on every brief within a warm instance.
let boundariesPromise: Promise<FeatureCollection> | null = null;
function loadBoundaries(): Promise<FeatureCollection> | null {
  if (!BOUNDARY_URL) return null;
  if (!boundariesPromise) {
    boundariesPromise = fetch(BOUNDARY_URL)
      .then((response) => response.json() as Promise<FeatureCollection>)
      .catch((error) => {
        boundariesPromise = null;
        throw error;
      });
  }
  return boundariesPromise;
}

function normalise(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function findFeature(collection: FeatureCollection, areaName: string): Feature | null {
  const target = normalise(areaName);
  for (const feature of collection.features) {
    const props = feature.properties ?? {};
    const candidate = (props.areaName as string) ?? (props.SAL_NAME21 as string) ?? (props.name as string);
    if (candidate && normalise(candidate) === target) return feature;
  }
  return null;
}

// Simplify the polygon down until its encoded overlay fits the URL budget. Returns the encoded
// `geojson(...)` payload, or null if even an aggressive simplify is too large.
function encodeBoundaryOverlay(feature: Feature): string | null {
  const styled: Feature = {
    type: "Feature",
    geometry: feature.geometry as Geometry,
    properties: { stroke: "#047857", "stroke-width": 2, "stroke-opacity": 0.95, fill: "#10b981", "fill-opacity": 0.12 },
  };

  // Simplify progressively until the encoded overlay fits the URL budget. The wide range of
  // tolerances means even large or intricate suburbs still encode as a boundary rather than being
  // dropped to a pin, so the whole shape is shown.
  for (const tolerance of [0.0004, 0.0008, 0.0015, 0.003, 0.006, 0.012, 0.02, 0.03]) {
    let candidate = styled;
    try {
      candidate = { ...styled, geometry: simplify(styled, { tolerance, highQuality: false }).geometry };
    } catch {
      // If simplify fails on the geometry, try the raw shape at this step.
    }
    const encoded = encodeURIComponent(JSON.stringify(candidate));
    if (encoded.length <= MAX_OVERLAY_CHARS) return encoded;
  }
  return null;
}

async function boundaryMapUrl(areaName: string): Promise<string | null> {
  const boundaries = loadBoundaries();
  if (!boundaries) return null;
  const collection = await boundaries;
  const feature = findFeature(collection, areaName);
  if (!feature) return null;
  const overlay = encodeBoundaryOverlay(feature);
  if (!overlay) return null;
  // Generous padding so the boundary never touches the edges, on a slightly taller frame.
  return `https://api.mapbox.com/styles/v1/mapbox/light-v11/static/geojson(${overlay})/auto/520x240@2x?padding=40&access_token=${MAPBOX_TOKEN}`;
}

// When the boundary cannot be encoded, frame the suburb's bounding box (still showing the whole
// extent) with a pin, rather than a fixed zoom that can crop a large suburb.
async function bboxMapUrl(areaName: string): Promise<string | null> {
  const boundaries = loadBoundaries();
  if (!boundaries) return null;
  const feature = findFeature(await boundaries, areaName);
  if (!feature) return null;
  const [minLng, minLat, maxLng, maxLat] = bbox(feature as Feature);
  const box = `[${minLng},${minLat},${maxLng},${maxLat}]`;
  return `https://api.mapbox.com/styles/v1/mapbox/light-v11/static/${box}/520x240@2x?padding=30&access_token=${MAPBOX_TOKEN}`;
}

async function pinMapUrl(areaName: string): Promise<string | null> {
  const query = encodeURIComponent(`${areaName}, Queensland, Australia`);
  const geocodeUrl = `https://api.mapbox.com/geocoding/v5/mapbox.places/${query}.json?access_token=${MAPBOX_TOKEN}&country=au&types=locality,neighborhood,place&limit=1`;
  const response = await fetch(geocodeUrl);
  if (!response.ok) return null;
  const geocode = (await response.json()) as { features?: { center?: number[] }[] };
  const center = geocode.features?.[0]?.center;
  if (!center || center.length < 2) return null;
  const [lng, lat] = center;
  return `https://api.mapbox.com/styles/v1/mapbox/light-v11/static/pin-s+047857(${lng},${lat})/${lng},${lat},11,0/520x240@2x?access_token=${MAPBOX_TOKEN}`;
}

async function toDataUri(url: string): Promise<string | null> {
  const response = await fetch(url);
  if (!response.ok) return null;
  const buffer = Buffer.from(await response.arrayBuffer());
  return `data:image/png;base64,${buffer.toString("base64")}`;
}

export async function fetchSuburbMapDataUri(areaName: string): Promise<string | null> {
  if (!MAPBOX_TOKEN) return null;
  try {
    // Prefer the real boundary; then a bounding-box frame (still shows the whole suburb); then a
    // centre pin as a last resort.
    const boundaryUrl = await boundaryMapUrl(areaName).catch(() => null);
    if (boundaryUrl) {
      const fromBoundary = await toDataUri(boundaryUrl);
      if (fromBoundary) return fromBoundary;
    }
    const boxUrl = await bboxMapUrl(areaName).catch(() => null);
    if (boxUrl) {
      const fromBox = await toDataUri(boxUrl);
      if (fromBox) return fromBox;
    }
    const pinUrl = await pinMapUrl(areaName).catch(() => null);
    return pinUrl ? await toDataUri(pinUrl) : null;
  } catch {
    return null;
  }
}
