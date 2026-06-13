import { z } from "zod";
import type { ReviewSentiment } from "@/lib/types";
import type { RiskTier } from "./theme";

// The shape of a generated brief. generateObject is constrained to this schema, so the model returns
// a structured, predictable object that the PDF and the briefs page can both consume without parsing
// prose. Descriptions double as instructions to the model.

export const briefContentSchema = z.object({
  headline: z
    .string()
    .describe("A single sharp line summarising the suburb's sentiment this period, for the top of the brief."),
  lede: z
    .string()
    .describe(
      "One opening sentence that names the suburb and weaves in its rating, satisfaction score and review count. Sets up the read.",
    ),
  riskRead: z
    .string()
    .describe(
      "Two to three decisive sentences stating where this suburb stands and why it matters. Direct and specific, the way an analyst briefs an operator. Cite the satisfaction figure.",
    ),
  executiveSummary: z
    .string()
    .describe(
      "A full paragraph, four to six sentences. State the headline figures, the direction of travel, the main strength and the main risk. No filler.",
    ),
  keyFindings: z
    .array(
      z.object({
        title: z.string().describe("A short finding title."),
        detail: z.string().describe("Two sentences that cite figures from the data."),
      }),
    )
    .min(3)
    .max(4)
    .describe("The most important findings, each tied to numbers from the data."),
  whatIsWorking: z.array(z.string()).max(4).describe("Themes reviewers consistently praise."),
  whatNeedsAttention: z.array(z.string()).max(4).describe("Themes reviewers consistently criticise."),
  recommendedActions: z
    .array(
      z.object({
        action: z.string().describe("A bold, specific action, stated as an imperative."),
        detail: z.string().describe("One sentence with the specifics: what, who, by when, or a threshold."),
      }),
    )
    .min(3)
    .max(4)
    .describe("Concrete next steps an operator can act on, each following from a finding."),
});

export type BriefContent = z.infer<typeof briefContentSchema>;

// The factual header the PDF prints alongside the drafted narrative. Straight from the data.
export type BriefMeta = {
  areaName: string;
  category: string;
  period: string;
  satisfaction100: number;
  avgRating: number;
  totalReviews: number;
  positivePct: number;
  negativePct: number;
  neutralPct: number;
  themesTracked: number;
  riskTier: RiskTier;
};

// The factual series the PDF charts draw. Trend keeps the full date so the chart can group months by
// year, the way the dashboard's over-time chart does.
export type BriefChartData = {
  trend: { date: string; value: number }[];
  distribution: { positive: number; negative: number; neutral: number };
};

// One row of the theme breakdown table, all from the data.
export type BriefThemeRow = {
  label: string;
  reviews: number;
  sentiment100: number;
  positiveCount: number;
  negativeCount: number;
  rank: number;
  volumePct: number;
};

// One real review quote for the Voice of the Customer section.
export type BriefQuote = {
  text: string;
  rating: number | null;
  sentiment: ReviewSentiment;
  sentiment100: number | null;
};

// The suburb's most frequent positive and negative terms, from its word cloud. Used to colour-code
// those words wherever they appear in the brief's prose and quotes, so the highlighting is grounded
// in this suburb's own language rather than a fixed list.
export type BriefKeywords = {
  positive: string[];
  negative: string[];
};
