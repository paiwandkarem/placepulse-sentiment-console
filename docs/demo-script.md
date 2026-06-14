# PlacePulse: demo script

How to present the console: the order to walk it in, the exact questions to ask
the assistant, the point to make at each stop, and the interviewer questions to
expect with answers ready. The arc is deliberate: establish the "what", then show
the AI turning it into "why / show me", then show the platform engineering
underneath.

> Before demoing, confirm the live catalogue. Open the dashboard, note the
> suburb it defaults to (the most-reviewed QLD slice), and use that one
> throughout so every scripted question lands on real, rich data. The QLD
> examples below (Surfers Paradise, Southport, Noosa Heads, Fortitude Valley,
> Brisbane City) are placeholders; swap in whatever the catalogue actually
> carries. Use one suburb that is NSW or interstate (Bondi, Carlton) only for the
> out-of-coverage moment.

## The arc

```
1. Dashboard        the "what"            server-rendered analytics, fast, grounded
2. Assistant dock   the "wow"             chat changes the dashboard in place
3. Full assistant   the "why / show me"   generative UI + real review evidence
4. Places explorer  the richest data      27M rows, real imagery, clustered map
5. Briefs           the durable AI        watch a job run, open the PDF
6. Evals + arch     the engineering       grounding rigor + the platform story
```

## 1. Dashboard: the "what" (about 60 seconds)

Land on the home dashboard. Let the skeleton-to-content swap be visible once.

- "This is server-rendered. The skeleton streams instantly, then the real data
  swaps in with no layout shift. Homepage TTFB is around 0.4 seconds against a
  multi-million-row table because the queries are index-tuned, not because
  anything is precomputed."
- Walk the section order once: KPI snapshot with year-on-year pills, the
  three-year grouped-bar trend, the category dot plot, the theme drivers, the
  word cloud, the distributions. "Every section is a question, and the chart type
  is chosen against the data: the category breakdown is a Cleveland dot plot
  because the scores sit in a narrow band where a zero-based bar hides all the
  variation."
- Open the map drawer from the right edge, click a suburb, show the dashboard
  re-filter. "The map is lazy: mapbox-gl only loads when this drawer opens, so it
  never touches first paint."

## 2. Assistant dock: chat drives the dashboard (about 60 seconds)

Open the docked assistant on the dashboard. This is the strongest single moment.

Ask, in order:

1. `How satisfied are visitors with Surfers Paradise?`
   Watch the suburb sentiment card render (KPIs + split bar). "That card is
   generative UI: the tool returned the data, the client rendered the component,
   and underneath it is an audit timeline showing exactly which tool ran and what
   it returned. Nothing here is the model improvising a number."
2. `What is driving the negative reviews there?`
   Drivers come back grounded with year-on-year deltas.
3. `Switch the dashboard to Southport`
   The dashboard filters change behind the open dock. "The assistant is not just
   answering, it is driving the product. That was a typed `setDashboardFilter`
   action applied to the URL, so the dashboard and the chat never drift apart."

Make the point: "Same chat engine, two mount points. Docked here as a contextual
copilot for the current view; full-screen on its own page as a workspace with
saved threads."

## 3. Full assistant: the "why / show me" (about 90 seconds)

Open `/assistant`. Show the thread sidebar (once W2 lands) and start a new chat.

Ask, in order:

1. `Compare Noosa Heads and Surfers Paradise`
   The head-to-head compare card renders with the delta and a winner callout.
2. `Show me the top places in Fortitude Valley`
   Place cards render with real photos and static locator maps, each linking into
   the Places explorer. "This is the second dataset: 27 million rows of individual
   QLD businesses and reviews. The aggregate dashboard answers what; this answers
   show me."
3. `Show me a negative review about service in Fortitude Valley`
   Real review evidence comes back as a quote. "Real customer text, retrieved by
   a tool, not generated."
4. The out-of-coverage moment: `How is sentiment in Bondi?`
   "Bondi is in New South Wales. The console is Queensland-only, and the system
   prompt plus an eval enforce that, so instead of inventing data it tells you
   what it does not cover. That refusal is tested."

## 4. Places explorer: the richest data (about 45 seconds)

Open `/places`.

- Search and filter the directory; open a place. "Real business hero photo,
  reviewer avatars, theme breakdown, paginated reviews, a static locator map.
  The imagery is real POI data through `next/image`, lazy and sized, so it costs
  nothing on first load."
- Show the clustered point map. "Code-split, so it does not weigh the directory's
  first paint."
- Note the slide-over: "A place is always a slide-over over the map, even on a
  direct link, via an intercepting route. There is no bare full-page variant by
  design."

## 5. Briefs: durable AI generation (about 60 seconds)

Open `/briefs`. Start a brief and let the job run.

- Pick the brief type (once W3 lands: overview, comparison, deep-dive, momentum),
  the suburb(s), and generate. "Generation is a durable Workflow: draft the prose
  with a schema-constrained model call, render the PDF, upload to Blob, mark
  complete, each step retryable. If the instance is reclaimed mid-run it resumes
  from the last completed step instead of stranding the job. The heavy PDF render
  never sits on the request path."
- Show the list poll the job to completion, then open the PDF. "Same generation
  pipeline, a family of report types over one discriminated union and per-type
  templates."

## 6. Evals and architecture: the engineering (about 60 seconds)

- "The assistant is held to a grounding spec: the right tool is called, every
  figure traces to tool output, entities are real, and out-of-coverage questions
  decline. It runs in CI and stores each run."
- Close on the platform story (lean on `architecture-overview.md`): "Everything
  dynamic runs full-Node on Fluid Compute, not edge functions, which are no
  longer recommended; the edge caches the responses. Neon behind a typed
  service layer. The AI SDK through the Vercel AI Gateway for one key,
  observability, failover and provider portability. Clerk through the Marketplace
  for auth. CWV treated as a build constraint throughout."

## Interviewer questions to expect, with answers

- **"How do you stop the assistant hallucinating figures?"** Typed read tools
  over the shared service and Zod validation, no model-authored SQL, an audit
  timeline under every answer, and evals that assert grounding. The model selects
  and composes tools; it never invents the numbers.
- **"Why the Gateway instead of calling Anthropic directly?"** One key, built-in
  observability, model failover, zero data retention, and provider portability as
  a one-line change. The direct SDK couples the app to one vendor for no benefit
  here.
- **"Why not edge functions for speed?"** Edge Functions are no longer
  recommended. Fluid Compute runs full Node in the same regions at the same
  price, reuses warm instances so cold starts are rare, and lets the Postgres
  driver, react-pdf and the AI SDK run without edge caveats. Proximity is the
  CDN's job through `Cache-Control`.
- **"Is the brief generation actually durable?"** With the Workflow DevKit, yes:
  step-based, retryable, resumes after instance reclaim. The honest history is
  that it started as `after()`, which made it pollable but not crash-safe, and
  this is the documented upgrade (ADR D5 to D25).
- **"How does this scale?"** Reads are index-tuned and edge-cached; writes only
  happen on the periodic loader. The next steps are materialised rollup tables
  for the aggregates and vector tiles for the map, both already named as future
  work rather than discovered live.
- **"What did you deliberately not build?"** Vector tiles, a full Cache
  Components / PPR migration, Postgres RLS (single trusted connection, no PII),
  and screen-reader data-table fallbacks were each judged and deferred with a
  stated cost. Triaging what not to do is the point.
- **"Why two datasets instead of merging them?"** Different grains. Merging a
  national monthly aggregate with 27M individual QLD rows would force one to the
  other's shape. Kept as layers, the dashboard answers what and the place data
  answers why, joined only where it helps (the QLD scope view).

## Pre-demo checklist

- Confirm the default suburb and pick scripted suburbs that carry rich data.
- Warm the app once so the first map open and first AI call are not cold.
- Have one interstate suburb ready for the out-of-coverage moment.
- Have a brief pre-generated as a fallback in case live generation runs long.
- Keep `architecture-overview.md` open in a tab for the closing talking points.
