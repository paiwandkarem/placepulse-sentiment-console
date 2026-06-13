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
