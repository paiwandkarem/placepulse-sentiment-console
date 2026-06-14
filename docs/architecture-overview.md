# PlacePulse: architecture overview

A single document to explain the system out loud: how it is shaped, where the
compute runs, how Core Web Vitals are protected, the data model, the AI
architecture, the trade-offs taken on purpose, and how it extends. The
commit-level reasoning lives in `docs/architecture-decisions.md` (ADRs D1 to
D25); this is the bird's-eye view that ties them together.

## One sentence

PlacePulse is a server-rendered sentiment-intelligence console over Queensland
Google-review data, with a tool-grounded AI assistant and durable AI-generated
PDF briefs, built Vercel-native: Next.js 16 App Router on Fluid Compute, Neon
Postgres behind a typed service layer, the AI SDK through the Vercel AI Gateway,
and Clerk for auth.

## The layering, top to bottom

```
Clerk middleware (authn/authz)
        |
Route handler / RSC   transport, caching, auth context   no SQL, no business rules
        |
Service               business logic, defaulting, composition   no SQL, no HTTP
        |
Repository            SQL and row-to-domain mapping   no business rules
        |
Neon Postgres         HTTP serverless driver, server-only
```

The data boundary is the most important decision in the whole build: the CSV/TSV
export is an **import input only**. At runtime the app reads exclusively from
Neon through Vercel Functions. There is no file I/O on the request path. That is
what makes it production-shaped rather than a demo, and it is why a clean
repository/service/RSC split exists. Validation (Zod, `lib/validation`) is shared
between the REST routes and the AI tools, so the assistant and the API enforce
the same contract.

## Compute: Fluid Compute, not edge functions

The instinct to "push everything to the edge" is the wrong call on today's
Vercel, and saying so is a talking point rather than a gap. **Edge Functions are
no longer recommended**; Vercel's default is **Fluid Compute**, which runs full
Node.js in the same regions at the same price, reuses warm instances across
concurrent requests (far fewer cold starts), supports graceful shutdown and
request cancellation, and now carries a 300s default timeout with Active-CPU
pricing. Middleware and Functions both run on it under the hood.

So the posture is:

- **Dynamic data reads run as Vercel Functions on Fluid Compute.** The dashboard
  RSC and the read APIs query Neon over its HTTP driver, which is a single
  statement per round trip, so warm-instance reuse and connection-free HTTP
  pooling matter more than edge proximity. Full Node also means the Postgres
  driver, `@react-pdf/renderer`, and the AI SDK all run without edge-runtime
  caveats.
- **The CDN does the proximity work.** Read APIs return `Cache-Control`
  (`s-maxage` + `stale-while-revalidate`), so a popular slice is served from the
  edge cache without re-invoking the function. Static assets (the QLD boundary
  GeoJSON, fonts, `next/image` output) are CDN-cached by construction.
- **Auth runs in middleware** (Clerk), which is itself a Function, so it is full
  Node and composes with the same model.

The short version for the room: "the function stays dynamic and full-Node on
Fluid Compute; the edge caches the response." That is both current and easy to
defend.

## Core Web Vitals as a design constraint

CWV is treated as a constraint, not a polish pass (ADR D19).

- **LCP.** `app/page.tsx` is an RSC that waits on Neon, so `app/loading.tsx`
  streams a skeleton inside the shell immediately and gives the browser an early
  LCP candidate. The skeleton's reserved heights mirror the real sections so
  almost nothing moves on swap-in.
- **CLS near zero.** `next/font` (Plus Jakarta Sans, self-hosted, size-adjusted
  fallback) removes the font shift; every heavy visual sits in a fixed-height
  container; `next/image` carries explicit dimensions.
- **Keeping heavy JS off first paint.** ECharts, ApexCharts and mapbox-gl are all
  `dynamic(ssr:false)` or imported inside an effect. The map is the most
  expensive, so `MapPanel` is code-split and mounts only when its drawer opens; a
  user who never opens the map never downloads mapbox-gl.
- **INP.** Filter changes run inside `useTransition` so the current view stays
  interactive during the server round trip, with an "Updating" affordance off
  `isPending`.
- **Images over JavaScript.** Real business photos come through `next/image`
  (lazy, sized, AVIF, error fallback tile). Locator maps are Mapbox Static Images
  (a single `<img>`, zero map bundle), not interactive maps. Generative UI in the
  assistant renders data the tools already returned, with the text stream primary
  so an answer never blocks on a visual.

## Data: two datasets, two grains, kept as layers

```
sentiment_suburbs   suburb x category x month aggregates   the Dashboard + suburb tools
poi_* (27M rows)    individual QLD businesses + reviews     the Places explorer + place tools
```

Both are scoped to Queensland (the `qld_suburbs` materialised view intersects the
two), so the product is coherently QLD and the assistant never claims
place-level detail it does not have. The dashboard answers "what" (aggregate,
visual); the place data answers "why / show me" (real businesses, real review
quotes) through the assistant and the Places explorer.

Indexing is tuned to the queries that actually run (ADR D16): a four-column grain
index for the hot single-slice reads, a recursive **loose-index-scan** catalogue
(cost scales with distinct option count, not row count) that took the filter bar
from seconds to ~250ms, and per-query composites for the default slice and the
category breakdown. Homepage TTFB went from 7 to 13 seconds down to ~0.4s. Writes
happen only during the periodic loader, never on the request path, so carrying
five indexes is a cheap trade.

## AI architecture

- **Vercel AI Gateway**, not a direct provider SDK (ADR D4, currently Claude
  Sonnet 4.6 for both roles via `gateway("anthropic/claude-sonnet-4-6")`). One
  key, built-in observability, model failover, zero data retention, and
  provider portability as a one-line change. Swapping to Opus or another provider
  is editing `lib/ai/model.ts`.
- **Typed read tools, not raw SQL.** The assistant calls a fixed set of grounded
  tools (`suburbSentiment`, `sentimentTrend`, `sentimentDrivers`,
  `categoryBreakdown`, `compareSuburbs`, `placesInSuburb`, `placeThemes`,
  `reviewEvidence`, `listSuburbs`, `setDashboardFilter`) that share the service
  layer and the same Zod validation as the REST API. There is no model-authored
  SQL, so the assistant cannot read outside its lane or fabricate a figure that
  the tools did not return.
- **The assistant drives the product, not just chat.** `setDashboardFilter`
  returns a typed action; the dock applies it with `router.replace` on the URL
  filter contract, so a chat turn changes what the dashboard shows.
- **Generative UI.** Tool results map to rich cards (suburb KPIs, an SVG trend
  sparkline, place cards with static locator maps, a head-to-head compare card)
  rendered above an audit timeline that preserves the grounding trail.
- **Durable briefs.** Brief generation moves to the Workflow DevKit (planned
  W4): discrete retryable steps (draft, render, upload, complete) that resume
  after an instance is reclaimed, instead of a single `after()` callback that can
  strand a job. The heavy PDF render stays off the request path either way.
- **Evals.** A fixed question set asserts the right tool was called, figures are
  grounded in tool output, entities are real, and out-of-coverage questions
  decline, stored in `eval_runs` and runnable in CI.

## Trade-offs taken on purpose

Each of these is a real cut with a stated cost, which is the thing an interview
is testing for.

- **Whole-file GeoJSON over vector tiles (ADR D17).** One near-full-detail QLD
  boundary file loaded into a single Mapbox source, ~6 to 7 MB gzipped, with all
  interactivity driven by `feature-state` so the geometry uploads once. Simpler
  and hole-free; the cost is a one-time parse the first time the drawer opens,
  paid lazily. Vector tiles are the named next step if the payload needs to drop.
- **`after()` today, Workflow tomorrow (ADR D5 to D25).** `after()` makes briefs
  pollable but not crash-safe; the W4 Workflow upgrade buys durable, retryable
  execution at the cost of a new primitive to learn.
- **`unstable_cache` over Cache Components / PPR (ADR D19).** The classic
  per-function cache keeps the cache story narratable ("the function stays
  dynamic, the edge caches the response"). A full `use cache` + PPR migration is
  a rendering-contract change, deferred deliberately.
- **`IS NOT DISTINCT FROM` for null-safe category match (ADR D14).** One code
  path serves both the overall headline and the category drill-down, at the cost
  of a non-seekable predicate that the grain index reduces to a cheap recheck.
- **Heuristic theme buckets (ADR D18).** Thresholds in one file
  (`themeBuckets.ts`) classify praised/criticised/mixed and drop the ambiguous
  rest, rather than a heavier model. A judgement call, mitigated by being a
  single edit point and by dropping low-confidence themes rather than showing
  noise.
- **Clerk over Auth.js (W1).** A managed dependency for speed and a
  platform-native story, versus owning the primitives. Auth.js is the portable
  fallback.

## Extendability scenarios

How the shape absorbs likely change without a rewrite:

- **A new brief type** is one discriminated-union member (schema + draft prompt +
  template) on the shared durable runner. No new pipeline.
- **A different model or provider** is one line in `lib/ai/model.ts`; the Gateway
  absorbs the swap with no call-site change.
- **National rollout** drops the `qld_suburbs` join and reframes the system
  prompt; the queries already filter by `area_name`, so the catalogue widens
  without touching the rendering layer.
- **Multi-tenant / per-org** builds on the per-user scoping from W1: `user_id`
  is already on the write tables, and Postgres RLS with deny-by-default plus a
  read policy is the documented next step if the table is ever exposed directly.
- **A new data source** is a new repository plus a thin service; routes and RSCs
  are unchanged because they never touch SQL.
- **Read scaling** is materialised rollup ("gold") tables for the dashboard
  aggregates, the same idea the loose-index-scan catalogue and the QLD view
  already use.
- **Map payload** is vector tiles (a Mapbox tileset or `pmtiles`) behind the
  existing `NEXT_PUBLIC_SUBURB_GEOJSON_URL` hook, so only the viewport streams.
- **A Python need** (a stats or ML library) is a Python Function under the same
  project on Fluid Compute, not a second deploy or a server split.

## Vercel platform surface used

Fluid Compute (all dynamic work), the CDN + `Cache-Control` edge caching,
`next/image` optimisation, `unstable_cache` with tag invalidation, the AI Gateway,
`@vercel/blob` for PDFs, the Workflow DevKit for durable generation (W4), Clerk
through the Marketplace (W1), and `@vercel/analytics` + `@vercel/speed-insights`
for the CWV feedback loop.
