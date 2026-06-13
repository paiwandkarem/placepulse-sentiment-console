import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Ensure the brief PDF fonts are bundled into the briefs function on Vercel: they are read from
  // disk at render time, so file tracing has to include them.
  outputFileTracingIncludes: {
    "/api/briefs": ["./lib/briefs/fonts/**"],
  },
  // Allowlist the external image hosts the POI data points at (Google place/street-view imagery and
  // reviewer avatars) plus Mapbox static maps, so next/image can optimise them. Any other host is
  // blocked. Images that still fail (a stale or protected URL) fall back to a placeholder tile in
  // the PlaceImage component, so a broken link never shows.
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "streetviewpixels-pa.googleapis.com" },
      { protocol: "https", hostname: "*.googleusercontent.com" },
      { protocol: "https", hostname: "maps.google.com" },
      { protocol: "https", hostname: "maps.gstatic.com" },
      { protocol: "https", hostname: "api.mapbox.com" },
    ],
  },
};

export default nextConfig;