import { randomUUID } from "node:crypto";
import { runAllEvals, runBriefEvals } from "../lib/evals/runEval";
import { saveEvalRun } from "../lib/evals/repository";

// CLI entry for the assistant grounding evals (npm run evals). Runs every case through the real
// model and tools, prints a pass/fail report, persists the run to eval_runs, and exits non-zero when
// EVALS_REQUIRE_PASS is set so the run can gate a pipeline.

async function main(): Promise<void> {
  console.log("Running grounding evals (assistant + briefs)...\n");
  const assistantResults = await runAllEvals();
  const briefResults = await runBriefEvals();
  const results = [...assistantResults, ...briefResults];

  for (const result of results) {
    console.log(`${result.pass ? "PASS" : "FAIL"}  ${result.id}`);
    console.log(`   Q: ${result.question}`);
    for (const check of result.checks) {
      console.log(`   ${check.pass ? "ok" : "X "} ${check.name}: ${check.detail}`);
    }
    console.log("");
  }

  const passed = results.filter((result) => result.pass).length;
  const status: "passed" | "failed" = passed === results.length ? "passed" : "failed";
  console.log(`${passed}/${results.length} cases passed`);

  try {
    await saveEvalRun({ id: randomUUID(), status, results });
  } catch (error) {
    console.error("Could not persist eval run:", error instanceof Error ? error.message : error);
  }

  if (status === "failed" && process.env.EVALS_REQUIRE_PASS === "true") {
    process.exitCode = 1;
  }
}

main().catch((error: unknown) => {
  console.error("Eval run failed:", error);
  process.exitCode = 1;
});
