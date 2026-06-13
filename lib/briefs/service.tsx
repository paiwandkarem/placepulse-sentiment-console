import "server-only";
import dayjs from "dayjs";
import { generateObject } from "ai";
import { put } from "@vercel/blob";
import { renderToBuffer } from "@react-pdf/renderer";
import { model } from "@/lib/ai/model";
import { aggTypeForCategory } from "@/lib/filters";
import { getSentimentDashboardContext } from "@/lib/services/sentimentService";
import { briefContentSchema, type BriefChartData, type BriefKeywords, type BriefMeta, type BriefQuote, type BriefThemeRow } from "./schema";
import { BriefDocument } from "./document";
import { fetchSuburbMapDataUri } from "./map";
import { RISK_STYLE, riskTierFor } from "./theme";
import { completeBriefJob, failBriefJob } from "./repository";

// End to end generation of one brief: gather the same grounded context the dashboard uses, draft the
// narrative with a schema-constrained model call, render the editorial PDF, store it in Blob, and
// mark the job complete. Any failure flips the job to failed with a message rather than throwing,
// because this runs after the response has been sent.

type Ctx = NonNullable<Awaited<ReturnType<typeof getSentimentDashboardContext>>>;

const BRIEF_SYSTEM_PROMPT = `You are a sentiment analyst writing an executive intelligence brief about one Queensland suburb, for a council, tourism or precinct team.

Voice: decisive, specific and operator-grade, the way an analyst briefs a leader who has two minutes. Commit to a verdict rather than hedging.

Rules:
- Use only the figures and themes in the data provided. Never invent a number, theme, suburb or business.
- Cite figures, for example "satisfaction 71 out of 100 across 1,240 reviews".
- Write in plain, professional language with no hyphenated dashes and no filler.
- Recommendations must follow from the findings, and each must be concrete: name what to do, and add a specific owner, threshold or timeframe.`;

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
    neutralPct: round(record.neutralPct),
    themesTracked: ctx.drivers.length,
    riskTier: riskTierFor(record.overallSatisfaction100),
  };
}

function buildCharts(ctx: Ctx): BriefChartData {
  const record = ctx.record;
  return {
    // Up to three years of monthly points so the year-on-year bars have full series to group.
    trend: ctx.trend.slice(-36).map((point) => ({ date: point.date, value: round(point.overallSatisfaction100) })),
    distribution: {
      positive: round(record.positivePct),
      negative: round(record.negativePct),
      neutral: round(record.neutralPct),
    },
  };
}

// The theme table, top themes by review volume, with real positive and negative counts.
function buildThemeRows(ctx: Ctx): BriefThemeRow[] {
  const rows = [...ctx.drivers].sort((a, b) => b.reviews - a.reviews).slice(0, 8);
  const maxReviews = Math.max(1, ...rows.map((row) => row.reviews));
  return rows.map((driver, index) => ({
    label: driver.label,
    reviews: driver.reviews,
    sentiment100: round(driver.positivePct),
    positiveCount: driver.positiveReviews,
    negativeCount: driver.negativeReviews,
    rank: index + 1,
    volumePct: round((driver.reviews / maxReviews) * 100),
  }));
}

// Real review quotes, chosen to be relatable: weighted toward those that mention a top theme, so the
// voice on the page lines up with the themes the brief is discussing. Negatives first (most
// actionable), then positives.
function buildQuotes(ctx: Ctx): BriefQuote[] {
  const groups = ctx.record.topReviews;
  const themeWords = new Set(
    ctx.drivers
      .slice(0, 8)
      .flatMap((driver) => driver.label.toLowerCase().split(/[^a-z]+/).filter((word) => word.length > 3)),
  );
  const relevance = (text: string): number => {
    const lower = text.toLowerCase();
    let score = 0;
    themeWords.forEach((word) => {
      if (lower.includes(word)) score += 1;
    });
    return score;
  };
  const pick = (list: typeof groups.positive, count: number): BriefQuote[] =>
    list
      .filter((review) => review.text && review.text.trim().length > 24)
      .map((review) => ({ review, score: relevance(review.text) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, count)
      .map(({ review }) => ({
        text: review.text.trim().slice(0, 320),
        rating: review.rating ?? null,
        sentiment: review.sentiment,
        sentiment100: review.sentiment100 ?? null,
      }));
  return [...pick(groups.negative, 2), ...pick(groups.positive, 2)];
}

// The suburb's most frequent positive and negative terms, used to colour-code those words wherever
// they appear in the prose and quotes.
function buildKeywords(ctx: Ctx): BriefKeywords {
  const wordCloud = ctx.record.wordCloud;
  const terms = (list: typeof wordCloud.positive): string[] =>
    list
      .map((entry) => entry.term)
      .filter((term) => term && term.trim().length > 2)
      .slice(0, 14);
  return { positive: terms(wordCloud.positive), negative: terms(wordCloud.negative) };
}

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
    `Risk status (from the satisfaction score): ${RISK_STYLE[riskTierFor(record.overallSatisfaction100)].label}`,
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

    // Draft the prose and fetch the suburb map in parallel; the map is best effort and resolves to
    // null on any failure, so it never blocks or fails the brief.
    const [{ object: content }, mapDataUri] = await Promise.all([
      generateObject({
        model: model("brief"),
        schema: briefContentSchema,
        system: BRIEF_SYSTEM_PROMPT,
        prompt: `Write the brief from this data.\n\n${buildDigest(ctx)}`,
      }),
      fetchSuburbMapDataUri(ctx.record.areaName),
    ]);

    const buffer = await renderToBuffer(
      <BriefDocument
        content={content}
        meta={buildMeta(ctx)}
        charts={buildCharts(ctx)}
        themeRows={buildThemeRows(ctx)}
        quotes={buildQuotes(ctx)}
        keywords={buildKeywords(ctx)}
        mapDataUri={mapDataUri}
      />,
    );

    const blob = await put(`briefs/${jobId}.pdf`, buffer, { access: "public", contentType: "application/pdf" });
    await completeBriefJob({ id: jobId, content: JSON.stringify(content), pdfBlobUrl: blob.url });
  } catch (error) {
    await failBriefJob({
      id: jobId,
      error: error instanceof Error ? error.message : "Brief generation failed.",
    });
  }
}
