/**
 * @module node-detail/surfaces
 * @description The profile -> surface registry. Maps each agent profile to its
 * ordered surface list and resolves the visible set for a node (capability /
 * role filtered). Unknown or future profiles fall back to the Agent page so the
 * panel never renders empty.
 * @license GPL-3.0-only
 */

import type { NodeProfile, SurfaceContext, SurfaceSpec } from "./surface-types";
import { DRONE_SURFACES } from "./surfaces/drone";
import { GROUND_STATION_SURFACES } from "./surfaces/ground-station";
import { WORKSTATION_SURFACES } from "./surfaces/workstation";
import { AGENT_SURFACE } from "./agent/agent-surface";

const PROFILE_SURFACES: Record<NodeProfile, SurfaceSpec[]> = {
  drone: DRONE_SURFACES,
  "ground-station": GROUND_STATION_SURFACES,
  workstation: WORKSTATION_SURFACES,
};

/** The ordered, capability/role-filtered surface list for the selected node.
 * Unknown / future profiles get just the Agent page. */
export function resolveSurfaces(ctx: SurfaceContext): SurfaceSpec[] {
  const profile = (ctx.drone.profile ?? "drone") as NodeProfile;
  const base = PROFILE_SURFACES[profile] ?? [AGENT_SURFACE];
  return base.filter((s) => (s.when ? s.when(ctx) : true));
}
