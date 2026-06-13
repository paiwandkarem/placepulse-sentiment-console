import { after } from "next/server";
import { nanoid } from "nanoid";
import { z } from "zod";
import { createBriefJob, listBriefJobs } from "@/lib/briefs/repository";
import { runBriefJob } from "@/lib/briefs/service";

// Brief generation is slow (a schema-constrained model draft plus a PDF render), so it runs after
// the response via after(): the POST records the job and returns its id immediately, and the work
// completes in the background, flipping the job row to completed or failed. The briefs page polls
// the list (GET) for status. This is the durable shape the architecture calls for, rather than
// holding the request open until the PDF is ready.
export const maxDuration = 120;

const bodySchema = z.object({
  areaName: z.string().min(1),
  category: z.string().min(1).optional(),
});

export async function POST(request: Request): Promise<Response> {
  const json = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return new Response("Request body must include an areaName.", { status: 400 });
  }

  const { areaName, category } = parsed.data;
  const id = nanoid();
  const title = category ? `${areaName}: ${category} sentiment brief` : `${areaName} sentiment brief`;

  await createBriefJob({ id, title, filters: { areaName, category: category ?? null } });
  after(() => runBriefJob(id, { areaName, category }));

  return Response.json({ id, status: "running", title }, { status: 202 });
}

export async function GET(): Promise<Response> {
  const briefs = await listBriefJobs();
  return Response.json({ briefs });
}
