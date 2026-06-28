/**
 * @module atlas/viewer-types
 * @description The Atlas World Model viewer registry. The operator switches
 * between viewers on the same world (a `viewer` parameter, module 03/06); we
 * ship the set and prune later (Rule 46). Rerun is the first-class default world
 * viewer + live-stream surface; gsplat plays photoreal gaussian splats (the one
 * thing Rerun does not render natively). Cesium (geo-anchor) and Potree (dense
 * LOD cloud) are follow-on registry entries — Cesium is built but geo-anchoring
 * is its own feature, and Potree's loader pins an older three.js.
 * @license GPL-3.0-only
 */

/** A selectable World Model viewer. */
export type AtlasViewer = "rerun" | "splat";

export interface AtlasViewerSpec {
  id: AtlasViewer;
  /** Short switcher label. */
  label: string;
}

/** The viewers offered in the switcher, in order; the first is the default. */
export const ATLAS_VIEWERS: readonly AtlasViewerSpec[] = [
  { id: "rerun", label: "World" },
  { id: "splat", label: "Splat" },
];

export const DEFAULT_ATLAS_VIEWER: AtlasViewer = ATLAS_VIEWERS[0].id;
