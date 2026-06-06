/**
 * @module node-detail/surface-types
 * @description Contract for the profile-driven node-detail surface registry.
 * A "surface" is one tab in the unified node-detail panel; the registry maps
 * each agent profile to an ordered list of surfaces and the panel resolves +
 * renders them. Built-in surfaces and plugin-contributed tabs share this
 * descriptor shape, so adding a profile or a surface is a declarative change.
 * @license GPL-3.0-only
 */

import type { ReactNode } from "react";
import type { FleetDrone } from "@/lib/types";
import type { AgentRole } from "@/stores/agent-capabilities/types";

export type NodeProfile = "drone" | "ground-station" | "compute";

/** Everything a surface's `when` / `render` may need, derived once per
 * render from the selected node + the focused agent's capabilities. */
export interface SurfaceContext {
  droneId: string;
  drone: FleetDrone;
  displayName: string;
  isConnected: boolean;
  agentDeviceId: string | null;
  fcLinking: boolean;
  radioPresent: boolean;
  visionPresent: boolean;
  role: AgentRole;
  /** Companion surfaces render as lock-badged teasers when the node has no
   * paired agent (a flight-controller-only drone). */
  showLockedTabs: boolean;
}

export interface SurfaceSpec {
  /** Tab id; also the aria + active-tab key. Unique within a profile. */
  id: string;
  /** Full i18n path resolved by the panel via a namespace-less
   * useTranslations(), so a surface can reuse any existing key. */
  labelKey: string;
  /** Availability gate (capability / role / connection). Absent = always. */
  when?: (ctx: SurfaceContext) => boolean;
  /** When true the tab shows a lock badge and the panel renders the link-up
   * teaser instead of the body. Absent = never locked. */
  locked?: (ctx: SurfaceContext) => boolean;
  /** Body renderer. Returns an existing surface component. */
  render: (ctx: SurfaceContext) => ReactNode;
}
