import { after } from "next/server";
import { nanoid } from "nanoid";
import { z } from "zod";
import { auth } from "@clerk/nextjs/server";
import { createBriefJob, listBriefJobs } from "@/lib/briefs/repository";
import { runBriefJob, runCategoryBriefJob, runComparisonBriefJob, runMomentumBriefJob } from "@/lib/briefs/service";
import { BRIEF_TYPES } from "@/lib/briefs/schema";
import { rateLimit } from "@/lib/ratelimit";

// Brief generation is slow (a schema-constrained model draft plus a PDF render), so it runs after
// the response via after(): the POST records the job and returns its id immediately, and the work
// completes in the background, flipping the job row to completed or failed. The briefs page polls
// the list (GET) for status. This is the durable shape the architecture calls for, rather than
// holding the request open until the PDF is ready.
export const maxDuration = 120;

// The brief request: a type, one to three suburbs (overview uses the first), and an optional
// category. areaNames is the general shape; comparison (B4) will use more than one.
const bodySchema = z.object({
  type: z.enum(BRIEF_TYPES).default("overview"),
  areaNames: z.array(z.string().min(1)).max(3).default([]),
  category: z.string().min(1).optional(),
});

export async function POST(request: Request): Promise<Response> {
  const { userId } = await auth();
  if (!userId) {
    return new Response("Sign in to generate a brief.", { status: 401 });
  }

  const result = rateLimit("briefs:" + userId, { limit: 10, windowMs: 3600000 });
  if (!result.success) {
    return new Response("Brief limit reached. Try again later.", {
      status: 429,
      headers: { "Retry-After": String(result.retryAfterSeconds) },
    });
  }

  const json = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return new Response("Request body must include a type and at least one suburb.", { status: 400 });
  }

  const { type, areaNames, category } = parsed.data;
  const id = nanoid();

  if (type === "comparison") {
    const suburbs = [...new Set(areaNames)];
    if (suburbs.length < 2) {
      return new Response("Pick at least two distinct suburbs to compare.", { status: 400 });
    }
    const title = `${suburbs.join(" vs ")}${category ? `: ${category}` : ""} comparison`;
    await createBriefJob({ id, userId, type, title, filters: { areaNames: suburbs, category: category ?? null } });
    after(() => runComparisonBriefJob(id, { areaNames: suburbs, category }));
    return Response.json({ id, status: "running", title }, { status: 202 });
  }

  if (type === "category") {
    if (!category) {
      return new Response("Pick a category for the deep-dive.", { status: 400 });
    }
    const title = `${category}: Queensland category deep-dive`;
    await createBriefJob({ id, userId, type, title, filters: { category } });
    after(() => runCategoryBriefJob(id, { category }));
    return Response.json({ id, status: "running", title }, { status: 202 });
  }

  // overview and momentum both work from a single suburb (plus an optional category).
  const areaName = areaNames[0];
  if (!areaName) {
    return new Response("Pick a Queensland suburb.", { status: 400 });
  }

  if (type === "momentum") {
    const title = `${areaName}${category ? `: ${category}` : ""} momentum`;
    await createBriefJob({ id, userId, type, title, filters: { areaName, category: category ?? null } });
    after(() => runMomentumBriefJob(id, { areaName, category }));
    return Response.json({ id, status: "running", title }, { status: 202 });
  }

  const title = category ? `${areaName}: ${category} sentiment brief` : `${areaName} sentiment brief`;
  await createBriefJob({ id, userId, type, title, filters: { areaName, category: category ?? null } });
  after(() => runBriefJob(id, { areaName, category }));

  return Response.json({ id, status: "running", title }, { status: 202 });
}

export async function GET(): Promise<Response> {
  const { userId } = await auth();
  if (!userId) {
    return new Response("Sign in to view briefs.", { status: 401 });
  }
  const briefs = await listBriefJobs(userId);
  return Response.json({ briefs });
}
