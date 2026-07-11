/**
 * @module node-detail/surfaces/drone
 * @description Surfaces for a drone (flight-controller) node in two-tier order:
 * a Flight section (Status + capability-gated Vision), a Vehicle section
 * (Setup + Parameters + air-side Link), then the Onboard computer companion
 * strip (Computer / Health / Extensions / Logs).
 * @license GPL-3.0-only
 */

import { DroneOverviewTab } from "@/components/drone-detail/DroneOverviewTab";
import { CockpitView } from "@/components/fly/CockpitView";
import { DroneOverview } from "@/components/command/overview/DroneOverview";
import { DroneConfigureTab } from "@/components/drone-detail/DroneConfigureTab";
import { DroneVisionTab } from "@/components/drone-detail/DroneVisionTab";
import { DroneLiveWorldTab } from "@/components/drone-detail/DroneLiveWorldTab";
import { DroneWorldModelTab } from "@/components/drone-detail/DroneWorldModelTab";
import { ParametersPanel } from "@/components/fc/parameters/ParametersPanel";
import { DroneScriptsTab } from "@/components/dashboard/drone-scripts/DroneScriptsTab";
import { DroneRadioPanel } from "@/components/dashboard/DroneRadioPanel";
import { FcDisconnectedPlaceholder } from "@/components/fc/shared/FcDisconnectedPlaceholder";
import type { SurfaceSpec } from "../surface-types";
import { DRONE_UNIVERSAL_SURFACES } from "./universal";

const FLIGHT_GROUP = "dronePanel.groups.flight";
const VEHICLE_GROUP = "dronePanel.groups.vehicle";

export const DRONE_SURFACES: SurfaceSpec[] = [
  {
    // The unified drone Overview (hero + FC band + companion band /
    // add-computer CTA).
    id: "overview",
    labelKey: "dronePanel.status",
    group: FLIGHT_GROUP,
    render: (ctx) => <DroneOverview ctx={ctx} />,
  },
  {
    // The flight instruments + map (left telemetry panel + right map view).
    id: "flight",
    labelKey: "dronePanel.flight",
    group: FLIGHT_GROUP,
    render: (ctx) => <DroneOverviewTab drone={ctx.drone} />,
  },
  {
    // The immersive piloting cockpit (video + HUD + skill bar). Shown for every
    // drone; an FC-only drone with no video renders the OSD/telemetry over a
    // "no signal" state. "Immersive" collapses the dashboard chrome in place.
    id: "cockpit",
    labelKey: "dronePanel.cockpit",
    group: FLIGHT_GROUP,
    render: (ctx) => <CockpitView droneId={ctx.droneId} />,
  },
  {
    id: "vision",
    labelKey: "dronePanel.vision",
    group: FLIGHT_GROUP,
    when: (ctx) => ctx.visionPresent,
    render: (ctx) => <DroneVisionTab droneId={ctx.droneId} />,
  },
  {
    // Shown only while the drone is actively capturing (readiness.capturing),
    // so the drone shows one Atlas tab (World Model) when idle and two while
    // capturing. `atlasCapturing` is the reactive mirror of the readiness
    // store's synchronous `isCapturing(deviceId)`.
    id: "live-world",
    labelKey: "dronePanel.liveWorld",
    group: FLIGHT_GROUP,
    // Atlas needs the drone's companion agent (to capture keyframes) + a compute
    // node — so it only applies to an agent-backed drone, never an FC-only one.
    // The World Model feature is a per-node opt-in (Status-tab Features toggle).
    when: (ctx) =>
      ctx.agentDeviceId !== null &&
      ctx.isFeatureEnabled("world-model") &&
      ctx.atlasCapturing,
    render: (ctx) => <DroneLiveWorldTab droneId={ctx.droneId} />,
  },
  {
    // Shown when the World Model feature is enabled for this drone (the Status-tab
    // Features toggle): the setup + reconstruction viewer surface.
    id: "world-model",
    labelKey: "dronePanel.worldModel",
    group: FLIGHT_GROUP,
    // Agent-backed drones only — Atlas reconstruction depends on the companion.
    when: (ctx) =>
      ctx.agentDeviceId !== null && ctx.isFeatureEnabled("world-model"),
    render: (ctx) => <DroneWorldModelTab droneId={ctx.droneId} />,
  },
  {
    id: "configure",
    labelKey: "dronePanel.setup",
    group: VEHICLE_GROUP,
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
    group: VEHICLE_GROUP,
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
    group: VEHICLE_GROUP,
    when: (ctx) =>
      ctx.isConnected && (ctx.firmwareType?.startsWith("ardupilot") ?? false),
    render: (ctx) => <DroneScriptsTab droneId={ctx.droneId} />,
  },
  {
    id: "radio",
    labelKey: "dronePanel.link",
    group: VEHICLE_GROUP,
    when: (ctx) => ctx.radioPresent,
    render: (ctx) => <DroneRadioPanel droneId={ctx.droneId} />,
  },
  ...DRONE_UNIVERSAL_SURFACES,
];
