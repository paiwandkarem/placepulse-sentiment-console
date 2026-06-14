# PlacePulse: product shape and build plan

The definitive plan. It states what the product is, how the two datasets
integrate, what is built, and the exact commit sequence for the next phase. We
execute against this in order, one self-contained commit at a time: build it,
propose the message, the user commits, then the next. No DB migration is invented
unless stated. Every commit typechecks, lints and builds before it is proposed.
No em dashes in code, comments or copy. Conventional commit prefixes. New
architectural reasoning goes into `docs/architecture-decisions.md` as a numbered
ADR.

## The product: four surfaces

PlacePulse is a sentiment intelligence console with a left sidebar and four
surfaces. The AI assistant is woven through it, not siloed.

```
Sidebar:  Dashboard . Assistant . Briefs . Places

Dashboard  (home)   Queensland suburb-level analytics: KPIs, trend, drivers,
                    category breakdown, suburb map, word cloud, distributions. A
                    DOCKED assistant sits on the right and drives the dashboard
                    filters by chat.
Assistant  (/assistant)   The same chat engine full screen, for deeper
                    exploration. Surfaces place-level answers and real review
                    quotes, with saved threads (per user, once auth lands).
Briefs     (/briefs)      Generate and view executive PDF briefs, a family of
                    report types over one durable generation pipeline.
Places     (/places)      Queensland place explorer: searchable business
                    directory, place detail slide-overs (themes + reviews +
                    imagery), and a clustered point map.
```

## How the two datasets integrate

Two datasets at two grains, kept as layers rather than merged, both scoped to
Queensland (the `qld_suburbs` materialised view intersects them):

```
sentiment_suburbs   suburb x category x month aggregates
                    -> the Dashboard, and the assistant's suburb tools
poi_* (27M rows)    individual QLD businesses + reviews + themes + words
                    -> the Places explorer, and the assistant's place tools
```

The Dashboard answers "what" (visual, aggregate). The QLD place data answers
"why / show me" (real businesses, real review quotes) through the assistant and
the Places explorer. The assistant's system prompt states the Queensland scope,
so it never claims place-level detail it does not have.

## Completed so far

The build to date, by area (verified 2026-06-14):

- **Data and scope.** QLD POI landing tables loaded (27,014,325 rows). The whole
  product is scoped to Queensland via the `qld_suburbs` materialised view
  (`listFilters` and `getDefaultSlice` read from it; `public/qld-suburbs.geojson`
  replaced the national boundary file; the system prompt is QLD-only). This
  closed what earlier drafts called Phase 0 (Q1, Q2).
- **Dashboard.** Server-rendered analytics module: KPI snapshot with YoY pills,
  three-year grouped-bar trend, category dot plot, theme drivers, word cloud,
  distributions, and a lazy suburb map in a slide-over. Index-tuned to ~0.4s
  TTFB (ADR D16). CWV treated as a constraint (ADR D19).
- **Assistant.** Streams over a route handler with typed grounded tools, persists
  turns to `chat_sessions`, docks into the dashboard, runs full screen, drives
  the dashboard filters by chat (`setDashboardFilter` -> `router.replace`), and
  renders generative-UI cards for suburb/trend/places/compare results above an
  audit timeline.
- **Briefs.** Executive PDF briefs: schema-constrained `generateObject` ->
  `@react-pdf/renderer` -> Vercel Blob -> `brief_jobs`, generated off the request
  path via `after()`, polled by the UI.
- **Evals.** A fixed grounding set (right tool called, figures grounded,
  out-of-coverage declines) stored in `eval_runs`, runnable in CI.
- **Places.** Search, directory, place detail as a slide-over (intercepting
  route), clustered point map, and real business imagery (V1 to V3 rich visuals).
- **AI provider.** Routed through the Vercel AI Gateway, currently
  `gateway("anthropic/claude-sonnet-4-6")` for both roles.

## Next phase: decisions locked (2026-06-14)

- **Auth: Clerk via the Vercel Marketplace.** Native provisioning, prebuilt UI,
  auto-wired env. The trade we accept and will explain: a managed dependency for
  speed and a platform-native story. Auth.js stays the portable fallback.
- **Sequence: auth first, then everything per user.** Threads and briefs become
  user-scoped from the start, so there is no anonymous-to-user migration later.
- **Durable briefs: the Vercel Workflow DevKit.** Closes ADR D5. Crash-safe,
  retryable, step-based generation instead of a single `after()` callback.
- **No fixed demo date.** Full roadmap planned; picked up commit by commit.

## Next phase: workstreams in order

### W0: pre-flight copy and UX hygiene (independent, do first as a warmup)

| # | Commit | Scope |
|---|--------|-------|
| W0.1 | `fix(ui): unify category labels, driver headings, and copy` | Replace the em dash rating fallbacks (currently `"—"`) in `PlaceProfile.tsx:94,188` and `PlacesMap.tsx:27` with `"-"` or `"Not rated"` (hard-rule violation). Standardise the driver headings: `SuburbPanel` "What is working" / "Needs attention" to match `SentimentDrivers` "What's working" / "What's not working". Unify the no-category label to one constant ("All categories") across `FilterBar`, `BriefsView` and Places while keeping the overall-vs-category semantics. Point the `AppShell` "Help and docs" link at real docs or remove it. |

### W1: authentication (Clerk via the Vercel Marketplace)

> **GOTCHA (memory: vercel-cli-env-clobber):** provisioning Clerk through the
> Marketplace or any `vercel` link/pull command silently rewrites `.env.local`
> and can wipe `DATABASE_URL`, `NEXT_PUBLIC_MAPBOX_TOKEN`,
> `NEXT_PUBLIC_SUBURB_GEOJSON_URL`, `AI_GATEWAY_API_KEY`. **`cp .env.local
> /tmp/env.local.bak` first**, pull env into a separate file, and grep the keys
> survived afterwards.

| # | Commit | Scope |
|---|--------|-------|
| W1.1 | `feat(auth): add Clerk and protect the app shell` | Provision Clerk via the Marketplace; install `@clerk/nextjs`; wrap the root layout in `<ClerkProvider>`; add `middleware.ts` (`clerkMiddleware`) protecting all app routes with a public allowlist for sign-in/sign-up and static assets; add the hosted sign-in/sign-up routes; put a `<UserButton>` in `AppShell`. ADR D21. |
| W1.2 | `feat(auth): require a session on the AI write routes` | Gate `POST /api/assistant` and `POST /api/briefs` (and brief/thread mutations) on an authenticated user; return 401 otherwise. The security boundary for the spend-incurring routes. |
| W1.3 | `feat(db): scope briefs and chat sessions to the user` | Migration adding `user_id` to `brief_jobs` and `chat_sessions`; thread `auth().userId` through every write in `lib/briefs/repository.ts` and `lib/assistant/sessions.ts`; scope every read by `user_id`. ADR D22 (per-user data model; app-level scoping over RLS for a single trusted connection). |

### W2: chat threads and history (now per user)

Backend already persists `chat_sessions`; the frontend never resumes them. Make
the assistant a workspace with memory and keep the dock a contextual copilot.

| # | Commit | Scope |
|---|--------|-------|
| W2.1 | `feat(assistant): add a per-user thread model and API` | Add a `surface` column ('assistant' | 'dock') to `chat_sessions`. `GET /api/assistant/threads` (list where `surface='assistant'` and `user_id` = caller), `GET /api/assistant/threads/[id]`, `DELETE`. The client passes `id` + `surface` to the existing POST. ADR D23. |
| W2.2 | `feat(assistant): thread sidebar and resume on the assistant page` | Server-render the thread list + "New chat"; selecting a thread routes to `/assistant?thread=<id>`, server-fetches messages, and hydrates `useChat({ id, initialMessages })`. "New chat" mints a new id. Title from the first user message. |
| W2.3 | `feat(assistant): keep the dashboard dock contextual and ephemeral` | The dock opens fresh each time (no thread browser), seeds a system hint with the live suburb/category, and offers an optional "continue in full assistant" handoff to `/assistant?thread=<dockId>`. |

### W3: brief types (discriminated union over the one pipeline)

A family of report types is a fan-out over the existing pipeline, not a new one.

| # | Commit | Scope |
|---|--------|-------|
| W3.1 | `feat(briefs): introduce brief types and a type selector` | Make `briefContentSchema` a discriminated union keyed by `type` (current schema becomes the `overview` member). Add a `type` column to `brief_jobs` (default `overview`) plus stored input params (`area_names[]`, `category`). `POST /api/briefs` accepts `{ type, areaNames, category }`, validated per type. `BriefsView` gains a segmented type selector; the list shows the type as a badge. Only `overview` renders for now. ADR D24. |
| W3.2 | `feat(briefs): suburb comparison brief` | The `comparison` member: fetch each suburb's `getSentimentDashboardContext`, reuse `/api/sentiment/compare`, draft a comparative narrative (who leads each theme, decisive gaps, a per-suburb recommendation). Render side-by-side KPI columns + a grouped multi-suburb bar (extend `lib/briefs/charts.tsx`) + a "where each leads" table. `BriefsView` multi-suburb picker (2 to 3). |
| W3.3 | `feat(briefs): category deep-dive and momentum briefs` | `category` deep-dive ranks top suburbs for one category (reuse `categoryBreakdown`); `momentum` surfaces the biggest YoY movers and emerging/fading themes. Each adds a draft prompt and a template variant on the shared runner. |

### W4: durable brief generation (Vercel Workflow DevKit)

Closes ADR D5. Do this after W3.1 so the durable workflow wraps the generalised
runner and every brief type inherits crash-safe execution.

| # | Commit | Scope |
|---|--------|-------|
| W4.1 | `feat(briefs): run generation as a durable workflow` | Install the Workflow DevKit. Convert `runBriefJob` into a durable workflow with discrete retryable steps (fetch context, draft, render PDF, upload to Blob, mark complete), replacing the `after()` fire-and-forget. A reclaimed instance resumes from the last completed step. The poll UI is unchanged. ADR D5 resolved + D25 (durable execution: why Workflow over Queues over `after()`). |

### W5: evals redo and expansion

| # | Commit | Scope |
|---|--------|-------|
| W5.1 | `feat(evals): expand tool and grounding coverage` | Add cases for the place tools (`placesInSuburb`, `placeThemes`, `reviewEvidence`), `categoryBreakdown`, and the generative-UI outputs. Tighten grounding: assert the cited suburb/place exists in the catalogue (no invented entities), figures match tool results, out-of-coverage declines. Store in `eval_runs`. |
| W5.2 | `feat(evals): cover brief-type generation` | A small eval that each brief type produces schema-valid content grounded in its source slice. Optional lightweight `/evals` results view. |

### W6: UI/UX and assistant-feel polish

| # | Commit | Scope |
|---|--------|-------|
| W6.1 | `feat(assistant): make dashboard updates feel live` | The dock already changes the dashboard via URL nav; make it legible. When `setDashboardFilter` fires, surface a brief "Showing Bondi now" confirmation and highlight the changed control in `FilterBar` (a short-lived ring) so cause-and-effect reads in a demo. |
| W6.2 | `feat(a11y): focus-trap the slide-over drawers and chart data fallbacks` | Close the D20 deferrals: trap focus inside the open drawers and restore it on close; add a visually-hidden data table behind the canvas charts. |
| W6.3 | `style(ui): voice and capitalisation consistency pass` | One pass over section headers, empty states, button case and tooltip copy for a single consistent voice. |

### W7: docs, ADRs and checkpoints

| # | Commit | Scope |
|---|--------|-------|
| W7.1 | `docs: refresh plan, ADRs and checkpoints` | Correct ADR D4 (provider is Claude via Gateway, not OpenAI). Land ADRs D21 to D25. Refresh `testing-checkpoints.md`. Keep `architecture-overview.md` and `demo-script.md` cross-linked. |

## Order rationale

Auth first because it gates per-user threads and briefs, and the clean data model
was chosen over a later migration. W0 ships ahead only because it is a risk-free
warmup. Threads (W2) follow auth directly since they were the explicit
dependency. Brief types (W3) are the highest-value AI feature next, and the
durable upgrade (W4) rides on the W3.1 refactor. Evals (W5) harden what now
exists. UI polish (W6) and docs (W7) close out. Phases are independent enough to
reorder; W3 can move ahead of W2 since brief types do not depend on threads.

## Companion documents

- `docs/architecture-overview.md`: the synthesized platform architecture for the
  interview (compute, caching, CWV, data, AI), trade-offs and extendability.
- `docs/demo-script.md`: what to demo, in what order, the questions to ask the
  assistant, and the interviewer questions to expect with answers.
- `docs/architecture-decisions.md`: the chronological ADR log (D1 to D25) with
  the commit-level reasoning behind each decision.
