/**
 * @module node-detail/surfaces/drone
 * @description Surfaces for a drone (flight-controller) node as a flat,
 * ungrouped strip: Status + Flight + Cockpit (monitoring), Setup + Parameters +
 * Scripts (vehicle config), then the Agent page. The Agent page collapses the
 * companion-computer surfaces (Health / Link / Perception / World Model / Live
 * World / Settings / Extensions / Logs) behind one tab.
 * @license GPL-3.0-only
 */

import { DroneOverviewTab } from "@/components/drone-detail/DroneOverviewTab";
import { CockpitView } from "@/components/fly/CockpitView";
import { DroneOverview } from "@/components/command/overview/DroneOverview";
import { DroneConfigureTab } from "@/components/drone-detail/DroneConfigureTab";
import { ParametersPanel } from "@/components/fc/parameters/ParametersPanel";
import { DroneScriptsTab } from "@/components/dashboard/drone-scripts/DroneScriptsTab";
import { FcDisconnectedPlaceholder } from "@/components/fc/shared/FcDisconnectedPlaceholder";
import type { SurfaceSpec } from "../surface-types";
import { AGENT_SURFACE } from "../agent/agent-surface";

export const DRONE_SURFACES: SurfaceSpec[] = [
  {
    // The unified drone Overview (hero + FC band + companion band /
    // add-computer CTA).
    id: "overview",
    labelKey: "dronePanel.status",
    render: (ctx) => <DroneOverview ctx={ctx} />,
  },
  {
    // The flight instruments + map (left telemetry panel + right map view).
    id: "flight",
    labelKey: "dronePanel.flight",
    render: (ctx) => <DroneOverviewTab drone={ctx.drone} />,
  },
  {
    // The immersive piloting cockpit (video + HUD + skill bar). Shown for every
    // drone; an FC-only drone with no video renders the OSD/telemetry over a
    // "no signal" state. "Immersive" collapses the dashboard chrome in place.
    id: "cockpit",
    labelKey: "dronePanel.cockpit",
    render: (ctx) => <CockpitView droneId={ctx.droneId} />,
  },
  {
    id: "configure",
    labelKey: "dronePanel.setup",
    render: (ctx) => (
      <DroneConfigureTab
        droneId={ctx.droneId}
        droneName={ctx.displayName}
        isConnected={ctx.isConnected}
        fcLinking={ctx.fcLinking}
      />
    ),
  },
  {
    id: "parameters",
    labelKey: "dronePanel.parameters",
    render: (ctx) =>
      ctx.isConnected ? (
        <ParametersPanel />
      ) : (
        <FcDisconnectedPlaceholder droneName={ctx.displayName} />
      ),
  },
  {
    // ArduPilot onboard Lua scripting: manage the FC's APM/scripts/ over
    // MAVLink FTP (works direct-to-FC and via the agent's transparent pipe).
    // ArduPilot-only — Betaflight/iNav have no Lua VM, PX4's scripting is
    // separate.
    id: "scripts",
    labelKey: "dronePanel.scripts",
    when: (ctx) =>
      ctx.isConnected && (ctx.firmwareType?.startsWith("ardupilot") ?? false),
    render: (ctx) => <DroneScriptsTab droneId={ctx.droneId} />,
  },
  AGENT_SURFACE,
];
