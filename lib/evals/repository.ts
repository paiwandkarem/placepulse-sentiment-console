import "server-only";
import { sql } from "@/lib/db/client";
import type { CaseResult } from "./runEval";

// Persist one eval run to eval_runs so results are auditable over time. The full per-case results
// are stored as jsonb; status is the headline pass/fail for the run.

export async function saveEvalRun(input: {
  id: string;
  status: "passed" | "failed";
  results: CaseResult[];
}): Promise<void> {
  await sql`
    insert into eval_runs (id, status, results)
    values (${input.id}, ${input.status}, ${JSON.stringify(input.results)}::jsonb)
  `;
}
