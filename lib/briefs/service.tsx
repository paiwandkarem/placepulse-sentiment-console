import "server-only";
import dayjs from "dayjs";
import { generateObject } from "ai";
import { put } from "@vercel/blob";
import { renderToBuffer } from "@react-pdf/renderer";
import { model } from "@/lib/ai/model";
import { aggTypeForCategory } from "@/lib/filters";
import { getSentimentDashboardContext } from "@/lib/services/sentimentService";
import { briefContentSchema, type BriefMeta } from "./schema";
import { BriefDocument } from "./document";
import { completeBriefJob, failBriefJob } from "./repository";

// End to end generation of one brief: gather the same grounded context the dashboard uses, draft the
// narrative with a schema-constrained model call, render the PDF, store it in Blob, and mark the job
// complete. Any failure flips the job to failed with a message rather than throwing, because this
// runs after the response has been sent.

type Ctx = NonNullable<Awaited<ReturnType<typeof getSentimentDashboardContext>>>;

const BRIEF_SYSTEM_PROMPT = `You are a sentiment analyst writing a short executive brief about one Queensland suburb, for a council, tourism or precinct team.

Rules:
- Use only the figures and themes in the data provided. Never invent a number, theme, suburb or business.
- Be specific and cite figures, for example "satisfaction 71 out of 100 across 1,240 reviews".
- Write in plain, professional language with no hyphenated dashes and no filler.
- Recommendations must follow from the findings, not generic advice.`;

function round(value: number, digits = 0): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function buildMeta(ctx: Ctx): BriefMeta {
  const record = ctx.record;
  return {
    areaName: record.areaName,
    category: ctx.filters.category ?? "overall",
    period: dayjs(ctx.filters.date).format("MMMM YYYY"),
    satisfaction100: round(record.overallSatisfaction100),
    avgRating: record.avgRating,
    totalReviews: record.totalReviews,
    positivePct: round(record.positivePct),
    negativePct: round(record.negativePct),
  };
}

// Flatten the context into a compact, figure-led prompt. The model drafts only from this text.
function buildDigest(ctx: Ctx): string {
  const record = ctx.record;
  const working = ctx.drivers
    .filter((driver) => driver.uiBucket === "working")
    .slice(0, 6)
    .map((driver) => `${driver.label} (${round(driver.positivePct)}% positive across ${driver.reviews} reviews)`);
  const notWorking = ctx.drivers
    .filter((driver) => driver.uiBucket === "not_working")
    .slice(0, 6)
    .map((driver) => `${driver.label} (${round(driver.negativePct)}% negative across ${driver.reviews} reviews)`);

  let trendLine = "Not enough history for a trend.";
  if (ctx.trend.length >= 2) {
    const latest = ctx.trend[ctx.trend.length - 1];
    const priorIndex = Math.max(0, ctx.trend.length - 13);
    const prior = ctx.trend[priorIndex];
    const delta = round(latest.overallSatisfaction100 - prior.overallSatisfaction100, 1);
    const months = ctx.trend.length - 1 - priorIndex;
    trendLine = `Satisfaction is ${delta >= 0 ? "up" : "down"} ${Math.abs(delta)} points over the last ${months} months, from ${round(prior.overallSatisfaction100)} to ${round(latest.overallSatisfaction100)}.`;
  }

  return [
    `Suburb: ${record.areaName}`,
    `Category: ${ctx.filters.category ?? "all categories (overall)"}`,
    `Period: ${dayjs(ctx.filters.date).format("MMMM YYYY")}`,
    "",
    "Headline figures:",
    `- Satisfaction: ${round(record.overallSatisfaction100)} out of 100`,
    `- Average star rating: ${record.avgRating} out of 5`,
    `- Total reviews: ${record.totalReviews}`,
    `- Sentiment split: ${round(record.positivePct)}% positive, ${round(record.negativePct)}% negative, ${round(record.neutralPct)}% neutral`,
    "",
    `Trend: ${trendLine}`,
    "",
    `Themes working well: ${working.length ? working.join("; ") : "none stand out"}`,
    `Themes needing attention: ${notWorking.length ? notWorking.join("; ") : "none stand out"}`,
  ].join("\n");
}

export async function runBriefJob(
  jobId: string,
  filters: { areaName: string; category?: string },
): Promise<void> {
  try {
    const ctx = await getSentimentDashboardContext({
      areaName: filters.areaName,
      category: filters.category,
      aggType: aggTypeForCategory(filters.category),
    });
    if (!ctx) {
      await failBriefJob({ id: jobId, error: `No sentiment data for ${filters.areaName}.` });
      return;
    }

    const { object: content } = await generateObject({
      model: model("brief"),
      schema: briefContentSchema,
      system: BRIEF_SYSTEM_PROMPT,
      prompt: `Write the brief from this data.\n\n${buildDigest(ctx)}`,
    });

    const buffer = await renderToBuffer(<BriefDocument content={content} meta={buildMeta(ctx)} />);
    const blob = await put(`briefs/${jobId}.pdf`, buffer, {
      access: "public",
      contentType: "application/pdf",
    });

    await completeBriefJob({ id: jobId, content: JSON.stringify(content), pdfBlobUrl: blob.url });
  } catch (error) {
    await failBriefJob({
      id: jobId,
      error: error instanceof Error ? error.message : "Brief generation failed.",
    });
  }
}
