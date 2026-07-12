/**
 * @module node-detail/surfaces/universal
 * @description Companion-computer surfaces shared by every agent profile,
 * grouped under the "Onboard computer" section: System (Health), Plugins
 * (Extensions), and the merged Logs surface. System + Plugins hide for an
 * FC-only node (no paired agent); the Agent/Computer overview is merged into
 * each profile's Overview surface. The Logs surface is intentionally always
 * present: its Flights view reads the GCS history store and stays reachable
 * without a paired agent.
 * @license GPL-3.0-only
 */

import { SystemTab } from "@/components/command/SystemTab";
import { PluginsTab } from "@/components/command/PluginsTab";
import { NodeSettingsTab } from "@/components/command/settings/NodeSettingsTab";
import { LogsTab } from "@/components/drone-detail/LogsTab";
import type { SurfaceSpec, SurfaceContext } from "../surface-types";

const ONBOARD_COMPUTER_GROUP = "dronePanel.groups.onboardComputer";

/** Hide the surface for an FC-only node (nothing to show) rather than
 * lock-badging it. Ground-station / workstation are unaffected (their
 * showLockedTabs is false, so it stays visible either way). */
const whenCompanionPresent = (ctx: SurfaceContext) => !ctx.showLockedTabs;

export const SYSTEM_SURFACE: SurfaceSpec = {
  id: "system",
  labelKey: "dronePanel.health",
  group: ONBOARD_COMPUTER_GROUP,
  when: whenCompanionPresent,
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
  when: whenCompanionPresent,
  render: () => <PluginsTab />,
};

/** The node configuration surface: agent config sections (profile / region /
 * network / cloud / advanced) plus the relocated first-party Features toggle
 * (World Model). Present on every companion node; hidden on an FC-only node
 * with no paired agent (nothing to configure). */
export const SETTINGS_SURFACE: SurfaceSpec = {
  id: "settings",
  labelKey: "dronePanel.settings",
  group: ONBOARD_COMPUTER_GROUP,
  when: whenCompanionPresent,
  render: (ctx) => (
    <NodeSettingsTab
      droneId={ctx.droneId}
      profile={ctx.drone.profile ?? "drone"}
    />
  ),
};

/** Drone companion strip (Onboard computer): Health + Settings + Extensions +
 * Logs. The Agent/Computer overview is merged into the drone Overview surface. */
export const DRONE_UNIVERSAL_SURFACES: SurfaceSpec[] = [
  SYSTEM_SURFACE,
  SETTINGS_SURFACE,
  PLUGINS_SURFACE,
  LOGS_SURFACE,
];

/** Non-drone companion strip (own overview already present): Health + Settings +
 * Logs + Extensions. Also the fallback set for unknown / future profiles. */
export const NODE_UNIVERSAL_SURFACES: SurfaceSpec[] = [
  SYSTEM_SURFACE,
  SETTINGS_SURFACE,
  LOGS_SURFACE,
  PLUGINS_SURFACE,
];
