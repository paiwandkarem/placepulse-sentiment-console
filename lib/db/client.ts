import "server-only";
import { neon, type NeonQueryFunction } from "@neondatabase/serverless";

type Sql = NeonQueryFunction<false, false>;

let client: Sql | undefined;

// Resolve the Neon client (and validate DATABASE_URL) lazily, on first query.
// Doing this at import time would throw during `next build` page-data collection
// in environments without DATABASE_URL (e.g. CI), even though no query runs there.
function getClient(): Sql {
  if (!client) {
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
      throw new Error(
        "DATABASE_URL is not set. Connect Neon through Vercel Marketplace and run `vercel env pull .env.local`.",
      );
    }
    client = neon(databaseUrl);
  }
  return client;
}

// A lazy proxy so callers keep the exact same API: tagged-template calls
// (sql`...`) hit the apply trap, and methods (sql.query, sql.transaction, ...)
// hit the get trap. The underlying client is created once, on first use.
export const sql = new Proxy(function () {} as unknown as Sql, {
  apply(_target, _thisArg, args: Parameters<Sql>) {
    return (getClient() as (...a: Parameters<Sql>) => unknown)(...args);
  },
  get(_target, prop) {
    const c = getClient();
    const value = Reflect.get(c as object, prop);
    return typeof value === "function" ? value.bind(c) : value;
  },
}) as Sql;
