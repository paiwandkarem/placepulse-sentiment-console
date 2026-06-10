// Caching policy lives in one place so it can be reasoned about (and talked about) as a
// single decision rather than scattered magic strings across route handlers.

// Stable vocabulary for tag-based cache invalidation. These name the four read surfaces so
// a write (a re-import, a revalidate call) can later target exactly what changed instead of
// flushing everything. The revalidation endpoint (commit 14) currently invalidates by path;
// these tags are the seam for moving to fetch-level tagging without renaming things twice.
export const CACHE_TAGS = {
  filters: "sentiment:filters",
  records: "sentiment:records",
  trends: "sentiment:trends",
  comparisons: "sentiment:comparisons",
} as const;

// Shared CDN cache policy for the read APIs.
//   s-maxage=300            -> Vercel's edge serves a cached response for 5 minutes,
//                              so most dashboard loads never hit a Function or Neon.
//   stale-while-revalidate  -> for up to an hour after that, a stale response is served
//                              instantly while a fresh one is fetched in the background.
// Net effect: fast TTFB and low database/compute cost, with data that's at most ~5 minutes
// behind — appropriate for monthly sentiment aggregates that rarely change intra-day.
export const SENTIMENT_CACHE_HEADERS = {
  "Cache-Control": "s-maxage=300, stale-while-revalidate=3600",
} as const;
