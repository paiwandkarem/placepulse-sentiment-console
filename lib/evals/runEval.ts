import "server-only";
import { generateText, stepCountIs } from "ai";
import { model } from "@/lib/ai/model";
import { assistantTools } from "@/lib/assistant/tools";
import { ASSISTANT_SYSTEM_PROMPT } from "@/lib/assistant/systemPrompt";
import { EVAL_CASES, type EvalCase } from "./cases";

// Runs a case through the same model, tools and grounding prompt the live assistant uses (via
// generateText rather than streamText, so we can inspect the tool calls and the final answer), then
// applies the grounding checks. This is the real path, not a mock, so a pass means the deployed
// assistant would behave the same way.

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

export async function runEvalCase(testCase: EvalCase): Promise<CaseResult> {
  const result = await generateText({
    model: model("assistant"),
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
    const lower = answer.toLowerCase();
    const flagged = /queensland|do not have|don't have|no data|not available|only covers|outside/.test(lower);
    checks.push({
      name: "no invention",
      pass: flagged,
      detail: flagged ? "flagged coverage / declined" : "did not flag the out-of-coverage place",
    });
  } else {
    const correctTool = testCase.expectTool ? toolsCalled.includes(testCase.expectTool) : true;
    checks.push({
      name: "correct tool",
      pass: correctTool,
      detail: `expected ${testCase.expectTool}, called [${toolsCalled.join(", ") || "none"}]`,
    });

    // Grounded: at least one figure in the answer matches a tool-result figure, compared as rounded
    // integers so prose rounding ("71" for 71.3) still counts.
    const resultNumbers = new Set(toolResults.flatMap((entry) => numbersIn(entry)).map((figure) => Math.round(figure)));
    const grounded = numbersIn(answer).some((figure) => resultNumbers.has(Math.round(figure)));
    checks.push({
      name: "grounded",
      pass: grounded,
      detail: grounded ? "answer cites a figure from tool output" : "no tool figure found in the answer",
    });
  }

  return {
    id: testCase.id,
    question: testCase.question,
    pass: checks.every((check) => check.pass),
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
