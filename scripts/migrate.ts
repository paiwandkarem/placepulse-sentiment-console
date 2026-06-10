import { readFileSync } from "node:fs";
import { join } from "node:path";
import { sql } from "../lib/db/client";

async function main() {
  const schema = readFileSync(join(process.cwd(), "lib/db/schema.sql"), "utf8");
  await sql.unsafe(schema);
  console.log("Database schema applied successfully.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
}).finally(async () => {
  await sql.end();
});