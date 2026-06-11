// Builds the static suburb-boundary file the map loads. Following the in-house map, we serve one
// pre-built GeoJSON of the whole country (every suburb that exists in our dataset, tagged with
// our canonical area name) rather than re-deriving it through a function on every request.
//
// The boundaries are kept at near-full detail: only a tiny tolerance (to drop points the eye
// can't see) and 5-decimal coordinates (~1 m). The result is served as a static asset, so its
// size isn't constrained by serverless response limits, and the CDN gzips it.
//
// Run: node --env-file-if-exists=.env.local scripts/build-suburb-boundaries.mjs

import { neon } from "@neondatabase/serverless";
import * as turf from "@turf/turf";
import { mkdirSync, writeFileSync } from "node:fs";

const DATABASE_URL = process.env.DATABASE_URL;
const BOUNDARY_URL = process.env.SUBURB_BOUNDARY_GEOJSON_URL;
if (!DATABASE_URL) throw new Error("DATABASE_URL is not set");
if (!BOUNDARY_URL) throw new Error("SUBURB_BOUNDARY_GEOJSON_URL is not set");

const sql = neon(DATABASE_URL);

// Match a boundary feature's name to our canonical area name: drop the "(NSW)" style suffix,
// lowercase, strip punctuation/spaces.
const normalise = (name) =>
  name
    .toLowerCase()
    .replace(/\(.*?\)/g, "")
    .replace(/[^a-z0-9]/g, "")
    .trim();

console.log("reading area names from Neon...");
const areaRows = await sql`select distinct area_name from sentiment_suburbs where area_name is not null`;
const wanted = new Map(areaRows.map((r) => [normalise(r.area_name), r.area_name]));
console.log(`  ${wanted.size} areas`);

console.log("fetching boundary file...");
const all = await fetch(BOUNDARY_URL).then((r) => r.json());
console.log(`  ${all.features?.length ?? 0} source features`);

// Include EVERY suburb so the map has no holes, exactly like the in-house map. For suburbs that
// exist in our dataset, tag the canonical area name (so a click filters the dashboard); for the
// rest, keep the boundary file's own name and mark hasData=false (clicking one just shows the
// "no data" state). The suburb name lives in SAL_NAME21.
const features = [];
for (const feature of all.features ?? []) {
  const salName = feature.properties?.SAL_NAME21;
  if (typeof salName !== "string" || !salName) continue;
  const canonical = wanted.get(normalise(salName));
  let shaped = {
    type: "Feature",
    geometry: feature.geometry,
    properties: { areaName: canonical ?? salName, hasData: Boolean(canonical) },
  };
  try {
    // Near-lossless: a tiny tolerance removes only sub-pixel points; precision 5 is ~1 m.
    shaped = turf.simplify(shaped, { tolerance: 0.0005, highQuality: false, mutate: true });
    shaped = turf.truncate(shaped, { precision: 5, coordinates: 2, mutate: true });
  } catch {
    // keep the original geometry if turf can't reshape it
  }
  features.push(shaped);
}

mkdirSync("public", { recursive: true });
writeFileSync("public/au-suburbs.geojson", JSON.stringify({ type: "FeatureCollection", features }));
const mb = (Buffer.byteLength(JSON.stringify({ type: "FeatureCollection", features })) / 1048576).toFixed(1);
console.log(`wrote public/au-suburbs.geojson: ${features.length} features, ${mb} MB`);
