# PlacePulse: product shape and build plan

The definitive plan from this point on. It states what the product is, how the two
datasets integrate, and the exact commit sequence to build it. We execute against
this in order, one self-contained commit at a time.

## The product: four surfaces

PlacePulse is a sentiment intelligence console with a left sidebar and four surfaces.
The AI assistant is woven through it, not siloed.

```
Sidebar:  Dashboard · Assistant · Briefs · Places

Dashboard  (home)   National suburb-level analytics: KPIs, trend, drivers, category
                    breakdown, suburb map, word cloud, distributions. A DOCKED assistant
                    sits on the right and can drive the dashboard filters by chat.
Assistant  (/assistant)   The same chat engine full screen, for deeper exploration.
                    Surfaces place-level answers and real review quotes.
Briefs     (/briefs)      Generate and view executive PDF briefs.
Places     (/places)      Queensland place explorer: searchable business directory,
                    place detail pages (themes + reviews), and a point map.
```

## How the two datasets integrate

Two datasets at two grains, kept as layers rather than merged:

```
sentiment_suburbs   NATIONAL   suburb x category x month aggregates
                               -> the Dashboard, and the assistant's suburb tools
poi_* (27M rows)    QLD ONLY   individual businesses + reviews + themes + words
                               -> the Places explorer, and the assistant's place tools
```

The Dashboard answers "what" (national, visual, aggregate). The QLD place data answers
"why / show me" (real businesses, real review quotes) through the assistant and the
Places explorer. The assistant's system prompt states the coverage split, so it never
claims place-level detail outside Queensland.

## Done so far

- D1 `feat(db): add QLD POI landing tables and indexes`
- D2 `chore(deps): add pg and pg-copy-streams for bulk POI load`
- D3 `feat(scripts): add S3-to-Neon POI bulk loader` (27,014,325 rows loaded)
- A1 `chore(ai): scaffold model and gateway config`
- A2 `feat(assistant): add grounded sentiment and POI tools`

## Build sequence from here

Ground rules: one self-contained commit per row; build it, propose the message, the
user commits, then the next. No DB migration is invented (the tables already exist).
Every commit uses libraries already in package.json. No em dashes in code, comments or
copy. Conventional commit prefixes.

### Phase 0: scope the product to Queensland (do next)

The place data is Queensland only, so the dashboard is scoped to match. This makes the
whole product coherently QLD and removes the national-vs-QLD seam from the assistant.
Approach: intersect `sentiment_suburbs.area_name` with the QLD suburb set from
`poi_place_suburb` (2,863 suburbs have both sentiment data and a QLD mapping). The
queries already filter by area_name, so restricting the catalogue and default slice is
enough; the assistant inherits the scope through the same service.

| # | Commit | Scope |
|---|--------|-------|
| Q1 | `feat(dashboard): scope sentiment to Queensland suburbs` | Restrict the filter catalogue and the default slice to QLD suburbs (a `qld_suburbs` reference built from `poi_place_suburb`, joined in `listFilters` and `getDefaultSlice`). Update the assistant system prompt and tool descriptions to QLD framing, dropping the national/QLD split. |
| Q2 | `feat(map): regenerate suburb boundaries for Queensland only` | Rebuild `public/au-suburbs.geojson` (renamed `qld-suburbs.geojson`) filtered to QLD, removing the 23 MB national asset. `MapPanel` points at the smaller file. |

### Phase 1: the assistant works (AI Cloud core)

| # | Commit | Scope |
|---|--------|-------|
| A3 | `feat(assistant): stream the assistant over a route handler` | `app/api/assistant/route.ts`: `streamText` with the A2 tools, multi-step via `stepCountIs`, `toUIMessageStreamResponse`. Persists turns to `chat_sessions`. Curl-testable. |
| A4 | `feat(assistant): dock the assistant into the dashboard` | A shared `components/assistant/AssistantChat.tsx` (`useChat`) plus `ToolTimeline`, mounted as a collapsible right-edge dock on the dashboard, in our fonts and colours. End-to-end chat. |
| A5 | `feat(assistant): add the full-screen assistant page` | `app/assistant/page.tsx` reusing `AssistantChat` full height, plus the sidebar nav entry. Same engine, second mount point. |
| A6 | `feat(assistant): drive dashboard filters from chat` | A `setDashboardFilter` tool returning a typed action; the dashboard dock applies it with `router.replace('/?...')` on the existing URL filter contract. Chat changes what the dashboard shows. |

### Phase 2: briefs (AI Cloud)

| # | Commit | Scope |
|---|--------|-------|
| B1 | `feat(briefs): generate executive briefs as PDFs` | `lib/briefs/*`: draft sections with `generateObject` + zod, render with `@react-pdf/renderer`, upload to `@vercel/blob`, persist `brief_jobs`. `app/api/briefs/route.ts`. |
| B2 | `feat(briefs): add the briefs surface` | `app/briefs/page.tsx`: generate (two-phase "design then render" UX), list past briefs, view the PDF. Sidebar nav entry. |

### Phase 3: evals (AI Cloud)

| # | Commit | Scope |
|---|--------|-------|
| C1 | `feat(evals): add lightweight assistant evals` | `lib/evals/*`: a fixed question set with grounding assertions (right tool called, answer cites real figures, no invented suburb or place), stored in `eval_runs`, with a small results view or script. |

### Phase 4: the Places explorer (QLD)

| # | Commit | Scope |
|---|--------|-------|
| P1 | `feat(places): add place search and detail data access` | Extend `poiRepository` with search (name, suburb, category), pagination, a place's paginated reviews, and a place's top word terms. A thin `placesService` for composition. |
| P2 | `feat(places): add the place directory` | `app/places/page.tsx`: searchable, filterable, paginated QLD business directory, server-rendered, linking to detail. Sidebar nav entry. |
| P3 | `feat(places): add place detail pages` | `app/places/[id]/page.tsx`: hero, theme breakdown, paginated reviews, word cloud. The assistant deep-links here. |
| P4 | `feat(places): add the QLD place map` | A point map on the directory (mapbox, clustered) scoped to the loaded places. Code-split so it does not weigh the directory's first load. |

### Phase 5: brief types (AI Cloud, proposed)

Today a brief is always one shape: a single-suburb executive overview. The generation
pipeline (schema-constrained `generateObject` -> `@react-pdf` render -> Blob -> `brief_jobs`,
async job + poll) is general; only the content schema and the PDF template are
suburb-overview-specific. So a **family of brief types** is a fan-out over that one
pipeline, not a new pipeline. Each type is a discriminated-union member with its own
content schema, its own draft prompt, and its own document template; everything else
(the job runner, polling UI, Blob storage, fonts, charts, risk tiers, quote selection) is
shared.

```
brief type        input                       what it answers
overview (current) one suburb (+ category)     where this suburb stands, what to do
comparison         2 to 3 suburbs (+ category) who leads on what, and why; head to head
category deep-dive one category, top N suburbs best/worst for this category across QLD
momentum           one suburb or a region      what moved most YoY: risers, fallers, new themes
```

| # | Commit | Scope |
|---|--------|-------|
| B3 | `feat(briefs): introduce brief types and a type selector` | Make the brief shape a discriminated union keyed by `type` in `lib/briefs/schema.ts` (the current schema becomes the `overview` member). Add a `type` column to `brief_jobs` (defaulted to `overview`, backward compatible) plus the stored input params (`area_names[]`, `category`). `POST /api/briefs` accepts `{ type, areaNames, category }` and validates per type. `BriefsView` gains a segmented type selector; the list shows the type as a badge. No new render path yet (only `overview` is wired). |
| B4 | `feat(briefs): suburb comparison brief` | The comparison member: fetch each suburb's `getSentimentDashboardContext` (the same call the suburb panel uses) and reuse the existing `/api/sentiment/compare` path to diff them. Draft a comparative narrative (who wins each theme, the decisive gaps, a recommendation per suburb). Render a side-by-side KPI column layout and a grouped multi-suburb bar chart (extend `lib/briefs/charts.tsx`, which already draws YoY grouped bars) plus a "where each leads" theme table. The multi-suburb picker in `BriefsView` adds 2 to 3 suburbs. |
| B5 | `feat(briefs): category deep-dive and momentum briefs` | The remaining members: category deep-dive ranks the top suburbs for one category (reusing `categoryBreakdown`); momentum surfaces the biggest YoY movers and emerging/fading themes (reusing the trend and theme-delta data already in the dashboard context). Each adds a draft prompt and a template variant; both ride the same job runner. |

Reuse to lean on: `getSentimentDashboardContext` (per suburb), the `/api/sentiment/compare`
route, `charts.tsx` grouped bars, `riskTierFor` and the theme/quote helpers in
`lib/briefs/service.tsx`. The SA story stays clean: one async generation pipeline on Fluid
Compute, typed and schema-constrained, generalised to a report family via a discriminated
union and per-type templates, with the heavy render kept off the request path.

Sequencing: B3 is the enabling refactor (do it first; it is low risk and unlocks the rest).
B4 (comparison) is the highest-value follow-on and the one explicitly requested. B5 is
optional polish once B4 proves the pattern.

### Closing

| # | Commit | Scope |
|---|--------|-------|
| Z1 | `docs: record AI Cloud and Places ADRs` | ADRs for the Gateway and model choice, typed-tool grounding over raw SQL, the filter-driving tool, the briefs pipeline, the national-aggregate vs QLD-place seam, and the four-surface shape. Refresh `testing-checkpoints.md`. |

## Order rationale

Assistant first (A3 to A6): it is the centre of the AI Cloud track and the strongest
demo. Briefs (B1, B2) and evals (C1) complete the two scored AI features. Places (P1 to
P4) is the richest use of the new data and lands after the scored tracks are solid. Docs
last. Phases are independent enough to reorder if priorities change; Places can move
earlier if the explorer is the priority.
