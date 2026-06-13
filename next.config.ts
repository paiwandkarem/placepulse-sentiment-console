import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Ensure the brief PDF fonts are bundled into the briefs function on Vercel: they are read from
  // disk at render time, so file tracing has to include them.
  outputFileTracingIncludes: {
    "/api/briefs": ["./lib/briefs/fonts/**"],
  },
};

export default nextConfig;