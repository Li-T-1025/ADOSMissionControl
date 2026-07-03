/**
 * @module lib/atlas/reconstruction-quality
 * @description Human-intuitive "detail level" presets for a gaussian-splat
 * reconstruction. The one real quality knob the Brush trainer exposes is the
 * training-step count (more steps → sharper, slower; an under-trained splat is a
 * fuzzy blob). We do NOT expose SH degree / input resolution because they are not
 * wired as Brush CLI flags — presenting them would be a fake control (Rule 44).
 *
 * The operator picks a level (Draft / Standard / High / Maximum) on the drone
 * tab where a reconstruction is commissioned; the choice maps to a step count
 * that rides the reconstruct job's `params.steps` (honored per-job by the compute
 * node). `qualityForSteps` decodes an existing job's step count back to the
 * nearest level so a finished artifact can be labelled with its detail level.
 * @license GPL-3.0-only
 */

export type ReconstructionQualityId = "draft" | "standard" | "high" | "maximum";

export interface ReconstructionQuality {
  id: ReconstructionQualityId;
  /** Brush training iterations for this level. */
  steps: number;
  /** Display order, coarsest → finest. */
  order: number;
  /** i18n key (under `atlas.reconstructQuality`) for the short label. */
  labelKey: string;
  /** i18n key for the one-line description. */
  descKey: string;
}

/** The detail levels, coarsest → finest. */
export const RECONSTRUCTION_QUALITIES: readonly ReconstructionQuality[] = [
  {
    id: "draft",
    steps: 7000,
    order: 0,
    labelKey: "reconstructQuality.draftLabel",
    descKey: "reconstructQuality.draftDesc",
  },
  {
    id: "standard",
    steps: 15000,
    order: 1,
    labelKey: "reconstructQuality.standardLabel",
    descKey: "reconstructQuality.standardDesc",
  },
  {
    id: "high",
    steps: 30000,
    order: 2,
    labelKey: "reconstructQuality.highLabel",
    descKey: "reconstructQuality.highDesc",
  },
  {
    id: "maximum",
    steps: 50000,
    order: 3,
    labelKey: "reconstructQuality.maximumLabel",
    descKey: "reconstructQuality.maximumDesc",
  },
];

/** The recommended default (the Brush / 3DGS full-quality baseline). */
export const DEFAULT_QUALITY_ID: ReconstructionQualityId = "high";

/** The default step count (the `high` level). Used when a drone has no persisted
 * `reconstruct_steps` yet. */
export const DEFAULT_RECONSTRUCTION_STEPS = 30000;

/** The preset for an id (defaults to `high` for an unknown id). */
export function qualityById(id: string): ReconstructionQuality {
  return (
    RECONSTRUCTION_QUALITIES.find((q) => q.id === id) ??
    RECONSTRUCTION_QUALITIES.find((q) => q.id === DEFAULT_QUALITY_ID)!
  );
}

/** The step count for a preset id. */
export function stepsForQuality(id: string): number {
  return qualityById(id).steps;
}

/**
 * The nearest preset for an arbitrary step count — used to LABEL an existing
 * job whose `params.steps` may not exactly equal a preset (an older 7k job, a
 * hand-submitted custom count). Nearest by absolute distance; ties favour the
 * finer level.
 */
export function qualityForSteps(steps: number): ReconstructionQuality {
  let best = RECONSTRUCTION_QUALITIES[0];
  let bestDist = Math.abs(steps - best.steps);
  for (const q of RECONSTRUCTION_QUALITIES) {
    const d = Math.abs(steps - q.steps);
    if (d < bestDist || (d === bestDist && q.steps > best.steps)) {
      best = q;
      bestDist = d;
    }
  }
  return best;
}
