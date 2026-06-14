import { z } from "zod";
import type { ReviewSentiment } from "@/lib/types";
import type { RiskTier } from "./theme";

// The brief type family. Each type is a member with its own content schema, draft prompt and PDF
// template, all riding the one generation pipeline (generateObject -> @react-pdf -> Blob -> job).
// Only overview is wired today; comparison, category deep-dive and momentum follow (B4/B5).
export const BRIEF_TYPES = ["overview", "comparison", "category", "momentum"] as const;
export type BriefType = (typeof BRIEF_TYPES)[number];

// Selector metadata for the UI. `available` gates the types not yet implemented so the control can
// show the full family while only the wired ones are selectable.
export const BRIEF_TYPE_META: Record<
  BriefType,
  { label: string; description: string; available: boolean }
> = {
  overview: { label: "Suburb overview", description: "Where one suburb stands and what to do.", available: true },
  comparison: { label: "Comparison", description: "Two or three suburbs, head to head.", available: true },
  category: { label: "Category deep-dive", description: "Best and worst suburbs for one category.", available: false },
  momentum: { label: "Momentum", description: "Biggest movers and emerging themes.", available: false },
};

// The overview brief's content shape (the first member of the family). generateObject is constrained
// to this schema, so the model returns a structured, predictable object that the PDF and the briefs
// page can both consume without parsing prose. Descriptions double as instructions to the model.
export const overviewContentSchema = z.object({
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

export type OverviewContent = z.infer<typeof overviewContentSchema>;

// The comparison brief's content shape (the second member). Drafted from two or three suburbs'
// figures, it commits to a verdict and says who leads on what. Same constrained-generation contract
// as the overview.
export const comparisonContentSchema = z.object({
  headline: z.string().describe("A sharp line capturing the head-to-head between the suburbs."),
  lede: z
    .string()
    .describe("One opening sentence that names the suburbs and the key contrast, weaving in a figure."),
  verdict: z
    .string()
    .describe(
      "Two to three decisive sentences: which suburb comes out ahead overall, and why. Cite the satisfaction figures.",
    ),
  executiveSummary: z
    .string()
    .describe("A full paragraph, four to six sentences, comparing the suburbs on the figures that matter."),
  whereEachLeads: z
    .array(
      z.object({
        dimension: z.string().describe("A theme or metric, for example Service, Value or Satisfaction."),
        leader: z.string().describe("The suburb that leads on this dimension, named exactly as provided."),
        detail: z.string().describe("One sentence citing the figures behind this lead."),
      }),
    )
    .min(3)
    .max(5)
    .describe("Who leads on what, each tied to numbers from the data."),
  decisiveGaps: z
    .array(z.string())
    .max(4)
    .describe("The biggest, most decision-relevant differences between the suburbs."),
  perSuburb: z
    .array(
      z.object({
        areaName: z.string().describe("The suburb name, exactly as provided."),
        standing: z.string().describe("One sentence on where this suburb stands relative to the others."),
        recommendation: z.string().describe("One concrete, specific recommendation for this suburb."),
      }),
    )
    .min(2)
    .max(3)
    .describe("A standing and a recommendation for each suburb."),
});
export type ComparisonContent = z.infer<typeof comparisonContentSchema>;

// One suburb's factual column in a comparison, straight from the data.
export type ComparisonSuburb = {
  areaName: string;
  satisfaction100: number;
  avgRating: number;
  totalReviews: number;
  positivePct: number;
  negativePct: number;
  neutralPct: number;
  riskTier: RiskTier;
  trend: { date: string; value: number }[];
  topStrength: { label: string; pct: number } | null;
  topWeakness: { label: string; pct: number } | null;
};

// The factual header for a comparison brief: the suburbs being compared and their columns.
export type ComparisonMeta = {
  areaNames: string[];
  category: string;
  period: string;
  suburbs: ComparisonSuburb[];
};

// Until each type defines its own content shape, BriefContent is the overview shape (the page list
// only renders the overview headline inline). B5 may widen this into a discriminated union.
export type BriefContent = OverviewContent;

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
