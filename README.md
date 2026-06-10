# PlacePulse Sentiment Intelligence Console

A full-stack Vercel application for exploring customer review sentiment across Australian places, categories and time periods.

PlacePulse turns sentiment data into fast, evidence-backed insight. Users can filter by geography, category and date, inspect sentiment movements, explore positive and negative themes, review supporting evidence, and use an AI assistant to generate stakeholder-ready briefing notes.

This project was built for the Vercel Solutions Architect take-home assessment.

---

## Why this exists

Organisations often have large volumes of customer review and place sentiment data, but it is hard to quickly understand:

* what people are saying
* where sentiment is improving or declining
* which themes are driving positive or negative experience
* how confident an insight is based on review coverage
* what a stakeholder should do next

PlacePulse solves that by combining:

* a performant sentiment dashboard
* backend sentiment APIs
* Vercel AI SDK-powered assistant workflows
* tool-grounded data retrieval
* evidence-backed explanations
* persisted briefing jobs
* lightweight AI evaluations
* production-style deployment and observability

The goal is to move from raw review data to decision-ready insight.

---

## Vercel assessment framing

The Vercel prompt was:

> Build something small on Vercel that solves a real problem, then present it like you would to a customer.

This project focuses on the **AI Cloud** track, while also demonstrating strong **Frontend Cloud** decisions.

It includes:

* a deployed Next.js application on Vercel
* server-rendered dashboard content
* client-side interactive filters and charts
* backend APIs for sentiment data
* Vercel AI SDK-powered assistant
* AI SDK tool calls over the backend service layer
* persisted briefing jobs that survive reloads and disconnections
* lightweight AI evaluation checks
* CI/CD workflow for typecheck, lint, evals and build
* production-oriented architecture documentation
* a customer-style demo flow

The app is intentionally scoped to be small enough to explain deeply, while still showing architectural judgement around rendering, APIs, AI tool use, persistence, evals, caching and deployment.

---

## Product summary

PlacePulse is a sentiment intelligence console.

A user can:

1. Select an area.
2. Select a category.
3. Select a month or date range.
4. View sentiment KPIs.
5. Inspect sentiment trends.
6. Explore positive and negative themes.
7. Read supporting review evidence.
8. Ask the AI assistant to explain the current view.
9. Ask for comparisons across places or categories.
10. Generate a durable stakeholder briefing.
11. Reopen the briefing later from a persisted URL.

---

## Data and API model

This app is built against a sentiment data layer exposed through backend APIs.

During planning, a small schema sample was used only to understand the shape of the sentiment data: the available fields, metric names, JSON structures, filter dimensions and review evidence format.

At runtime, the app works like a normal production analytics product:

```txt
Dashboard filter state or AI tool request
  ↓
Next.js route handler
  ↓
sentiment service
  ↓
sentiment repository
  ↓
backend sentiment API or database
  ↓
filtered sentiment response
  ↓
dashboard, charts, review evidence and AI assistant
```

The dashboard and AI assistant both request sentiment data through the backend API as needed, based on the active filters or the AI tool call.

For the take-home implementation, the backend sentiment data layer can be backed by Vercel Postgres / Neon. The same service and repository boundary could later point to a larger analytical API, warehouse or customer data service without changing the dashboard or assistant architecture.

---

## Sentiment schema

The app is designed around a sentiment aggregate schema with fields such as:

* `agg_type`
* `date`
* `area_name`
* `category`
* `poi_count`
* `reviewed_poi_count`
* `total_reviews`
* `text_signal_reviews`
* `theme_review_count`
* `avg_rating`
* `star_rating_sentiment_100`
* `review_text_sentiment_100`
* `overall_satisfaction_100`
* `positive_reviews`
* `negative_reviews`
* `neutral_reviews`
* `unknown_reviews`
* `positive_pct`
* `negative_pct`
* `neutral_pct`
* `unknown_pct`
* `review_coverage_pct`
* `text_signal_coverage_pct`
* `theme_coverage_pct`
* `rating_text_conflict_count`
* `rating_text_conflict_pct`
* `theme_cloud_json`
* `theme_sentiment_json`
* `word_cloud_json`
* `top_reviews_json`

This allows the dashboard and AI assistant to explain not just the headline score, but the evidence behind it.

---

## Core features

### Sentiment dashboard

Users can explore sentiment by:

* aggregation type
* area
* category
* date or time period

The dashboard shows:

* overall satisfaction score
* average rating
* total reviews
* reviewed POI count
* positive / negative / neutral split
* review coverage
* theme coverage
* rating-text conflict rate
* sentiment trend
* top positive and negative themes
* word cloud
* top review evidence

---

### Evidence-backed insight

The app is built around evidence, not just generated summaries.

The UI exposes:

* quantitative sentiment metrics
* coverage and confidence indicators
* positive and negative themes
* word-cloud terms
* top review snippets
* comparison deltas
* AI-generated explanations grounded in retrieved data

This makes the app useful for stakeholder reporting because the user can see both the metric and the supporting evidence.

---

### AI assistant

The assistant can:

* explain the current sentiment view
* identify positive and negative drivers
* compare areas
* compare categories
* retrieve review evidence
* summarise themes
* generate stakeholder-ready briefing notes
* mention data quality caveats where coverage is low

The assistant is tool-grounded. It does not invent metrics, reviews, areas, categories or dates.

AI tools call the same backend service layer as the dashboard:

```txt
AI tool
  ↓
sentimentService
  ↓
sentimentRepository
  ↓
backend sentiment data
```

This keeps AI responses grounded in the same trusted data path as the UI.

---

## Vercel AI SDK implementation

The AI layer is built with the **Vercel AI SDK**.

The app does not use a raw model-provider SDK as the main architecture. OpenAI can be used as the underlying model provider through `@ai-sdk/openai`, but the product is architected around the Vercel AI SDK.

```txt
Assistant UI
  ↓
@ai-sdk/react useChat
  ↓
/api/chat Vercel Function
  ↓
AI SDK streamText()
  ↓
AI SDK tools
  ↓
sentimentService
  ↓
sentimentRepository
  ↓
backend sentiment data
```

For durable brief generation:

```txt
Generate Brief
  ↓
/api/briefs
  ↓
brief job persisted
  ↓
briefingService
  ↓
AI SDK generateText()
  ↓
filtered sentiment evidence
  ↓
brief saved to database
  ↓
/briefs/[id]
```

Required AI packages:

```bash
npm install ai @ai-sdk/react @ai-sdk/openai zod
```

Example model provider setup:

```ts
import { openai } from "@ai-sdk/openai";

export const defaultModel = openai("gpt-4o-mini");
```

The architecture is AI Gateway-ready, meaning the provider layer can later move behind Vercel AI Gateway for model routing, observability, fallback behaviour and governance.

---

## AI tools

The AI SDK tools are designed around the same actions a user can take in the dashboard.

Example tools:

* `listAvailableFilters`
* `getSentimentSlice`
* `getSentimentTrend`
* `compareAreas`
* `compareCategories`
* `getThemeEvidence`
* `getTopReviewEvidence`
* `createBriefJob`

The model decides when a tool is needed, but the tool execution is controlled by typed schemas and server-side services.

Example flow:

```txt
User asks:
"Why is negative sentiment high for this category?"

AI SDK tool call:
getSentimentSlice({ areaName, category, date })

Service response:
summary metrics + negative themes + review evidence

Assistant response:
evidence-backed explanation
```

---

## Prompting and context strategy

The assistant receives:

* the current dashboard filter state
* the current visible sentiment summary
* available tool definitions
* system rules for evidence-backed behaviour

The assistant can request additional data through tools when it needs:

* trend data
* comparison data
* theme details
* review evidence
* valid filter options

The assistant should:

* use tool results for factual claims
* explain uncertainty when coverage is low
* avoid unsupported causal claims
* include metrics and evidence where useful
* keep answers stakeholder-friendly

---

## Durable briefing generation

Longer-running briefing generation is handled as a persisted job.

```txt
User clicks Generate Brief
  ↓
brief job created in database
  ↓
AI generates an evidence-backed report
  ↓
brief result is persisted
  ↓
user can refresh or disconnect
  ↓
/briefs/[id] still shows status/result
```

This is designed to demonstrate the type of stateful application pattern that maps cleanly to Vercel Workflows in a production implementation.

A generated brief includes:

* selected area/category/date context
* headline sentiment result
* key positive drivers
* key negative drivers
* supporting review evidence
* coverage caveats
* recommended stakeholder actions

---

## Lightweight AI evaluations

The project includes a lightweight evaluation approach for the AI Cloud track.

The evals check that the assistant:

* does not hallucinate unavailable data
* only uses valid filters
* mentions low coverage when relevant
* does not overclaim causality
* preserves sentiment directionality
* includes evidence in generated briefings

The evals can be viewed in the app and run from the command line.

---

## Architecture

```txt
Browser
  ↓
Vercel CDN / Edge Network
  ↓
Next.js App Router
  ├── Server Components
  ├── Client Components
  ├── Suspense-streamed panels
  └── Route Handlers
        ↓
Vercel Functions / Fluid Compute
  ├── /api/filters
  ├── /api/sentiment
  ├── /api/sentiment/trend
  ├── /api/sentiment/compare
  ├── /api/chat
  ├── /api/briefs
  ├── /api/briefs/[id]
  └── /api/evals
        ↓
Service layer
  ├── sentimentService
  ├── briefingService
  ├── chatStateService
  ├── evalService
  └── auditService
        ↓
Repository layer
  ├── sentimentRepository
  ├── briefRepository
  ├── chatRepository
  ├── evalRepository
  └── auditRepository
        ↓
Backend data layer
  ├── sentiment_area_category_month
  ├── brief_jobs
  ├── chat_sessions
  ├── saved_views
  ├── eval_runs
  ├── import_jobs
  └── audit_events
```

---

## Key architectural decisions

### 1. API and repository boundary

The UI does not directly know where the sentiment data comes from.

All data access goes through:

```txt
API route
  ↓
service layer
  ↓
repository layer
  ↓
backend data source
```

This keeps the frontend simple and allows the backend source to change later without rewriting the dashboard or AI tools.

---

### 2. Backend sentiment data layer

The app is designed around a backend sentiment data layer.

For the take-home implementation, this can be backed by Vercel Postgres / Neon.

The primary sentiment grain is:

```txt
agg_type
date
area_name
category
```

This supports dashboard queries like:

```txt
area + category + month
category + month
area + date range
comparison area + base area
```

---

### 3. Server-rendered first view

The first dashboard view is server-rendered so users get useful content quickly.

Server-rendered content includes:

* page shell
* selected filter summary
* KPI cards
* data quality panel
* deployment status panel

This supports a stronger Largest Contentful Paint story.

---

### 4. Client components only where needed

Client-side React is used for:

* filters
* charts
* assistant drawer
* word-cloud interactions
* brief status polling

This keeps the JavaScript bundle smaller and supports better responsiveness.

---

### 5. Streaming secondary panels

Non-critical dashboard sections can be streamed with Suspense:

* themes
* word cloud
* review evidence
* comparison panels

This improves perceived performance while keeping layout stable.

---

### 6. Cached filtered APIs

The sentiment APIs return filtered responses and can be cached where appropriate.

Good candidates for caching:

* filter options
* sentiment slices
* trend results
* comparison results

Not cached:

* AI chat
* brief generation mutations
* audit writes
* user-specific state mutations

---

### 7. Vercel AI SDK first

The AI layer uses the Vercel AI SDK rather than directly coupling the app to a provider SDK.

Frontend:

```txt
@ai-sdk/react useChat
```

Backend:

```txt
AI SDK streamText()
AI SDK generateText()
AI SDK tools
```

The app can use OpenAI underneath through `@ai-sdk/openai`, but the application architecture stays provider-abstracted and AI Gateway-ready.

---

### 8. Tool-grounded AI

The assistant uses tools to retrieve facts.

Tools call the same backend service layer as the dashboard:

```txt
AI tool
  ↓
sentimentService
  ↓
sentimentRepository
  ↓
backend data
```

This improves reliability, security and explainability.

---

### 9. Persisted jobs for disconnection resilience

Generated briefings are persisted in the backend data layer.

This means a user can start a job, refresh the page, close the browser, and return to the result later.

This directly supports stateful application behaviour.

---

### 10. Lightweight evals

The eval harness checks common AI failure modes:

* hallucinated filters
* missing-data behaviour
* unsupported causality
* low-coverage caveats
* evidence-backed summaries
* sentiment directionality

This gives the project a clear AI quality story.

---

## Core Web Vitals considerations

### LCP

The first meaningful dashboard content is server-rendered.

This helps the user see the key sentiment metrics quickly.

### CLS

Cards, charts and streamed panels use stable containers and skeletons.

This avoids layout jumps as secondary content loads.

### INP

Only interactive parts hydrate on the client.

Filtering and chart interactions are kept responsive by requesting only the data needed for the current view.

### TTFB

Filtered APIs use indexed backend queries and caching where appropriate.

This reduces server response time and backend load.

---

## Security and reliability

The app is designed with production constraints in mind:

* database credentials are server-only
* model/provider keys are server-only
* query parameters are validated
* AI tools have bounded schemas
* invalid filters return safe errors
* generated briefs are persisted
* evals catch common AI failure modes
* CI checks run before deployment
* Vercel environment variables separate local, preview and production config

---

## Failure modes

| Failure                  | Handling                                                     |
| ------------------------ | ------------------------------------------------------------ |
| Invalid filter           | Return 400 and reset UI to valid state                       |
| Backend data unavailable | Show dashboard error state; assistant uses fallback response |
| AI unavailable           | Dashboard still works; assistant returns fallback message    |
| Low review coverage      | UI and AI show caveat                                        |
| Brief generation fails   | Persist failed status and error                              |
| User disconnects         | `/briefs/[id]` can recover status/result                     |
| Unknown area/category    | Assistant uses filter tool instead of inventing              |

---

## Tech stack

* Next.js App Router
* React
* TypeScript
* Tailwind CSS
* Vercel
* Vercel Functions
* Fluid Compute
* Vercel AI SDK
* `@ai-sdk/react`
* `@ai-sdk/openai`
* Vercel Postgres / Neon
* Recharts
* Zod
* GitHub Actions
* Vercel Web Analytics
* Vercel Speed Insights

---

## Project structure

```txt
app/
  page.tsx
  layout.tsx
  globals.css

  briefs/
    [id]/
      page.tsx

  evals/
    page.tsx

  api/
    filters/
      route.ts
    sentiment/
      route.ts
      trend/
        route.ts
      compare/
        route.ts
    chat/
      route.ts
    briefs/
      route.ts
      [id]/
        route.ts
    evals/
      route.ts

components/
  dashboard/
    FilterBar.tsx
    SentimentKpiCards.tsx
    SentimentTrendChart.tsx
    SentimentBreakdownChart.tsx
    ThemeRankingPanel.tsx
    WordCloudPanel.tsx
    EvidenceReviewsPanel.tsx
    CoverageConfidencePanel.tsx
    DataFreshnessPanel.tsx
    ArchitectureDecisionPanel.tsx

  ai/
    SentimentAssistantDrawer.tsx
    SuggestedPrompts.tsx
    AIRuntimePanel.tsx
    AssistantActionMessage.tsx

  briefs/
    DurableBriefPanel.tsx
    BriefStatusCard.tsx
    SavedBriefViewer.tsx

  evals/
    EvalResultsPanel.tsx
    EvalCaseCard.tsx

  platform/
    DeploymentStatusCard.tsx

  ui/
    Card.tsx
    Button.tsx
    Badge.tsx
    Skeleton.tsx

lib/
  ai/
    model.ts
    prompt.ts
    tools.ts
    guardrails.ts

  data/
    catalogue.ts
    parsers.ts

  db/
    client.ts
    schema.sql

  repositories/
    sentimentRepository.ts
    briefRepository.ts
    chatRepository.ts
    evalRepository.ts
    auditRepository.ts

  services/
    sentimentService.ts
    briefingService.ts
    chatStateService.ts
    evalService.ts

  workflows/
    generateSentimentBriefWorkflow.ts

  cache/
    cacheKeys.ts

  platform/
    vercelEnv.ts

  types.ts

scripts/
  import-sentiment-data.ts
  run-evals.ts

docs/
  architecture.md
  demo-script.md
  vercel-feedback.md

.github/
  workflows/
    ci.yml
```

---

## Getting started

Install dependencies:

```bash
npm install
```

Copy environment variables:

```bash
cp .env.example .env.local
```

Run the development server:

```bash
npm run dev
```

Open:

```txt
http://localhost:3000
```

---

## Environment variables

Create `.env.local` using `.env.example`.

```env
NEXT_PUBLIC_APP_ENV=development
NEXT_PUBLIC_ENABLE_ARCHITECTURE_PANEL=true

DATABASE_URL=

OPENAI_API_KEY=

EVALS_REQUIRE_PASS=false
```

In Vercel, configure environment variables separately for:

* Development
* Preview
* Production

---

## Database setup

The main backend table is:

```txt
sentiment_area_category_month
```

Supporting tables include:

```txt
brief_jobs
chat_sessions
saved_views
eval_runs
import_jobs
audit_events
```

Run the database schema from:

```txt
lib/db/schema.sql
```

---

## Importing sentiment data

The import script should:

1. Read the source CSV/JSON.
2. Validate required columns.
3. Parse JSON fields:

   * `theme_cloud_json`
   * `theme_sentiment_json`
   * `word_cloud_json`
   * `top_reviews_json`
4. Upsert rows into `sentiment_area_category_month`.
5. Record import metadata in `import_jobs`.

Example:

```bash
npm run import:sentiment -- ./data/sentiment_full.csv
```

---

## Useful scripts

```bash
npm run dev
npm run typecheck
npm run lint
npm run evals
npm run build
npm run ci
```

Recommended `package.json` scripts:

```json
{
  "scripts": {
    "dev": "next dev",
    "typecheck": "tsc --noEmit",
    "lint": "next lint",
    "evals": "tsx scripts/run-evals.ts",
    "ci": "npm run typecheck && npm run lint && npm run evals && npm run build",
    "import:sentiment": "tsx scripts/import-sentiment-data.ts",
    "build": "next build",
    "start": "next start"
  }
}
```

---

## CI/CD

GitHub Actions should run on pull requests and pushes to `staging` or `main`.

CI checks:

* TypeScript typecheck
* lint
* lightweight AI evals
* production build

Deployment flow:

```txt
feature branch
  ↓
Vercel Preview Deployment
  ↓
staging branch
  ↓
staging deployment
  ↓
main branch
  ↓
production deployment
```

---

## Demo flow

For the Vercel interview, the live demo should cover:

1. Open the deployed app.
2. Explain the customer problem.
3. Filter by area, category and date.
4. Show KPI cards and sentiment distribution.
5. Show trend and themes.
6. Show review evidence.
7. Ask the AI assistant to explain the current view.
8. Ask the assistant to compare another area or category.
9. Generate a durable sentiment brief.
10. Refresh `/briefs/[id]` to show persisted state.
11. Open `/evals` to show AI quality checks.
12. Explain the architecture and Vercel platform choices.

---

## Vercel platform decisions

### Next.js App Router

Used for server rendering, route handlers, streaming and client/server component boundaries.

### Vercel Functions

Used for backend APIs, AI routes, brief jobs and eval routes.

### Fluid Compute

Used for AI and I/O-heavy routes that wait on model calls, database calls and tool execution.

### Vercel AI SDK

Used for streaming assistant responses, tool calling and provider abstraction.

### Vercel Postgres / Neon

Used for the take-home backend data layer and persisted application state.

### Vercel Workflows-ready design

Brief generation is designed as a durable job that can map to Workflows for production stateful execution.

### Web Analytics and Speed Insights

Used for usage and performance visibility.

---

## AI SDK implementation details

The AI implementation is intentionally Vercel AI SDK-first.

```txt
@ai-sdk/react useChat
  ↓
/api/chat
  ↓
streamText()
  ↓
tools
  ↓
sentimentService
```

Provider setup:

```ts
import { openai } from "@ai-sdk/openai";

export const defaultModel = openai("gpt-4o-mini");
```

The app can later move to AI Gateway without changing the dashboard or service architecture.

---

## Evaluation approach

The app includes lightweight AI evaluation checks.

Examples:

| Eval                     | Purpose                                                |
| ------------------------ | ------------------------------------------------------ |
| Missing data fallback    | Assistant should not invent unavailable fields         |
| Valid filters only       | Assistant should not invent area/category/date values  |
| Coverage caveat          | Assistant should mention low review/theme coverage     |
| No unsupported causality | Assistant should avoid overclaiming drivers            |
| Evidence-backed brief    | Brief should include metrics and review evidence       |
| Directionality           | Negative sentiment should not be described as positive |

Run evals:

```bash
npm run evals
```

---

## What I would extend next

With more time, I would add:

* multi-tenant authentication
* saved views
* scheduled sentiment monitoring
* alerting when negative sentiment spikes
* full Vercel Workflows implementation for imports and brief jobs
* AI Gateway for provider routing and model fallback
* Blob export for PDF/Markdown brief outputs
* larger eval set with golden examples
* map-based geography exploration
* role-based access controls

---

## Submission notes

The submitted project should include:

* deployed Vercel URL
* GitHub repo URL
* readable code
* comments where deliberate decisions were made
* architecture docs
* Vercel feedback doc
* working `/evals` page
* working AI assistant
* working durable brief flow

---

## Presentation positioning

The project should be presented as:

> A full-stack Vercel sentiment intelligence app that turns customer review data into fast, explorable, evidence-backed insight. It demonstrates Next.js rendering choices, backend API boundaries, Vercel AI SDK tool use, durable persisted state, lightweight AI evals, and production deployment thinking.

The key architectural point:

> The dashboard and AI assistant use the same trusted backend data path. The frontend requests the data needed for the current view, and the AI assistant retrieves evidence through typed Vercel AI SDK tools.
