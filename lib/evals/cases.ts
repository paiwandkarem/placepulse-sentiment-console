// A small, fixed set of grounding evals for the assistant. Each case is a question plus what a
// correct, grounded answer must do: call the right tool, cite a real figure from the data, and never
// invent data for a place outside Queensland. The set is intentionally small so a run is cheap and
// fast; it is a guardrail against regressions in the grounding contract, not an exhaustive benchmark.

export type EvalCase = {
  id: string;
  question: string;
  // The tool a correct answer should call. Omitted for the out-of-coverage case.
  expectTool?: string;
  // A place outside Queensland: the assistant must decline or flag coverage, not invent figures.
  outOfCoverage?: boolean;
};

export const EVAL_CASES: EvalCase[] = [
  {
    id: "suburb-sentiment",
    question: "What is the overall sentiment in Brisbane City right now?",
    expectTool: "suburbSentiment",
  },
  {
    id: "drivers",
    question: "What is driving sentiment in Brisbane City?",
    expectTool: "sentimentDrivers",
  },
  {
    id: "trend",
    question: "Is sentiment in Brisbane City improving or declining?",
    expectTool: "sentimentTrend",
  },
  {
    id: "compare",
    question: "Compare overall sentiment between Brisbane City and Surfers Paradise.",
    expectTool: "compareSuburbs",
  },
  {
    id: "out-of-coverage",
    question: "What is the customer sentiment in Springfield, Illinois?",
    outOfCoverage: true,
  },
];
