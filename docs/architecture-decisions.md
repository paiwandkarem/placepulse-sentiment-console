# PlacePulse — Architecture Decisions & Build Log

A running record of the architectural reasoning behind this build, kept so the decisions
can be explained out loud. The authoritative build sequence is the 42-commit execution
plan; this document captures *why* each non-trivial choice was made and where we
deliberately diverge from the plan.

## Context

PlacePulse is a sentiment-intelligence console: a server-rendered analytics dashboard, a
tool-grounded AI assistant, and durable AI-generated briefings (exported to PDF). The
source data describes review sentiment per Australian *area × category × month*.

**The single most important architectural decision is the data boundary:** the CSV/TSV
export is an *import input only*. At runtime the application reads exclusively from
**Neon Postgres** through Vercel Functions. There is no file I/O on the request path.
This is what makes the app production-shaped rather than a demo, and it drives the whole
layering below.

## Layering

```
Route handler / RSC  →  Service (business logic)  →  Repository (SQL)  →  Neon
```

- **Repository** owns SQL and row→domain mapping. No business rules.
- **Service** owns business logic (defaulting filters, composing the dashboard context,
  comparisons). No SQL, no HTTP.
- **Route handlers / Server Components** own transport and caching. No SQL, no business
  rules.

Validation (Zod) lives in `lib/validation` and is shared between API routes and AI tools,
so the assistant and the REST surface enforce the same contract.

## State of the inherited code (assessment at commit 3)

Reviewed before continuing the build:

| Item | Finding | Action |
|------|---------|--------|
| `lib/db/client.ts` (commit 2) | Correct. Uses Neon's serverless HTTP driver. `server-only` is aliased internally by Next 16 so the app builds. | Keep. |
| `lib/types.ts`, `lib/db/schema.sql` | Sound, typechecks. Schema has extra star-rating columns the importer doesn't populate yet — harmless, nullable. | Keep. |
| `scripts/migrate.ts` | **Broken.** Written against the `postgres` driver (`sql.unsafe()` over the whole file, `sql.end()`); Neon's HTTP driver has no `.end()` (confirmed by `tsc`) and executes one statement per round trip. Also imported `lib/db/client`, which is `server-only` and unresolvable from a `tsx` process. | Rewrite (commit 3). |
| `package.json` | `postgres` dependency present but imported nowhere (leftover from the old migrate approach). Plan's commit-1 scripts (`typecheck`, `db:migrate`, `import:sentiment`, `evals`, `ci`) were never added. | Complete the manifest. |

## Decisions & deviations from the plan

### D1 — Scripts never import the `server-only` data client
CLI scripts (`migrate`, `import-sentiment`, `run-evals`) run under `tsx`, outside the Next
bundler. `lib/db/client.ts` is marked `server-only`, which Next resolves via an internal
alias but Node/tsx cannot. Therefore every script instantiates its **own** `neon()` client
from `DATABASE_URL`. This is a deliberate boundary, not duplication — it keeps the runtime
data client unambiguously server-only.

### D2 — Migration runner splits statements on purpose
Neon's HTTP driver sends one statement per request, so the runner splits the SQL file on
`;` and executes statements sequentially with `sql.query(...)`. The naive split is safe
here because our schema/migrations use only plain statements — no PL/pgSQL functions or
dollar-quoted bodies. This is documented in the code so the tradeoff is explicit.

### D3 — AI SDK is v6, not v5 (plan prose is stale)
`ai@6` is installed. The plan's API shapes (`DefaultChatTransport`, `inputSchema`,
`streamText`, `convertToModelMessages`, `stepCountIs`, `toUIMessageStreamResponse`) carry
forward into v6 — each will be validated against the installed version when reached.

### D4 — AI provider: route through the Vercel AI Gateway — DECIDED
The plan wires `@ai-sdk/openai` directly. We instead route through the **AI Gateway**
using `"provider/model"` strings, because for a Vercel build it is the stronger story:
unified key, built-in observability, model failover, zero data retention, and provider
portability with no code change. `lib/ai/model.ts` (commit 26) will export
`gateway("openai/gpt-4o-mini")` / `gateway("openai/gpt-4o")`; switching providers later is
a one-line change. Env: `AI_GATEWAY_API_KEY` (or Vercel OIDC in deployment) replaces the
plan's `OPENAI_API_KEY` — `.env.example` and the CI workflow will be updated at commit 26.

### D5 — "Durable" briefs are not yet durable — OPEN
`startBriefGeneration` fires `runBriefGeneration(id)` without awaiting and returns `202`.
On serverless/Fluid Compute the instance can be reclaimed before the background LLM call
finishes, leaving a job stuck in `running`. DB persistence makes the job *pollable and
recoverable*, but not *durably executed*. Minimum fix: `after()` from `next/server` to
keep the instance alive for the background work. Production answer: **Vercel Queues** or
the **Workflow DevKit** for crash-safe, retryable execution. Affects commit 33.

## Caching posture (for later commits)

Read APIs set `s-maxage`/`stale-while-revalidate`; the dashboard uses route-segment
revalidation; a token-guarded `/api/revalidate` endpoint invalidates on demand. Next 16's
Cache Components / `use cache` will be evaluated against the docs when those routes land —
the header-based approach is kept where it makes the cache story easier to narrate.
