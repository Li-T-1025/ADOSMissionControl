/**
 * @module node-detail/surfaces/universal
 * @description Companion-computer surfaces shared by every agent profile:
 * the agent overview, System, Black Box, and Plugins. They render live when
 * the node has a paired agent and as lock-badged teasers otherwise (an
 * FC-only drone). A drone gets the agent overview as a distinct landing;
 * ground-station and compute nodes use their own overview, so they omit it.
 * @license GPL-3.0-only
 */

import { AgentOverviewTab } from "@/components/command/AgentOverviewTab";
import { SystemTab } from "@/components/command/SystemTab";
import { BlackBoxTab } from "@/components/command/BlackBoxTab";
import { PluginsTab } from "@/components/command/PluginsTab";
import type { SurfaceSpec, SurfaceContext } from "../surface-types";

const lockedWhenNoAgent = (ctx: SurfaceContext) => ctx.showLockedTabs;

export const AGENT_OVERVIEW_SURFACE: SurfaceSpec = {
  id: "agent",
  labelKey: "dronePanel.agent",
  locked: lockedWhenNoAgent,
  render: () => <AgentOverviewTab />,
};

export const SYSTEM_SURFACE: SurfaceSpec = {
  id: "system",
  labelKey: "dronePanel.system",
  locked: lockedWhenNoAgent,
  render: () => <SystemTab />,
};

export const BLACKBOX_SURFACE: SurfaceSpec = {
  id: "blackbox",
  labelKey: "dronePanel.blackbox",
  locked: lockedWhenNoAgent,
  render: () => <BlackBoxTab />,
};

export const PLUGINS_SURFACE: SurfaceSpec = {
  id: "plugins",
  labelKey: "dronePanel.plugins",
  locked: lockedWhenNoAgent,
  render: () => <PluginsTab />,
};

/** Drone companion strip: agent landing + System + Black Box + Plugins. */
export const DRONE_UNIVERSAL_SURFACES: SurfaceSpec[] = [
  AGENT_OVERVIEW_SURFACE,
  SYSTEM_SURFACE,
  BLACKBOX_SURFACE,
  PLUGINS_SURFACE,
];

/** Non-drone companion strip (own overview already present): System + Black
 * Box + Plugins. Also the fallback set for unknown / future profiles. */
export const NODE_UNIVERSAL_SURFACES: SurfaceSpec[] = [
  SYSTEM_SURFACE,
  BLACKBOX_SURFACE,
  PLUGINS_SURFACE,
];
