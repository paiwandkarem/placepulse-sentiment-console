import type { ExpressionSpecification } from "mapbox-gl";

// One shared map configuration so the dashboard suburb picker and the Places explorer read as a
// single product: the same clean basemap, the same emerald colour language, the same hover card,
// and the same loading / error copy. Client-safe (constants and pure helpers only).

// The clean, muted basemap on both maps, so the emerald suburb fills and place markers stand out
// rather than competing with coloured roads and POI labels.
export const MAP_STYLE = "mapbox://styles/mapbox/light-v11";

export const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

export function hasMapToken(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_MAPBOX_TOKEN);
}

// Emerald scale for the suburb choropleth and place markers, plus a near-black accent for the
// active / selected suburb (the same "selected = near-black" emphasis used across the app shell).
export const MAP_COLORS = {
  fill: "#10b981", // emerald-500: base suburb fill / cluster
  hover: "#047857", // emerald-700: hovered suburb / place point
  line: "#065f46", // emerald-800: suburb border
  selectedLine: "#111827", // gray-900: active suburb border
  point: "#047857", // emerald-700: place point
  cluster: "#10b981", // emerald-500: cluster bubble
} as const;

// Dashboard choropleth paint. Hover and selection recolour on the GPU via feature-state, so the
// fill updates with no data churn no matter how many polygons are drawn.
export const SUBURB_FILL_COLOR: ExpressionSpecification = [
  "case",
  ["boolean", ["feature-state", "hover"], false],
  MAP_COLORS.hover,
  ["boolean", ["feature-state", "selected"], false],
  MAP_COLORS.hover,
  MAP_COLORS.fill,
];

export const SUBURB_FILL_OPACITY: ExpressionSpecification = [
  "case",
  ["boolean", ["feature-state", "selected"], false],
  0.75,
  ["boolean", ["feature-state", "hover"], false],
  0.7,
  0.5,
];

export const SUBURB_LINE_COLOR: ExpressionSpecification = [
  "case",
  ["boolean", ["feature-state", "selected"], false],
  MAP_COLORS.selectedLine,
  MAP_COLORS.line,
];

export const SUBURB_LINE_WIDTH: ExpressionSpecification = [
  "case",
  ["boolean", ["feature-state", "selected"], false],
  2.5,
  1,
];

// Choropleth fill for the briefs category map: each suburb shaded by its satisfaction for the chosen
// category, set per feature via feature-state "score". Suburbs with no score (not ranked) stay a
// neutral grey. The scale spans the compressed satisfaction range these scores actually occupy.
export const CHOROPLETH_FILL_COLOR: ExpressionSpecification = [
  "case",
  ["<", ["coalesce", ["feature-state", "score"], -1], 0],
  "#e5e7eb",
  [
    "interpolate",
    ["linear"],
    ["coalesce", ["feature-state", "score"], 0],
    50,
    "#e11d48",
    62,
    "#f59e0b",
    72,
    "#10b981",
    82,
    "#047857",
  ],
];

export const CHOROPLETH_FILL_OPACITY = 0.72;

// Places explorer context layers. There the suburb polygons are navigation context, not the focus,
// so they fade as you zoom in and the place points take over; the selected suburb keeps the same
// near-black border the briefs map uses, at full strength. Shared here so the maps read as one
// product rather than each defining its own expressions.
// Fill: a selected suburb is clearly highlighted (emerald-700 + the near-black border) but kept
// translucent at 0.45 — lighter than the briefs map's 0.75 — so the streets and place points inside
// it stay readable, which matters here because Places is an explorer you look *into*. Hover a touch;
// otherwise a light constant tint so the suburb reads as an overlay without washing out the points.
export const PLACES_SUBURB_FILL_OPACITY: ExpressionSpecification = [
  "case",
  ["boolean", ["feature-state", "selected"], false],
  0.45,
  ["boolean", ["feature-state", "hover"], false],
  0.28,
  0.12,
];
export const PLACES_SUBURB_LINE_COLOR: ExpressionSpecification = [
  "case",
  ["boolean", ["feature-state", "selected"], false],
  MAP_COLORS.selectedLine,
  MAP_COLORS.line,
];
// Lines stay clearly visible at every zoom (a navigation grid), not faded away — so the suburb
// overlay reads like the dashboard and briefs maps. Selected is the heavier near-black border.
export const PLACES_SUBURB_LINE_OPACITY: ExpressionSpecification = [
  "case",
  ["boolean", ["feature-state", "selected"], false],
  1,
  0.55,
];
export const PLACES_SUBURB_LINE_WIDTH: ExpressionSpecification = [
  "case",
  ["boolean", ["feature-state", "selected"], false],
  2.5,
  0.9,
];

// The selected place marker ring: a place's equivalent of the selected-suburb border, the same
// near-black accent at a consistent weight.
export const SELECTED_PLACE_RING = {
  radius: 9,
  strokeWidth: 3,
  strokeColor: MAP_COLORS.selectedLine,
} as const;

// Shared status copy so both maps say the same thing in the same state.
export const MAP_STATUS_COPY = {
  loading: "Loading map",
  error: "Map unavailable",
  noToken: "Map token not configured",
} as const;

export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => {
    const map: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };
    return map[char] ?? char;
  });
}

// One hover-card markup for both maps (Plus Jakarta Sans, matching the popup chrome styled in
// globals.css). `title` is escaped here; `subtitle` and `body` are caller-controlled HTML and must
// be pre-escaped by the caller.
export function popupCard({ title, subtitle, body }: { title: string; subtitle?: string; body?: string }): string {
  return `<div style="font-family:'Plus Jakarta Sans',ui-sans-serif,system-ui,sans-serif;min-width:150px;max-width:220px">
    <div style="font-weight:600;font-size:12px;color:#111827;line-height:1.3">${escapeHtml(title)}</div>
    ${subtitle ? `<div style="font-size:11px;color:#6b7280;margin-top:2px">${subtitle}</div>` : ""}
    ${body ? `<div style="font-size:11px;color:#374151;margin-top:5px">${body}</div>` : ""}
  </div>`;
}
