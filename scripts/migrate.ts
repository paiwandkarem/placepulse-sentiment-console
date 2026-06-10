import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { neon } from "@neondatabase/serverless";

// Migrations run under tsx as a plain Node process, outside the Next.js runtime. We
// connect with a local Neon client here rather than importing lib/db/client, which is
// marked "server-only" — Next aliases that module for its bundler, but Node can't resolve
// it, so importing it from a CLI script would blow up at runtime.
const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is not set. Run `vercel env pull .env.local` first.");
}

const sql = neon(databaseUrl);

// Neon's HTTP driver executes a single statement per round trip, so a multi-statement
// file has to be split before sending. Our schema and migrations only ever use plain
// statements terminated by a semicolon — no PL/pgSQL functions or dollar-quoted bodies —
// so splitting on ";" is safe. Revisit this if we ever introduce a function definition.
function splitStatements(sqlText: string): string[] {
  return sqlText
    .split(";")
    .map((statement) => statement.trim())
    .filter((statement) => statement.length > 0);
}

async function applyFile(filePath: string): Promise<void> {
  const contents = readFileSync(filePath, "utf8");

  for (const statement of splitStatements(contents)) {
    await sql.query(statement);
  }
}

// Migration files are ordered by filename (001_, 002_, ...) and applied in sequence after
// the base schema. Each statement is idempotent (create/alter ... if not exists), so a
// re-run is a no-op — there is no separate "applied migrations" ledger by design, which
// keeps the runner trivial for a dataset this size.
async function main(): Promise<void> {
  await applyFile(join(process.cwd(), "lib/db/schema.sql"));

  const migrationsDir = join(process.cwd(), "lib/db/migrations");
  let migrationFiles: string[] = [];

  try {
    migrationFiles = readdirSync(migrationsDir)
      .filter((file) => file.endsWith(".sql"))
      .sort();
  } catch {
    // No migrations directory yet — the base schema is enough.
    migrationFiles = [];
  }

  for (const file of migrationFiles) {
    await applyFile(join(migrationsDir, file));
  }

  console.log(`Migration complete. Base schema applied; ${migrationFiles.length} migration file(s) run.`);
}

main().catch((error: unknown) => {
  console.error("Migration failed:", error);
  process.exitCode = 1;
});
