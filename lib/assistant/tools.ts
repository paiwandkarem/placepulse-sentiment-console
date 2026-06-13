import "server-only";
import { tool } from "ai";
import { z } from "zod";
import { aggTypeForCategory } from "@/lib/filters";
import {
  getSentimentDashboardContext,
  getSentimentTrend,
  listAvailableFilters,
} from "@/lib/services/sentimentService";
import { placeDetail, placeThemes, placesInSuburb, reviewEvidence } from "@/lib/repositories/poiRepository";

// The tools the assistant can call. Every one is a read against the same service and repository
// layers the dashboard uses, so the model can only surface numbers that already exist in Neon. It
// cannot write SQL and cannot reach the database any other way. Inputs are zod-validated with the
// same contract the REST routes enforce, so a malformed tool call is rejected before it runs.
//
// Two tiers of coverage:
//   - Suburb tools: sentiment, trend, drivers, category breakdown, comparison.
//   - Place tools: individual businesses, their themes, and real review quotes.

const round = (value: number, digits = 1): number => {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
};

const SUBURB = z.string().min(1).describe("Suburb name, for example 'Bondi' or 'Fortitude Valley'.");
const CATEGORY = z
  .string()
  .min(1)
  .optional()
  .describe("Business category to narrow to, for example 'Cafe'. Omit for the suburb's overall sentiment across all categories.");

export const assistantTools = {
  listSuburbs: tool({
    description:
      "List available suburbs. Use this to resolve or disambiguate a suburb name before calling another tool when you are unsure of the exact spelling.",
    inputSchema: z.object({
      prefix: z.string().optional().describe("Only return suburbs starting with this text."),
      limit: z.number().int().min(1).max(50).default(20),
    }),
    execute: async ({ prefix, limit }) => {
      const { areaNames } = await listAvailableFilters();
      const matches = prefix
        ? areaNames.filter((name) => name.toLowerCase().startsWith(prefix.toLowerCase()))
        : areaNames;
      return { suburbs: matches.slice(0, limit), total: matches.length };
    },
  }),

  suburbSentiment: tool({
    description:
      "Overall sentiment for a suburb at the latest month: satisfaction score out of 100, average star rating, review volume and the positive/negative/neutral split. Pass a category to narrow to one business type.",
    inputSchema: z.object({ suburb: SUBURB, category: CATEGORY }),
    execute: async ({ suburb, category }) => {
      const ctx = await getSentimentDashboardContext({
        areaName: suburb,
        category,
        aggType: aggTypeForCategory(category),
      });
      if (!ctx) return { found: false, suburb, category: category ?? null };
      const record = ctx.record;
      return {
        found: true,
        suburb: record.areaName,
        category: category ?? "overall",
        date: ctx.filters.date,
        overallSatisfaction100: round(record.overallSatisfaction100),
        avgRating: round(record.avgRating, 2),
        totalReviews: record.totalReviews,
        positivePct: round(record.positivePct),
        negativePct: round(record.negativePct),
        neutralPct: round(record.neutralPct),
      };
    },
  }),

  sentimentTrend: tool({
    description:
      "Monthly satisfaction trend over time for a suburb. Use for questions about whether a suburb is improving or declining.",
    inputSchema: z.object({ suburb: SUBURB, category: CATEGORY }),
    execute: async ({ suburb, category }) => {
      const trend = await getSentimentTrend({ areaName: suburb, category, aggType: aggTypeForCategory(category) });
      return {
        suburb,
        category: category ?? "overall",
        points: trend.map((point) => ({
          date: point.date,
          satisfaction100: round(point.overallSatisfaction100),
          totalReviews: point.totalReviews,
        })),
      };
    },
  }),

  sentimentDrivers: tool({
    description:
      "The themes driving a suburb's sentiment: what is working and what is not, ranked, with the year-on-year change in each. Use for questions about what is driving positive or negative sentiment.",
    inputSchema: z.object({ suburb: SUBURB, category: CATEGORY, limit: z.number().int().min(1).max(12).default(6) }),
    execute: async ({ suburb, category, limit }) => {
      const ctx = await getSentimentDashboardContext({
        areaName: suburb,
        category,
        aggType: aggTypeForCategory(category),
      });
      if (!ctx) return { found: false, suburb };
      const pick = (bucket: "working" | "not_working") =>
        ctx.drivers
          .filter((driver) => driver.uiBucket === bucket)
          .slice(0, limit)
          .map((driver) => ({
            theme: driver.label,
            positivePct: round(driver.positivePct),
            negativePct: round(driver.negativePct),
            reviews: driver.reviews,
            yoyNegativeDelta: driver.hasYoy ? round(driver.negativePctDelta ?? 0) : null,
          }));
      return { found: true, suburb: ctx.record.areaName, date: ctx.filters.date, working: pick("working"), notWorking: pick("not_working") };
    },
  }),

  categoryBreakdown: tool({
    description:
      "Sentiment for every business category in a suburb at the latest month. Use for questions about which categories create the most friction or perform best.",
    inputSchema: z.object({ suburb: SUBURB }),
    execute: async ({ suburb }) => {
      const ctx = await getSentimentDashboardContext({ areaName: suburb, aggType: aggTypeForCategory(undefined) });
      if (!ctx) return { found: false, suburb };
      return {
        found: true,
        suburb: ctx.record.areaName,
        date: ctx.filters.date,
        categories: ctx.categoryBreakdown.map((entry) => ({
          category: entry.category,
          satisfaction100: round(entry.overallSatisfaction100),
          totalReviews: entry.totalReviews,
          positivePct: round(entry.positivePct),
          negativePct: round(entry.negativePct),
        })),
      };
    },
  }),

  compareSuburbs: tool({
    description:
      "Compare two suburbs head to head: each one's satisfaction, rating, review volume and sentiment split, plus the gap between them. Optionally narrow to one category.",
    inputSchema: z.object({ suburbA: z.string().min(1), suburbB: z.string().min(1), category: CATEGORY }),
    execute: async ({ suburbA, suburbB, category }) => {
      const aggType = aggTypeForCategory(category);
      const [a, b] = await Promise.all([
        getSentimentDashboardContext({ areaName: suburbA, category, aggType }),
        getSentimentDashboardContext({ areaName: suburbB, category, aggType }),
      ]);
      if (!a || !b) return { found: false, missing: !a ? suburbA : suburbB };
      const summarise = (record: NonNullable<typeof a>["record"], date: string) => ({
        suburb: record.areaName,
        date,
        overallSatisfaction100: round(record.overallSatisfaction100),
        avgRating: round(record.avgRating, 2),
        totalReviews: record.totalReviews,
        positivePct: round(record.positivePct),
        negativePct: round(record.negativePct),
      });
      const left = summarise(a.record, a.filters.date);
      const right = summarise(b.record, b.filters.date);
      return {
        found: true,
        category: category ?? "overall",
        a: left,
        b: right,
        delta: {
          overallSatisfaction100: round(left.overallSatisfaction100 - right.overallSatisfaction100),
          avgRating: round(left.avgRating - right.avgRating, 2),
          positivePct: round(left.positivePct - right.positivePct),
        },
      };
    },
  }),

  placesInSuburb: tool({
    description:
      "Individual businesses in a suburb: the most reviewed or highest rated places, with their rating and review count. Use when the user asks about specific venues, not suburb-level sentiment.",
    inputSchema: z.object({
      suburb: SUBURB,
      sort: z.enum(["reviews", "rating"]).default("reviews"),
      limit: z.number().int().min(1).max(25).default(10),
    }),
    execute: async ({ suburb, sort, limit }) => {
      const places = await placesInSuburb(suburb, { sort, limit });
      return { suburb, count: places.length, places };
    },
  }),

  placeThemes: tool({
    description:
      "The theme breakdown for one business by its place id: each theme's review count and sentiment. Get a place id from placesInSuburb first.",
    inputSchema: z.object({ placeId: z.string().min(1), limit: z.number().int().min(1).max(25).default(10) }),
    execute: async ({ placeId, limit }) => {
      const detail = await placeDetail(placeId);
      if (!detail) return { found: false, placeId };
      const themes = await placeThemes(placeId, limit);
      return { found: true, place: { placeId: detail.placeId, name: detail.name, suburb: detail.suburb }, themes };
    },
  }),

  reviewEvidence: tool({
    description:
      "Real customer review quotes, the evidence behind a sentiment claim. Filter by a place id or a suburb, and optionally by sentiment. Use to support an answer with what people actually wrote.",
    inputSchema: z.object({
      placeId: z.string().min(1).optional(),
      suburb: z.string().min(1).optional(),
      sentiment: z.enum(["positive", "negative", "neutral"]).optional(),
      limit: z.number().int().min(1).max(10).default(5),
    }),
    execute: async ({ placeId, suburb, sentiment, limit }) => {
      if (!placeId && !suburb) return { error: "Provide either a placeId or a suburb to pull review quotes." };
      const quotes = await reviewEvidence({ placeId, suburb, sentiment, limit });
      return { count: quotes.length, quotes };
    },
  }),

  setDashboardFilter: tool({
    description:
      "Change what the dashboard is showing. Use when the user asks to see, open, show, switch or take them to a suburb or a business category on the dashboard. The dashboard updates to match. Pass a category to focus one business type, or omit it for the suburb's overall view. This only changes the view; it does not answer the question on its own.",
    inputSchema: z.object({
      suburb: SUBURB.optional().describe("The suburb to show on the dashboard."),
      category: CATEGORY,
    }),
    execute: async ({ suburb, category }) => {
      if (!suburb && !category) {
        return { applied: false, reason: "Name a suburb or category to show on the dashboard." };
      }

      // Resolve the requested names against the real catalogue so the dashboard is only ever sent a
      // suburb and category that exist. An exact match wins; otherwise fall back to a prefix match.
      const { areaNames, categories } = await listAvailableFilters();

      let areaName: string | undefined;
      if (suburb) {
        const needle = suburb.toLowerCase();
        areaName =
          areaNames.find((name) => name.toLowerCase() === needle) ??
          areaNames.find((name) => name.toLowerCase().startsWith(needle));
        if (!areaName) return { applied: false, reason: `No Queensland suburb matches "${suburb}".` };
      }

      let resolvedCategory: string | undefined;
      if (category) {
        const needle = category.toLowerCase();
        resolvedCategory =
          categories.find((entry) => entry.toLowerCase() === needle) ??
          categories.find((entry) => entry.toLowerCase().startsWith(needle));
        if (!resolvedCategory) return { applied: false, reason: `No category matches "${category}".` };
      }

      // Build the URL on the same contract the dashboard and the filter bar already use, so the view
      // updates through normal navigation rather than a bespoke channel.
      const params = new URLSearchParams();
      if (areaName) params.set("areaName", areaName);
      params.set("aggType", aggTypeForCategory(resolvedCategory));
      if (resolvedCategory) params.set("category", resolvedCategory);

      return {
        applied: true,
        areaName: areaName ?? null,
        category: resolvedCategory ?? "overall",
        url: `/?${params.toString()}`,
      };
    },
  }),
} as const;
