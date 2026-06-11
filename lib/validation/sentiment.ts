import { z } from "zod";

// One validation module shared by the REST routes, the server components and the AI tools.
// Keeping the schemas here (rather than inline per route) means the dashboard, the API and
// the assistant all enforce the same contract, so the model can't call a tool with arguments
// the API would have rejected.

// Loose filter shape: every field is optional. Used where the caller may supply a partial
// selection (e.g. the dashboard URL) and the service fills in defaults.
export const sentimentFilterSchema = z.object({
  aggType: z.string().min(1).optional(),
  areaName: z.string().min(1).optional(),
  category: z.string().min(1).optional(),
  date: z.string().min(1).optional(),
});

// Strict filter shape: a fully-resolved selection that identifies one record. Category is
// optional: when absent the selection targets the suburb-level overall aggregate (every category
// rolled together) rather than a single category.
export const requiredSentimentFilterSchema = z.object({
  aggType: z.string().min(1),
  areaName: z.string().min(1),
  category: z.string().min(1).optional(),
  date: z.string().min(1),
});

// Comparison needs two areas pinned to the same category and date.
export const comparisonSchema = z.object({
  aggType: z.string().min(1),
  baseAreaName: z.string().min(1),
  comparisonAreaName: z.string().min(1),
  category: z.string().min(1),
  date: z.string().min(1),
});

export type RequiredSentimentFilters = z.infer<typeof requiredSentimentFilterSchema>;
export type ComparisonInput = z.infer<typeof comparisonSchema>;

// Bridge from a URL query string to a validated filter object. API routes and the
// dashboard read filters from the URL, so this is the single place that translation and
// validation happen.
export function filtersFromSearchParams(searchParams: URLSearchParams) {
  return sentimentFilterSchema.parse({
    aggType: searchParams.get("aggType") ?? undefined,
    areaName: searchParams.get("areaName") ?? undefined,
    category: searchParams.get("category") ?? undefined,
    date: searchParams.get("date") ?? undefined,
  });
}
