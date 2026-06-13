# PlacePulse Sentiment Intelligence Console

PlacePulse is a production-shaped sentiment intelligence console for exploring customer review sentiment across Queensland suburbs, business categories and time periods.

It was built as a **Vercel Solutions Architect take-home assessment**. The goal was to build and deploy a small but realistic application on Vercel, then present the architecture and trade-offs as if speaking to a customer.

The project intentionally covers both assessment paths:

* **Frontend Cloud**: a dynamic analytics dashboard with server rendering, client-side interactivity, caching, revalidation and Core Web Vitals discipline.
* **AI Cloud**: a Vercel AI SDK assistant with grounded tool use over the live data, with briefs and evaluation checks on the roadmap.

## Current status

This is built commit by commit. What exists today versus what is planned:

| Surface | Status | Notes |
| --- | --- | --- |
| Dashboard (`/`) | Built | KPIs, trend, category breakdown, theme drivers, word cloud, distributions, suburb map. |
| Assistant (docked copilot) | Built | Streaming chat grounded in the data, a tool-call audit timeline, markdown and tables, a maximize toggle. |
| Assistant (full-screen page) | Planned | Same engine, a dedicated `/assistant` route. |
| Briefs (`/briefs`) | Planned | Executive PDF briefs generated with the AI SDK and stored on Vercel Blob. |
| Evals | Planned | Lightweight grounding checks over the assistant. |
| Places explorer (`/places`) | Planned | Queensland business directory, place detail pages and a point map over the POI dataset. |

The full build plan lives in `docs/ai-cloud-plan.md`, and the architectural reasoning lives in `docs/architecture-decisions.md`.

## Problem

Review and sentiment data is valuable, but it is often difficult for place-based teams to turn that data into decisions.

Local government, tourism, retail and precinct teams need to answer questions like:

* Which suburbs are improving or declining?
* Which business categories are creating the most customer friction?
* What themes are driving negative sentiment?
* Which review evidence supports the trend?

PlacePulse turns suburb-level sentiment data into a fast dashboard and a grounded conversational assistant, with briefing and place-level exploration on the roadmap.

## Target users

* local government economic development teams
* destination and tourism organisations
* precinct managers
* retail and hospitality analysts
* executives who need clear place-performance summaries

## Product summary

Today the application allows users to:

* filter sentiment by suburb, category, granularity and month
* view satisfaction, rating, review volume and year-on-year KPIs
* inspect sentiment trends over time
* review theme drivers, a word cloud, and star and label distributions
* select a suburb visually from a Queensland boundary map
* ask natural-language questions about suburb sentiment, the themes behind it, and specific places and their review quotes, answered only from the data

## The two datasets

PlacePulse layers two datasets at two grains rather than merging them:

```txt
sentiment_suburbs   suburb x category x month aggregates
                    -> the dashboard, and the assistant's suburb tools

poi_* (about 27M    individual Queensland businesses, reviews, themes and words
rows)               -> the assistant's place tools, and the planned Places explorer
```

The dashboard answers "what" (aggregate and visual). The place data answers "why and show me" (real businesses and real review quotes) through the assistant. The whole product is scoped to Queensland, because the place data is Queensland only.

## Architecture

```mermaid
flowchart TD
  User["User"]
  App["Next.js App Router on Vercel"]
  ServerComponents["Server Components (dashboard)"]
  ClientComponents["Client Components (filters, charts, map, chat)"]
  AssistantRoute["Route Handler: app/api/assistant"]
  SentimentRoutes["Route Handlers: sentiment, filters, revalidate"]
  Services["Typed service layer"]
  Repositories["server-only repositories"]
  Database["Neon Postgres via Vercel Marketplace"]
  Gateway["Vercel AI Gateway"]
  Tools["Grounded typed read tools"]

  User --> App
  App --> ServerComponents
  App --> ClientComponents
  ServerComponents --> Services
  ClientComponents --> SentimentRoutes
  ClientComponents --> AssistantRoute
  SentimentRoutes --> Services
  AssistantRoute --> Gateway
  AssistantRoute --> Tools
  Tools --> Services
  Services --> Repositories
  Repositories --> Database
```

## Platform choices

### Vercel

The app is deployed on Vercel and uses Vercel-native patterns:

* Next.js App Router (one deployment, no front-end and back-end split)
* Server Components for the initial dashboard view
* Client Components only where interactivity is required (filters, charts, map, chat)
* Route Handlers for the sentiment APIs and the streaming assistant
* Fluid Compute for the assistant route, so an interactive endpoint stays warm between turns
* the **Vercel AI Gateway** for model access, addressed by `provider/model` slug, with OIDC auth on Vercel and an `AI_GATEWAY_API_KEY` for local development
* Vercel Marketplace Postgres through Neon
* Vercel Blob to host the suburb boundary GeoJSON, kept out of the app bundle and pointed at by an environment variable
* Vercel Analytics and Speed Insights for observability

### Postgres / Neon

The sentiment and place datasets are hosted in Neon Postgres. The app reads through the HTTP driver (`@neondatabase/serverless`) in a `server-only` repository, service and component layering. The import scripts are ingestion tools only: at runtime the app does not read from local files.

Runtime path:

```txt
Dashboard or assistant request
  -> Next.js Route Handler or Server Component
  -> sentimentService (or a grounded assistant tool)
  -> sentimentRepository / poiRepository
  -> Neon Postgres
  -> typed response
```

## Data model

The dashboard reads the suburb aggregate:

```txt
sentiment_suburbs
```

Each row is a suburb, category, granularity and month with average rating, a 0 to 100 satisfaction score, review volume, positive / negative / neutral breakdowns, and JSON columns for theme sentiment, the word cloud and top review evidence. The app is scoped to Queensland through a `qld_suburbs` reference built from the place data (see `lib/db/qld-suburbs.sql`).

The place-level dataset lives in the `poi_*` landing tables (places, reviews, review scores, themes, theme hits and word terms), loaded from a gzipped CSV export with a streaming COPY loader.

Supporting tables: `chat_sessions`, `brief_jobs`, `eval_runs`, `import_jobs`, `audit_events`.

## Rendering strategy

### Server-rendered

The dashboard shell and the first sentiment view render server-side so the page has useful content on first load. This supports faster perceived load, stronger LCP, lower client JavaScript and a stable layout before hydration.

### Client-rendered

Client Components are used only where interactivity is required: the filter bar, the ECharts and ApexCharts visualisations, the Mapbox suburb map, and the assistant chat. Heavy libraries are code-split with `next/dynamic` so they stay out of the dashboard's first load, and the map mounts only when its drawer opens.

### Streaming

The assistant streams token by token over a Route Handler using the Vercel AI SDK, and `app/loading.tsx` streams a dashboard skeleton while the first slice resolves.

## Caching strategy

* **Database indexes** support the common access patterns (suburb plus category plus date, category plus date, suburb plus date, granularity plus date).
* **API caching**: read-heavy sentiment routes return `s-maxage` with `stale-while-revalidate`, suitable because the data is analytical and does not need second-by-second freshness.
* **Revalidation**: the import flow can be paired with on-demand revalidation so fresh data becomes visible after an import.

## Core Web Vitals decisions

* **LCP**: server-render the first dashboard state, keep the header and primary content lightweight, and progressively load deeper panels.
* **CLS**: reserve space for charts and KPI cards, and use consistent card dimensions.
* **INP**: keep filters lightweight, keep aggregation server-side, and code-split expensive client interactions (charts, map, chat).

## AI features

PlacePulse includes a grounded conversational assistant, mounted today as a docked copilot on the dashboard.

Example questions:

* "How satisfied are visitors with Brisbane City?"
* "What is driving negative reviews in Surfers Paradise?"
* "Compare Fortitude Valley and South Brisbane."
* "What do people say about cafes in Fortitude Valley?"

The assistant answers only from tool output. It does not answer from memory and cannot write SQL.

### How the assistant works

* **Model access** through the Vercel AI Gateway, configured in one place (`lib/ai/model.ts`), defaulting to `anthropic/claude-sonnet-4-6`.
* **A streaming Route Handler** (`app/api/assistant/route.ts`) runs `streamText` with a bounded multi-step tool loop and returns the UI-message stream that the client consumes.
* **Grounded typed tools** (`lib/assistant/tools.ts`): zod-validated read tools over the same service and repository layers the dashboard uses, so the model can only surface figures that already exist in Neon. Suburb tools cover sentiment, trend, drivers, category breakdown and comparison; place tools cover individual businesses, their themes and real review quotes.
* **A grounding contract** (`lib/assistant/systemPrompt.ts`): answer only from tool results, name the figure and the suburb or place it came from, and never invent a number, suburb or business.
* **Persistence** (`lib/assistant/sessions.ts`): each completed turn is written to `chat_sessions` after the response is delivered, so the write never sits on the response path.
* **Rendering**: assistant markdown (including tables) renders with **Streamdown**, and a tool-call timeline shows each tool, its input and its output so every answer is auditable.

## Tech stack

* Next.js App Router (Turbopack), React 19, TypeScript
* Tailwind CSS v4 and flowbite-react
* Vercel, Vercel Functions (Fluid Compute), Vercel AI Gateway
* Vercel AI SDK (`ai` and `@ai-sdk/react`) with Streamdown
* Neon Postgres (`@neondatabase/serverless` HTTP driver); `pg` and `pg-copy-streams` for the bulk loader
* Zod for validation, `csv-parse` for ingestion
* ECharts and ApexCharts for visualisations
* Mapbox GL, Turf and Terraformer for the suburb map
* React PDF Renderer and Vercel Blob for the planned briefs
* Vercel Analytics and Speed Insights

## Project structure

```txt
app/
  api/
    assistant/route.ts        streaming assistant endpoint
    sentiment/route.ts        sentiment slice
    sentiment/trend/route.ts  trend series
    sentiment/compare/route.ts
    filters/route.ts          filter catalogue
    revalidate/route.ts       on-demand revalidation
  layout.tsx
  loading.tsx
  page.tsx                    the dashboard

components/
  ai/
    AssistantChat.tsx         shared chat (useChat, streaming, composer)
    AssistantDock.tsx         docked copilot with a maximize toggle
    ToolCallView.tsx          the tool-call audit timeline
  dashboard/                  filter bar, KPIs, charts, drivers, word cloud, map
  shell/AppShell.tsx          sidebar shell
  ui/                         Card, Button, Badge, Skeleton, Spinner

lib/
  ai/model.ts                 Gateway-backed model resolution
  assistant/
    tools.ts                  grounded typed read tools
    systemPrompt.ts           the grounding contract
    sessions.ts               chat_sessions persistence
  db/
    client.ts                 Neon HTTP client
    schema.sql                aggregate and supporting tables
    poi-schema.sql            POI landing tables
    poi-indexes.sql
    qld-suburbs.sql           Queensland scoping
  repositories/               sentimentRepository, poiRepository
  services/sentimentService.ts
  validation/sentiment.ts
  filters.ts, types.ts, ui/sentiment.ts, cache/cacheKeys.ts

scripts/
  migrate.ts                  apply schema
  import-sentiment-data.ts    load the suburb aggregate
  import-poi-data.ts          stream the POI export into Neon
  build-suburb-boundaries.mjs build the Queensland boundary GeoJSON
```

## Getting started

### 1. Install dependencies

```bash
npm install
```

### 2. Create a local environment file

```bash
cp .env.example .env.local
```

### 3. Configure environment variables

Required to run the dashboard:

```env
DATABASE_URL=
NEXT_PUBLIC_MAPBOX_TOKEN=
NEXT_PUBLIC_SUBURB_GEOJSON_URL=
```

Required for the assistant:

```env
AI_GATEWAY_API_KEY=
```

Optional:

```env
NEXT_PUBLIC_APP_ENV=development
NEXT_PUBLIC_ENABLE_ARCHITECTURE_PANEL=true
EVALS_REQUIRE_PASS=false
SUBURB_BOUNDARY_GEOJSON_URL=
```

`NEXT_PUBLIC_*` values are inlined at build time, so set them before building and restart the dev server after changing them. On Vercel the AI Gateway authenticates with the project's OIDC token, so `AI_GATEWAY_API_KEY` is only needed locally.

Note: `vercel env pull` overwrites `.env.local` and returns blank values for variables marked sensitive on Vercel. Pull into a separate file (`vercel env pull /tmp/x.env`) and copy across what you need, rather than letting it target `.env.local`.

### 4. Run the database migration

```bash
npm run db:migrate
```

### 5. Import data

```bash
npm run import:sentiment -- ./data/sentiment.csv   # the suburb aggregate
tsx scripts/import-poi-data.ts                     # the Queensland POI dataset
```

Local data files are ignored and should not be committed.

### 6. Run locally

```bash
npm run dev
```

Open `http://localhost:3000`.

## Scripts

```json
{
  "dev": "next dev",
  "build": "next build",
  "start": "next start",
  "lint": "eslint",
  "typecheck": "tsc --noEmit",
  "db:migrate": "tsx scripts/migrate.ts",
  "import:sentiment": "tsx scripts/import-sentiment-data.ts",
  "evals": "tsx scripts/run-evals.ts",
  "ci": "npm run typecheck && npm run lint && npm run evals && npm run build"
}
```

The `evals` script (and therefore `ci`) is reserved for the planned evaluation suite and is not wired up yet.

## Deployment

The app is deployed on Vercel.

```txt
main      -> production
staging   -> preview/staging
feature/* -> preview deployments
```

After a deploy, verify in the Vercel preview or production URL:

* the dashboard loads and opens on a Queensland suburb
* filters and the suburb map work
* the sentiment API routes return data
* the assistant streams a grounded answer

## Why this project exists

PlacePulse is designed to show how sentiment intelligence can move from raw review data to operational decision-making, on Vercel-native primitives. It focuses on three outcomes:

1. **Faster analysis**: move from suburb and category filters to sentiment drivers quickly.
2. **Evidence-backed answers**: every assistant figure is read from a tool over the real data, with an audit timeline to prove it.
3. **AI-assisted workflows**: the assistant (and the planned briefs) reduce manual analysis without bypassing the underlying data.

## License

This project is for demonstration and portfolio purposes only. Feel free to reuse whatever helps you.
