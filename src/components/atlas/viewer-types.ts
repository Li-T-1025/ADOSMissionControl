/**
 * @module atlas/viewer-types
 * @description The Atlas World Model viewer registry. The operator switches
 * between viewers on the same world (a `viewer` parameter, module 03/06); we
 * ship the set and prune later (Rule 46). Rerun is the first-class default world
 * viewer + live-stream surface; gsplat plays photoreal gaussian splats (the one
 * thing Rerun does not render natively); the cloud viewer renders a dense point
 * cloud (`.ply`) on the repo's own three.js. Cesium (geo-anchor) is a follow-on
 * (built, but geo-anchoring is its own feature). The historical Potree blocker
 * (its loader pins an older three.js, so the package cannot be added) is sidestepped
 * by the cloud viewer loading the PLY with the repo's three 0.183 directly;
 * Potree-style octree LOD streaming for very large clouds stays a follow-on.
 * @license GPL-3.0-only
 */

/** A selectable World Model viewer. */
export type AtlasViewer = "rerun" | "splat" | "cloud";

export interface AtlasViewerSpec {
  id: AtlasViewer;
  /** Short switcher label. */
  label: string;
}

/** The viewers offered in the switcher, in order; the first is the default. */
export const ATLAS_VIEWERS: readonly AtlasViewerSpec[] = [
  { id: "rerun", label: "World" },
  { id: "splat", label: "Splat" },
  { id: "cloud", label: "Cloud" },
];

export const DEFAULT_ATLAS_VIEWER: AtlasViewer = ATLAS_VIEWERS[0].id;
