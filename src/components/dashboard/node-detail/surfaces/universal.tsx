/**
 * @module node-detail/surfaces/universal
 * @description Companion-computer surfaces shared by every agent profile,
 * grouped under the "Onboard computer" section: the agent overview (Computer),
 * System (Health), the merged Logs surface, and Plugins (Extensions). They
 * render live when the node has a paired agent and as lock-badged teasers
 * otherwise (an FC-only drone). A drone gets the agent overview as a distinct
 * landing; ground-station and compute nodes use their own overview, so they
 * omit it. The Logs surface is intentionally not locked: its Flights view
 * reads the GCS history store and stays reachable without a paired agent.
 * @license GPL-3.0-only
 */

import { AgentOverviewTab } from "@/components/command/AgentOverviewTab";
import { SystemTab } from "@/components/command/SystemTab";
import { PluginsTab } from "@/components/command/PluginsTab";
import { LogsTab } from "@/components/drone-detail/LogsTab";
import type { SurfaceSpec, SurfaceContext } from "../surface-types";

const ONBOARD_COMPUTER_GROUP = "dronePanel.groups.onboardComputer";

const lockedWhenNoAgent = (ctx: SurfaceContext) => ctx.showLockedTabs;

export const AGENT_OVERVIEW_SURFACE: SurfaceSpec = {
  id: "agent",
  labelKey: "dronePanel.computer",
  group: ONBOARD_COMPUTER_GROUP,
  locked: lockedWhenNoAgent,
  render: () => <AgentOverviewTab />,
};

export const SYSTEM_SURFACE: SurfaceSpec = {
  id: "system",
  labelKey: "dronePanel.health",
  group: ONBOARD_COMPUTER_GROUP,
  locked: lockedWhenNoAgent,
  // Pass the node profile through so a workstation (headless compute box) drops
  // the FC / radio / regulatory / mesh panels and shows compute metrics instead.
  render: (ctx) => <SystemTab profile={ctx.drone.profile ?? "drone"} />,
};

/** The merged flight-log + Black Box review surface. Replaces the separate
 * Flights and Black Box surfaces. Not locked — the Flights view works without
 * a paired agent and the Recorder view self-gates. Flights show only for a
 * drone profile (ground-station / compute nodes do not fly). */
export const LOGS_SURFACE: SurfaceSpec = {
  id: "logs",
  labelKey: "dronePanel.logs",
  group: ONBOARD_COMPUTER_GROUP,
  render: (ctx) => (
    <LogsTab
      droneId={ctx.droneId}
      showFlights={(ctx.drone.profile ?? "drone") === "drone"}
    />
  ),
};

export const PLUGINS_SURFACE: SurfaceSpec = {
  id: "plugins",
  labelKey: "dronePanel.extensions",
  group: ONBOARD_COMPUTER_GROUP,
  locked: lockedWhenNoAgent,
  render: () => <PluginsTab />,
};

/** Drone companion strip (Onboard computer): Computer + Health + Extensions +
 * Logs, in the founder-approved order. */
export const DRONE_UNIVERSAL_SURFACES: SurfaceSpec[] = [
  AGENT_OVERVIEW_SURFACE,
  SYSTEM_SURFACE,
  PLUGINS_SURFACE,
  LOGS_SURFACE,
];

/** Non-drone companion strip (own overview already present): Health + Logs +
 * Extensions. Also the fallback set for unknown / future profiles. */
export const NODE_UNIVERSAL_SURFACES: SurfaceSpec[] = [
  SYSTEM_SURFACE,
  LOGS_SURFACE,
  PLUGINS_SURFACE,
];
