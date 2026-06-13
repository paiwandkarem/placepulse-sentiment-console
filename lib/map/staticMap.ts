// Builds Mapbox Static Images API URLs: a locator map rendered as a single PNG, with no mapbox-gl
// on the client. It is the cheap, CWV-friendly way to show "where" without shipping the interactive
// map bundle (the briefs already use this API server-side; this is the client-safe URL builder for
// live surfaces). Returns null when there is no token or no usable coordinate, so callers can fall
// back gracefully. The token is the public NEXT_PUBLIC one, so the URL is safe to build anywhere.

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

export function placeStaticMapUrl(
  lat: number,
  lon: number,
  opts: { width?: number; height?: number; zoom?: number; retina?: boolean } = {},
): string | null {
  if (!MAPBOX_TOKEN) return null;
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || (lat === 0 && lon === 0)) return null;
  const { width = 480, height = 240, zoom = 14, retina = true } = opts;
  // Emerald pin to match the app's map language.
  const marker = `pin-s+047857(${lon},${lat})`;
  const size = `${width}x${height}${retina ? "@2x" : ""}`;
  return `https://api.mapbox.com/styles/v1/mapbox/light-v11/static/${marker}/${lon},${lat},${zoom},0/${size}?access_token=${MAPBOX_TOKEN}`;
}
