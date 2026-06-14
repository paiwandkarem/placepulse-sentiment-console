import "server-only";
import { generateObject, generateText, stepCountIs } from "ai";
import { z } from "zod";
import { model, withModelFallback, MAX_RETRIES } from "@/lib/ai/model";
import { assistantTools } from "@/lib/assistant/tools";
import { ASSISTANT_SYSTEM_PROMPT } from "@/lib/assistant/systemPrompt";
import { EVAL_CASES, type EvalCase } from "./cases";

// Runs a case through the same model, tools and grounding prompt the live assistant uses (via
// generateText rather than streamText, so we can inspect the tool calls and the final answer), then
// applies the grounding checks. This is the real path, not a mock, so a pass means the deployed
// assistant would behave the same way. Cases span every tool tier plus refusal and dashboard-action
// behaviour, and the synthesis-heavy cases are additionally graded by an independent LLM judge.

export type CheckResult = { name: string; pass: boolean; detail: string };
export type CaseResult = {
  id: string;
  question: string;
  pass: boolean;
  checks: CheckResult[];
  toolsCalled: string[];
  answer: string;
};

// Numeric values in any JSON-serialisable value, used to test whether an answer's figures actually
// came from a tool result. Thousands separators are stripped first so "1,240" matches "1240".
function numbersIn(value: unknown): number[] {
  const text = JSON.stringify(value ?? "").replace(/(\d),(?=\d)/g, "$1");
  return (text.match(/\d+(?:\.\d+)?/g) ?? []).map(Number).filter((value) => Number.isFinite(value));
}

// An independent faithfulness judge. A stronger model than the assistant (Opus vs Sonnet) reads the
// question, the tool results that were available, and the final answer, and decides whether every
// claim is supported. Using a different model means no model is the sole judge of its own output.
async function judgeFaithfulness(
  rubric: string,
  question: string,
  toolResults: unknown[],
  answer: string,
): Promise<CheckResult> {
  try {
    const { object } = await withModelFallback("judge", (m) =>
      generateObject({
        model: m,
        maxRetries: MAX_RETRIES,
        schema: z.object({
          faithful: z.boolean().describe("true only if every factual claim is supported by the tool results"),
          reason: z.string().describe("one sentence citing the unsupported claim, or confirming support"),
        }),
        system:
          "You are a strict faithfulness evaluator for a grounded analytics assistant. The tool results " +
          "are the ONLY permitted source of facts. Mark faithful=false if the answer states any figure, " +
          "ranking, quote or claim that is not present in, or directly derivable from, those results. " +
          "Reasonable rounding and rephrasing are fine; invented specifics are not.",
        prompt:
          `Question:\n${question}\n\n` +
          `Tool results (the only permitted source of facts):\n${JSON.stringify(toolResults)}\n\n` +
          `Answer to grade:\n${answer}\n\n` +
          `Rubric: ${rubric}`,
      }),
    );
    return {
      name: "faithful (judge)",
      pass: object.faithful,
      detail: object.reason.slice(0, 200),
    };
  } catch (error) {
    return {
      name: "faithful (judge)",
      pass: false,
      detail: `judge failed: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

export async function runEvalCase(testCase: EvalCase): Promise<CaseResult> {
  const result = await generateText({
    model: model("assistant"),
    maxRetries: MAX_RETRIES,
    system: ASSISTANT_SYSTEM_PROMPT,
    tools: assistantTools,
    stopWhen: stepCountIs(6),
    prompt: testCase.question,
  });

  // Aggregate across all steps so multi-step tool loops are captured.
  const toolCalls = result.steps.flatMap((step) => step.toolCalls);
  const toolResults = result.steps.flatMap((step) => step.toolResults);
  const toolsCalled = [...new Set(toolCalls.map((call) => call.toolName))];
  const answer = result.text;
  const checks: CheckResult[] = [];

  if (testCase.outOfCoverage) {
    // Must not invent: signal Queensland-only coverage or no data, rather than asserting figures.
    const flagged = /queensland|do not have|don't have|no data|not available|only covers|outside/.test(
      answer.toLowerCase(),
    );
    checks.push({
      name: "no invention",
      pass: flagged,
      detail: flagged ? "flagged coverage / declined" : "did not flag the out-of-coverage place",
    });
  } else if (testCase.refusalPattern) {
    // Out-of-scope action: the assistant only reads and reports, so it must decline rather than
    // pretend to act. Match the case's refusal language against the answer.
    const matched = new RegExp(testCase.refusalPattern, "i").test(answer);
    checks.push({
      name: "declines out-of-scope action",
      pass: matched,
      detail: matched ? "declined / explained it cannot act" : "did not clearly decline the action",
    });
  } else {
    // All required tools were called.
    if (testCase.expectTools?.length) {
      const missing = testCase.expectTools.filter((name) => !toolsCalled.includes(name));
      checks.push({
        name: "correct tool",
        pass: missing.length === 0,
        detail: `expected [${testCase.expectTools.join(", ")}], called [${toolsCalled.join(", ") || "none"}]`,
      });
    }

    // At least one of these tools was called (multi-step evidence questions).
    if (testCase.expectAnyTools?.length) {
      const hit = testCase.expectAnyTools.some((name) => toolsCalled.includes(name));
      checks.push({
        name: "uses evidence tool",
        pass: hit,
        detail: `expected one of [${testCase.expectAnyTools.join(", ")}], called [${toolsCalled.join(", ") || "none"}]`,
      });
    }

    // A dashboard-action request actually drove the dashboard.
    if (testCase.expectDashboardUpdate) {
      const applied = toolResults.some((entry) => {
        const output = (entry as { output?: unknown }).output as { applied?: boolean } | undefined;
        return output?.applied === true;
      });
      checks.push({
        name: "drove dashboard",
        pass: applied,
        detail: applied ? "setDashboardFilter applied" : "dashboard was not updated",
      });
    }

    // Grounded: at least one figure in the answer matches a tool-result figure, compared as rounded
    // integers so prose rounding ("71" for 71.3) still counts. Skipped for pure actions.
    if (testCase.expectGrounded !== false) {
      const resultNumbers = new Set(
        toolResults.flatMap((entry) => numbersIn(entry)).map((figure) => Math.round(figure)),
      );
      const grounded = numbersIn(answer).some((figure) => resultNumbers.has(Math.round(figure)));
      checks.push({
        name: "grounded",
        pass: grounded,
        detail: grounded ? "answer cites a figure from tool output" : "no tool figure found in the answer",
      });
    }

    // Independent LLM faithfulness judge for the synthesis-heavy cases.
    if (testCase.judge) {
      checks.push(await judgeFaithfulness(testCase.judge, testCase.question, toolResults, answer));
    }
  }

  return {
    id: testCase.id,
    question: testCase.question,
    pass: checks.length > 0 && checks.every((check) => check.pass),
    checks,
    toolsCalled,
    answer,
  };
}

export async function runAllEvals(): Promise<CaseResult[]> {
  const results: CaseResult[] = [];
  // Sequential to keep model concurrency low and the output readable.
  for (const testCase of EVAL_CASES) {
    results.push(await runEvalCase(testCase));
  }
  return results;
}
