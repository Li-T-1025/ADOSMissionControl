/**
 * @module atlas/viewer-types
 * @description The Atlas World Model viewer registry. The operator switches
 * between viewers on the same world (a `viewer` parameter, module 03/06); we
 * ship the set and prune later (Rule 46). Rerun is the first-class default world
 * viewer + live-stream surface; gsplat plays photoreal gaussian splats (the one
 * thing Rerun does not render natively); the cloud viewer renders a dense point
 * cloud (`.ply`) on the repo's own three.js. The LOD viewer is the cloud viewer
 * that survives very large clouds — it decimates a multi-million-point `.ply` to
 * a point budget (a single-level voxel-grid pass) so the retained buffer never
 * exhausts memory, the gap the plain cloud viewer has. The Cesium viewer places
 * the reconstructed cloud on the geo globe at its PLY-header geographic origin
 * (a neutral default + an honest badge when the header carries no origin). The
 * historical Potree blocker (its loader pins an older three.js, so the package
 * cannot be added) is sidestepped by loading the PLY with the repo's three 0.183
 * directly; true out-of-core octree streaming for clouds that don't fit in memory
 * at all stays a follow-on.
 * @license GPL-3.0-only
 */

/** A selectable World Model viewer. */
export type AtlasViewer = "rerun" | "splat" | "cloud" | "lod" | "cesium";

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
  { id: "lod", label: "LOD" },
  { id: "cesium", label: "Geo" },
];

export const DEFAULT_ATLAS_VIEWER: AtlasViewer = ATLAS_VIEWERS[0].id;
