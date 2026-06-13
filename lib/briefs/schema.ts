import { z } from "zod";

// The shape of a generated brief. generateObject is constrained to this schema, so the model
// returns a structured, predictable object that the PDF renderer and the briefs page can both
// consume without parsing prose. Descriptions double as instructions to the model.

export const briefContentSchema = z.object({
  headline: z
    .string()
    .describe("A single sharp line summarising the suburb's sentiment this period, for the top of the brief."),
  executiveSummary: z
    .string()
    .describe(
      "Two to three sentences a busy executive can read in ten seconds. State the headline satisfaction figure and the direction of travel.",
    ),
  keyFindings: z
    .array(
      z.object({
        title: z.string().describe("A short finding title."),
        detail: z.string().describe("One or two sentences that cite a figure from the data."),
      }),
    )
    .min(2)
    .max(4)
    .describe("The most important findings, each tied to a number from the data."),
  whatIsWorking: z.array(z.string()).max(4).describe("Themes reviewers consistently praise."),
  whatNeedsAttention: z.array(z.string()).max(4).describe("Themes reviewers consistently criticise."),
  recommendedActions: z
    .array(z.string())
    .min(2)
    .max(4)
    .describe("Concrete, practical next steps that follow from the findings."),
});

export type BriefContent = z.infer<typeof briefContentSchema>;

// The factual header the PDF prints alongside the drafted narrative. These come straight from the
// data, not the model, so the figures on the brief are always the real ones.
export type BriefMeta = {
  areaName: string;
  category: string;
  period: string;
  satisfaction100: number;
  avgRating: number;
  totalReviews: number;
  positivePct: number;
  negativePct: number;
};
