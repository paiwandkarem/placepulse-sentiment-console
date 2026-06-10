# PlacePulse — Release & Testing Checkpoints

The 42 commits are built on `staging`. Rather than merging every commit, we merge at five
milestones — each is a slice that becomes **independently testable and demoable**. The flow
at each checkpoint:

1. `git push origin staging` → Vercel builds a **preview** deployment.
2. Open a PR `staging → main` on GitHub → CI runs (once commit 42 lands), reviewers see the diff.
3. Smoke-test the **preview URL** against the checklist below.
4. Merge to `main` → Vercel promotes to **production**; re-check the production URL.

Testing on the preview first, then merging, is the whole point — `main` only ever gets a
build that already passed its checklist.

---

## Checkpoint A — Backend: data layer + read APIs (commits 1–14)
**Proves:** the runtime reads real data from Neon, validated and cached, before any UI exists.

**Prereq:** Neon connected; `DATABASE_URL` set; `npm run db:migrate` and
`npm run import:sentiment -- <file>` run against the database.

**Test (no UI yet — hit the APIs directly):**
- `GET /api/filters` → returns populated areas/categories/dates; response carries
  `Cache-Control: s-maxage=300, stale-while-revalidate=3600`.
- `GET /api/sentiment?areaName=…&category=…&date=…` → full context object; a nonsense
  selection → `404` (not `500`).
- `GET /api/sentiment/trend?areaName=…&category=…` → array of points; does **not** 500 when
  the current date has no record.
- `GET /api/sentiment/compare` with a missing param → `400` with field errors; valid but
  absent data → `404`; valid → deltas.
- `POST /api/revalidate` without the token → `401`; with it → `{ ok: true }`.

---

## Checkpoint B — Server-rendered dashboard (commits 15–25)
**Proves:** the product is real and demoable end to end.

**Prereq (Vercel UI):** enable **Web Analytics** + **Speed Insights** on the project.

**Test (preview URL):**
- Dashboard renders with live data: KPI cards, trend chart, theme/word-cloud/evidence panels,
  coverage panel.
- Filters are URL-driven: changing Area/Category/Date updates the URL and the data; a shared
  URL reproduces the same view.
- Reload is fast on second hit (edge cache); Speed Insights begins recording (LCP/TTFB).
- Mobile layout holds together.

---

## Checkpoint C — Tool-grounded AI assistant (commits 26–30)
**Proves:** the AI answers from data, not from imagination.

**Prereq:** AI Gateway reachable (OIDC locally, or `AI_GATEWAY_API_KEY`).

**Test (preview URL):**
- Open the assistant; ask "summarise sentiment for <area>/<category>" → it calls a tool and
  streams a grounded answer with real numbers.
- Ask it to compare two areas → it uses the comparison tool.
- Ask about an area that doesn't exist → it declines / says it has no data (no hallucinated
  metrics).
- Ask "why did it change?" on low-coverage data → it includes a coverage caveat.
- `Stop` cancels a stream mid-flight.

---

## Checkpoint D — Durable briefs + PDF export (commits 31–38)
**Proves:** AI output survives reloads and produces a shareable artefact.

**Prereq:** (optional) create a **Blob** store → `BLOB_READ_WRITE_TOKEN` for persistence.

**Test (preview URL):**
- Trigger a brief → `202` with a job id; the brief page shows `queued`/`running`, then
  `completed` after refresh (state persisted in Postgres, not lost on reload).
- Download PDF → a real, formatted document; with Blob configured, the job row gets a
  `pdf_blob_url`.
- An `audit_events` row is written for AI activity.

> Known limitation to verify/raise: generation is fired in the background; confirm it
> completes on Fluid Compute, and note the `after()` / Queues path (decision D5).

---

## Checkpoint E — Evals + CI → production (commits 39–42)
**Proves:** quality is checked automatically; the repo is CI-gated.

**Test:**
- `/evals` page renders the check results.
- `npm run evals` passes locally; `npm run ci` (typecheck + lint + evals + build) is green.
- The `staging → main` PR shows the **CI workflow passing** before merge.
- Merge to `main` → production deploy succeeds; re-run the Checkpoint A–D smoke tests on the
  production URL.

---

### Where we are
Through commit 13. **Checkpoint A is one commit away** (commit 14, revalidate) — the first
natural PR/merge-to-main point.
