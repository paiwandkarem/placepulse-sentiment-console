import "server-only";
import { sql } from "@/lib/db/client";

// The only place that reads and writes brief_jobs. A brief moves through running, then completed or
// failed. The drafted content is stored as JSON text and the rendered PDF lives in Blob, with its
// URL recorded here so the briefs page can link to a stored copy rather than regenerating.

export type BriefStatus = "running" | "completed" | "failed";

export type BriefJob = {
  id: string;
  status: BriefStatus;
  title: string;
  filters: { areaName: string; category: string | null };
  content: string | null;
  pdfBlobUrl: string | null;
  error: string | null;
  createdAt: string;
  pdfGeneratedAt: string | null;
};

type DbRow = Record<string, unknown>;

function toBriefJob(row: DbRow): BriefJob {
  return {
    id: String(row.id),
    status: row.status as BriefStatus,
    title: String(row.title),
    filters: (row.filters as BriefJob["filters"]) ?? { areaName: "", category: null },
    content: (row.content as string | null) ?? null,
    pdfBlobUrl: (row.pdf_blob_url as string | null) ?? null,
    error: (row.error as string | null) ?? null,
    createdAt: String(row.created_at),
    pdfGeneratedAt: (row.pdf_generated_at as string | null) ?? null,
  };
}

export async function createBriefJob(input: {
  id: string;
  title: string;
  filters: { areaName: string; category: string | null };
}): Promise<void> {
  await sql`
    insert into brief_jobs (id, status, title, filters)
    values (${input.id}, 'running', ${input.title}, ${JSON.stringify(input.filters)}::jsonb)
  `;
}

export async function completeBriefJob(input: {
  id: string;
  content: string;
  pdfBlobUrl: string;
}): Promise<void> {
  await sql`
    update brief_jobs
    set status = 'completed', content = ${input.content}, pdf_blob_url = ${input.pdfBlobUrl},
        pdf_generated_at = now(), updated_at = now()
    where id = ${input.id}
  `;
}

export async function failBriefJob(input: { id: string; error: string }): Promise<void> {
  await sql`
    update brief_jobs
    set status = 'failed', error = ${input.error}, updated_at = now()
    where id = ${input.id}
  `;
}

export async function listBriefJobs(limit = 20): Promise<BriefJob[]> {
  const rows = (await sql`
    select id, status, title, filters, content, pdf_blob_url, error, created_at, pdf_generated_at
    from brief_jobs
    order by created_at desc
    limit ${limit}
  `) as DbRow[];
  return rows.map(toBriefJob);
}

export async function getBriefJob(id: string): Promise<BriefJob | null> {
  const rows = (await sql`
    select id, status, title, filters, content, pdf_blob_url, error, created_at, pdf_generated_at
    from brief_jobs
    where id = ${id}
    limit 1
  `) as DbRow[];
  return rows[0] ? toBriefJob(rows[0]) : null;
}
