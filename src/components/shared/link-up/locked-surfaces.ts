/**
 * @module link-up/locked-surfaces
 * @description Ids for the agent-only surfaces a flight-controller drone gains
 * once a companion computer is paired. Two lists: the curated set shown as
 * lock-badged tabs on an FC-only drone (kept short for progressive disclosure),
 * and the extra capabilities listed inside the "locked" placeholder. Ids only,
 * no icon component references at module scope; the placeholder maps id to icon
 * at render time. Copy lives under the `linkUp.surface.<id>` i18n keys.
 * @license GPL-3.0-only
 */

/** Curated agent surfaces shown as lock-badged tabs on an FC-only drone. */
export const LOCKED_AGENT_TAB_IDS = [
  "video",
  "vision",
  "scripts",
  "plugins",
] as const;

/** Extra capabilities listed inside the locked placeholder, not as tabs. */
export const LOCKED_VALUE_PROP_IDS = [
  "system",
  "peripherals",
  "radio",
  "cellular",
] as const;

export type LockedSurfaceId =
  | (typeof LOCKED_AGENT_TAB_IDS)[number]
  | (typeof LOCKED_VALUE_PROP_IDS)[number];

const LOCKED_TAB_SET: ReadonlySet<string> = new Set(LOCKED_AGENT_TAB_IDS);

/** True when `id` is one of the curated locked agent-surface tab ids. */
export function isLockedAgentTab(id: string): boolean {
  return LOCKED_TAB_SET.has(id);
}
