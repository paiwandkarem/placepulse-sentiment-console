import "server-only";
import dayjs from "dayjs";
import { generateObject } from "ai";
import { put } from "@vercel/blob";
import { renderToBuffer } from "@react-pdf/renderer";
import { model } from "@/lib/ai/model";
import { aggTypeForCategory } from "@/lib/filters";
import { getCategoryRanking, getSentimentDashboardContext } from "@/lib/services/sentimentService";
import {
  categoryContentSchema,
  comparisonContentSchema,
  momentumContentSchema,
  overviewContentSchema,
  type BriefChartData,
  type BriefKeywords,
  type BriefMeta,
  type BriefQuote,
  type BriefThemeRow,
  type CategoryMeta,
  type CategoryRankRow,
  type ComparisonMeta,
  type ComparisonSuburb,
  type MomentumMeta,
  type MomentumMove,
} from "./schema";
import { BriefDocument } from "./document";
import { ComparisonDocument } from "./document-comparison";
import { CategoryDocument } from "./document-category";
import { MomentumDocument } from "./document-momentum";
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
        schema: overviewContentSchema,
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

// ---- Comparison brief (B4): two or three suburbs, head to head ----

const COMPARISON_SYSTEM_PROMPT = `You are a sentiment analyst writing a head-to-head comparison brief about two or three Queensland suburbs, for a council, tourism or precinct team.

Voice: decisive and specific. Commit to which suburb leads overall and why, rather than hedging.

Rules:
- Use only the figures and themes in the data provided. Never invent a number, theme, suburb or business.
- Refer to each suburb by the exact name provided.
- Cite figures, for example "satisfaction 74 out of 100 versus 68".
- Write in plain, professional language with no hyphenated dashes and no filler.
- whereEachLeads must name a real leader per dimension, and perSuburb must give one concrete recommendation for each suburb.`;

// One suburb's factual column, derived from its dashboard context (the same source the suburb panel
// uses), including its standout strength and weakness from the theme drivers.
function buildComparisonSuburb(ctx: Ctx): ComparisonSuburb {
  const record = ctx.record;
  const working = [...ctx.drivers].filter((driver) => driver.uiBucket === "working").sort((a, b) => b.positivePct - a.positivePct);
  const notWorking = [...ctx.drivers].filter((driver) => driver.uiBucket === "not_working").sort((a, b) => b.negativePct - a.negativePct);
  return {
    areaName: record.areaName,
    satisfaction100: round(record.overallSatisfaction100),
    avgRating: record.avgRating,
    totalReviews: record.totalReviews,
    positivePct: round(record.positivePct),
    negativePct: round(record.negativePct),
    neutralPct: round(record.neutralPct),
    riskTier: riskTierFor(record.overallSatisfaction100),
    trend: ctx.trend.slice(-13).map((point) => ({ date: point.date, value: round(point.overallSatisfaction100) })),
    topStrength: working[0] ? { label: working[0].label, pct: round(working[0].positivePct) } : null,
    topWeakness: notWorking[0] ? { label: notWorking[0].label, pct: round(notWorking[0].negativePct) } : null,
  };
}

function buildComparisonDigest(suburbs: ComparisonSuburb[], category: string): string {
  const lines: string[] = [`Comparing ${suburbs.length} Queensland suburbs for: ${category}.`, ""];
  suburbs.forEach((suburb) => {
    lines.push(`${suburb.areaName}:`);
    lines.push(`- Satisfaction: ${suburb.satisfaction100} out of 100 (${RISK_STYLE[suburb.riskTier].label})`);
    lines.push(`- Average star rating: ${suburb.avgRating} out of 5, across ${suburb.totalReviews} reviews`);
    lines.push(`- Sentiment split: ${suburb.positivePct}% positive, ${suburb.negativePct}% negative, ${suburb.neutralPct}% neutral`);
    if (suburb.topStrength) lines.push(`- Strongest theme: ${suburb.topStrength.label} (${suburb.topStrength.pct}% positive)`);
    if (suburb.topWeakness) lines.push(`- Weakest theme: ${suburb.topWeakness.label} (${suburb.topWeakness.pct}% negative)`);
    lines.push("");
  });
  return lines.join("\n");
}

export async function runComparisonBriefJob(
  jobId: string,
  input: { areaNames: string[]; category?: string },
): Promise<void> {
  try {
    const contexts = await Promise.all(
      input.areaNames.map((areaName) =>
        getSentimentDashboardContext({
          areaName,
          category: input.category,
          aggType: aggTypeForCategory(input.category),
        }),
      ),
    );
    const valid = contexts.filter((ctx): ctx is Ctx => Boolean(ctx));
    if (valid.length < 2) {
      await failBriefJob({ id: jobId, error: "Need at least two suburbs with data to compare." });
      return;
    }

    const suburbs = valid.map(buildComparisonSuburb);
    const meta: ComparisonMeta = {
      areaNames: suburbs.map((suburb) => suburb.areaName),
      category: input.category ?? "overall",
      period: dayjs(valid[0].filters.date).format("MMMM YYYY"),
      suburbs,
    };
    const categoryLabel = input.category ?? "all categories (overall)";

    const { object: content } = await generateObject({
      model: model("brief"),
      schema: comparisonContentSchema,
      system: COMPARISON_SYSTEM_PROMPT,
      prompt: `Write the comparison from this data.\n\n${buildComparisonDigest(suburbs, categoryLabel)}`,
    });

    const buffer = await renderToBuffer(<ComparisonDocument content={content} meta={meta} />);
    const blob = await put(`briefs/${jobId}.pdf`, buffer, { access: "public", contentType: "application/pdf" });
    await completeBriefJob({ id: jobId, content: JSON.stringify(content), pdfBlobUrl: blob.url });
  } catch (error) {
    await failBriefJob({
      id: jobId,
      error: error instanceof Error ? error.message : "Comparison brief generation failed.",
    });
  }
}

// ---- Category deep-dive brief (B5): one category ranked across Queensland suburbs ----

const CATEGORY_SYSTEM_PROMPT = `You are a sentiment analyst writing a category deep-dive brief about how one business category performs across Queensland suburbs, for a council, tourism or precinct team.

Voice: decisive and specific. Commit to which suburbs lead the category and which lag, and why.

Rules:
- Use only the figures and suburbs in the data provided. Never invent a number, suburb or business.
- Refer to suburbs by the exact names provided.
- Cite figures, for example "Noosa Heads leads at 84 out of 100".
- Write in plain, professional language with no hyphenated dashes and no filler.
- recommendedActions must follow from the ranking, each concrete with an owner, threshold or timeframe.`;

function buildCategoryMeta(category: string, date: string | null, suburbs: CategoryRankRow[]): CategoryMeta {
  // Half each end, capped at 6, floored so the top and bottom lists never overlap (for an odd count
  // the middle suburb is simply omitted from both).
  const n = Math.min(6, Math.floor(suburbs.length / 2));
  return {
    category,
    period: date ? dayjs(date).format("MMMM YYYY") : "latest",
    suburbCount: suburbs.length,
    topSuburbs: suburbs.slice(0, n),
    bottomSuburbs: suburbs.slice(-n).reverse(),
  };
}

function buildCategoryDigest(meta: CategoryMeta): string {
  const line = (row: CategoryRankRow) =>
    `${row.areaName}: ${round(row.satisfaction100)} out of 100 (${round(row.positivePct)}% positive, ${row.totalReviews} reviews)`;
  return [
    `Category: ${meta.category}`,
    `Period: ${meta.period}`,
    `Suburbs ranked (with at least a minimum review base): ${meta.suburbCount}`,
    "",
    "Top suburbs for this category:",
    ...meta.topSuburbs.map((row, index) => `${index + 1}. ${line(row)}`),
    "",
    "Lowest-ranked suburbs for this category:",
    ...meta.bottomSuburbs.map((row, index) => `${index + 1}. ${line(row)}`),
  ].join("\n");
}

export async function runCategoryBriefJob(jobId: string, input: { category: string }): Promise<void> {
  try {
    const { date, suburbs } = await getCategoryRanking(input.category);
    if (suburbs.length < 3) {
      await failBriefJob({ id: jobId, error: `Not enough suburbs have data for ${input.category} to rank.` });
      return;
    }
    const meta = buildCategoryMeta(input.category, date, suburbs);
    const { object: content } = await generateObject({
      model: model("brief"),
      schema: categoryContentSchema,
      system: CATEGORY_SYSTEM_PROMPT,
      prompt: `Write the category deep-dive from this data.\n\n${buildCategoryDigest(meta)}`,
    });

    const buffer = await renderToBuffer(<CategoryDocument content={content} meta={meta} />);
    const blob = await put(`briefs/${jobId}.pdf`, buffer, { access: "public", contentType: "application/pdf" });
    await completeBriefJob({ id: jobId, content: JSON.stringify(content), pdfBlobUrl: blob.url });
  } catch (error) {
    await failBriefJob({ id: jobId, error: error instanceof Error ? error.message : "Category brief generation failed." });
  }
}

// ---- Momentum brief (B5): one suburb's year-on-year movement ----

const MOMENTUM_SYSTEM_PROMPT = `You are a sentiment analyst writing a momentum brief about how one Queensland suburb's sentiment has changed over the past year, for a council, tourism or precinct team.

Voice: decisive and specific. Commit to whether the suburb is improving or declining, and by how much.

Rules:
- Use only the figures and themes in the data provided. Never invent a number, theme, suburb or business.
- Cite figures, for example "satisfaction up 4 points year on year" or "service up 6 points".
- Write in plain, professional language with no hyphenated dashes and no filler.
- risers and fallers must name themes from the data, and recommendedActions must follow from them.`;

function buildMomentumMeta(ctx: Ctx): MomentumMeta {
  const record = ctx.record;
  // Year-on-year satisfaction: the latest trend point against roughly twelve months earlier.
  let satisfactionDeltaPp: number | null = null;
  if (ctx.trend.length >= 13) {
    const latest = ctx.trend[ctx.trend.length - 1].overallSatisfaction100;
    const prior = ctx.trend[ctx.trend.length - 13].overallSatisfaction100;
    satisfactionDeltaPp = round(latest - prior, 1);
  }

  const withYoy = ctx.drivers.filter((driver) => driver.hasYoy && driver.positivePctDelta != null);
  const toMove = (driver: (typeof withYoy)[number]): MomentumMove => ({
    label: driver.label,
    nowPct: round(driver.positivePct),
    deltaPp: round(driver.positivePctDelta ?? 0, 1),
  });
  const risers = [...withYoy]
    .filter((driver) => (driver.positivePctDelta ?? 0) > 1)
    .sort((a, b) => (b.positivePctDelta ?? 0) - (a.positivePctDelta ?? 0))
    .slice(0, 4)
    .map(toMove);
  const fallers = [...withYoy]
    .filter((driver) => (driver.positivePctDelta ?? 0) < -1)
    .sort((a, b) => (a.positivePctDelta ?? 0) - (b.positivePctDelta ?? 0))
    .slice(0, 4)
    .map(toMove);

  return {
    areaName: record.areaName,
    category: ctx.filters.category ?? "overall",
    period: dayjs(ctx.filters.date).format("MMMM YYYY"),
    satisfaction100: round(record.overallSatisfaction100),
    satisfactionDeltaPp,
    avgRating: record.avgRating,
    totalReviews: record.totalReviews,
    trend: ctx.trend.slice(-25).map((point) => ({ date: point.date, value: round(point.overallSatisfaction100) })),
    risers,
    fallers,
  };
}

function buildMomentumDigest(meta: MomentumMeta): string {
  const move = (entry: MomentumMove) => `${entry.label}: ${entry.deltaPp >= 0 ? "+" : ""}${entry.deltaPp}pp (now ${entry.nowPct}% positive)`;
  return [
    `Suburb: ${meta.areaName}`,
    `Category: ${meta.category}`,
    `Period: ${meta.period}`,
    `Satisfaction now: ${meta.satisfaction100} out of 100`,
    meta.satisfactionDeltaPp == null
      ? "Year-on-year satisfaction change: not enough history"
      : `Year-on-year satisfaction change: ${meta.satisfactionDeltaPp >= 0 ? "+" : ""}${meta.satisfactionDeltaPp} points`,
    "",
    `Themes rising (positive share up year on year): ${meta.risers.length ? meta.risers.map(move).join("; ") : "none stand out"}`,
    `Themes falling (positive share down year on year): ${meta.fallers.length ? meta.fallers.map(move).join("; ") : "none stand out"}`,
  ].join("\n");
}

export async function runMomentumBriefJob(jobId: string, input: { areaName: string; category?: string }): Promise<void> {
  try {
    const ctx = await getSentimentDashboardContext({
      areaName: input.areaName,
      category: input.category,
      aggType: aggTypeForCategory(input.category),
    });
    if (!ctx) {
      await failBriefJob({ id: jobId, error: `No sentiment data for ${input.areaName}.` });
      return;
    }
    const meta = buildMomentumMeta(ctx);
    const { object: content } = await generateObject({
      model: model("brief"),
      schema: momentumContentSchema,
      system: MOMENTUM_SYSTEM_PROMPT,
      prompt: `Write the momentum brief from this data.\n\n${buildMomentumDigest(meta)}`,
    });

    const buffer = await renderToBuffer(<MomentumDocument content={content} meta={meta} />);
    const blob = await put(`briefs/${jobId}.pdf`, buffer, { access: "public", contentType: "application/pdf" });
    await completeBriefJob({ id: jobId, content: JSON.stringify(content), pdfBlobUrl: blob.url });
  } catch (error) {
    await failBriefJob({ id: jobId, error: error instanceof Error ? error.message : "Momentum brief generation failed." });
  }
}
