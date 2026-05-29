/**
 * @module DroneDetailTabs
 * @description Tab descriptors for the per-drone detail panel.
 *
 * The static-tab strip is fixed at compile time; the radio + vision tabs
 * are rendered conditionally on per-drone capability; plugin-contributed
 * tabs are rendered by the DroneDetailTabHost shipped from the plugin
 * host. This module owns only the static + conditional identifiers and the
 * membership helper shared by both the strip renderer and the fall-back
 * logic in the panel.
 *
 * @license GPL-3.0-only
 */

export const STATIC_TAB_IDS = [
  "overview",
  "flights",
  "calibrate",
  "parameters",
  "configure",
] as const;

export const RADIO_TAB_ID = "radio" as const;

/** Conditional tab shown when the drone advertises the vision engine. */
export const VISION_TAB_ID = "vision" as const;

export type DroneDetailTab =
  | (typeof STATIC_TAB_IDS)[number]
  | typeof RADIO_TAB_ID
  | typeof VISION_TAB_ID;

/**
 * True when `id` is one of the compiled-in static tabs or a conditional
 * tab (radio, vision). Used by the panel to decide whether an active-tab
 * string is known to the host (vs being a plugin-contributed tab id, vs
 * being stale after a plugin disable).
 */
export function isStaticTab(id: string): boolean {
  return (
    (STATIC_TAB_IDS as readonly string[]).includes(id) ||
    id === RADIO_TAB_ID ||
    id === VISION_TAB_ID
  );
}
