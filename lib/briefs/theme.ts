import "server-only";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { Font } from "@react-pdf/renderer";

// Visual language for the brief PDF. The layout follows an editorial intelligence-brief style (cover,
// KPI cards, risk badge, theme table, customer quotes, page footers), rendered in the app's own
// brand: Plus Jakarta Sans for display and body, JetBrains Mono for tabular numerics, and the
// emerald / slate / rose sentiment palette. Font registration is best effort: if the files cannot be
// found the brief still renders in the built-in faces rather than failing.

// @react-pdf loads local font paths with fontkit.open (the Node reader). A data URI would route
// through fontkit.create on a Uint8Array, which does not work in Node, so paths are the correct form.
function fontPath(file: string): string | null {
  try {
    const path = fileURLToPath(new URL(`./fonts/${file}`, import.meta.url));
    return existsSync(path) ? path : null;
  } catch {
    return null;
  }
}

function registerFamily(family: string, files: { file: string; weight: number }[]): boolean {
  const sources = files
    .map(({ file, weight }) => ({ src: fontPath(file), fontWeight: weight }))
    .filter((source): source is { src: string; fontWeight: number } => Boolean(source.src));
  if (sources.length !== files.length) return false;
  // We ship no italic cut. @react-pdf throws on an unresolved italic style ("Could not resolve font
  // for Jakarta, fontWeight 400, fontStyle italic") rather than synthesising one, which fails the
  // whole PDF. Registering each weight again as italic against the same upright file means an italic
  // style renders upright instead of crashing — robust against any stray fontStyle: "italic".
  const withItalic: { src: string; fontWeight: number; fontStyle?: "italic" }[] = sources.flatMap(
    (source) => [source, { ...source, fontStyle: "italic" }],
  );
  Font.register({ family, fonts: withItalic });
  return true;
}

const SANS_READY = registerFamily("Jakarta", [
  { file: "PlusJakartaSans-Regular.ttf", weight: 400 },
  { file: "PlusJakartaSans-SemiBold.ttf", weight: 600 },
  { file: "PlusJakartaSans-Bold.ttf", weight: 700 },
]);

// Never hyphenate. react-pdf's default callback breaks words and figures mid-token at a line end
// ("Broad-beach", "28-%"), which reads badly in the narrow comparison columns and the cover title.
// Returning the whole word means lines wrap only at spaces.
Font.registerHyphenationCallback((word) => [word]);

// The platform is Plus Jakarta Sans only, so the brief uses it everywhere. FONT_MONO is kept as a
// name for numeric styles but points at the same family, so numerics no longer clash with the app.
export const FONT_SANS = SANS_READY ? "Jakarta" : "Helvetica";
export const FONT_MONO = FONT_SANS;

// Editorial palette: warm paper and ink like the reference brief, but the app's emerald / slate /
// rose for sentiment, so the document reads as PlacePulse.
export const PALETTE = {
  ink: "#0b1220", // primary text
  graphite: "#1f2937",
  slate: "#475569",
  muted: "#64748b",
  faint: "#94a3b8",
  hairline: "#e5e7eb",
  paper: "#fbfaf7", // warm off-white page
  cream: "#f5f1ea",
  brand: "#047857", // emerald-700, our accent
  brandSoft: "#d1fae5", // emerald-100
  positive: "#10b981", // emerald-500
  neutral: "#94a3b8", // slate-400
  negative: "#e11d48", // rose-600
  negativeSoft: "#ffe4e6", // rose-100
  amber: "#d97706",
  amberSoft: "#fef3c7",
  // Year hues for the year-on-year bars, matching SentimentOverTimeChart (newest year emerald).
  years: ["#f59e0b", "#6366f1", "#10b981"],
} as const;

// Risk tiers, computed from the 0 to 100 satisfaction score (deterministic, never the model).
export type RiskTier = "critical" | "elevated" | "watch" | "healthy";

export function riskTierFor(satisfaction100: number): RiskTier {
  if (satisfaction100 < 40) return "critical";
  if (satisfaction100 < 55) return "elevated";
  if (satisfaction100 < 70) return "watch";
  return "healthy";
}

export const RISK_STYLE: Record<RiskTier, { label: string; color: string; soft: string }> = {
  critical: { label: "Critical", color: PALETTE.negative, soft: PALETTE.negativeSoft },
  elevated: { label: "Elevated", color: PALETTE.negative, soft: PALETTE.negativeSoft },
  watch: { label: "Watch", color: PALETTE.amber, soft: PALETTE.amberSoft },
  healthy: { label: "Healthy", color: PALETTE.brand, soft: PALETTE.brandSoft },
};
