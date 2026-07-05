/**
 * @module node-detail/surfaces/drone
 * @description Surfaces for a drone (flight-controller) node in two-tier order:
 * a Flight section (Status + capability-gated Vision), a Vehicle section
 * (Setup + Parameters + air-side Link), then the Onboard computer companion
 * strip (Computer / Health / Extensions / Logs).
 * @license GPL-3.0-only
 */

import { DroneOverviewTab } from "@/components/drone-detail/DroneOverviewTab";
import { DroneOverview } from "@/components/command/overview/DroneOverview";
import { DroneConfigureTab } from "@/components/drone-detail/DroneConfigureTab";
import { DroneVisionTab } from "@/components/drone-detail/DroneVisionTab";
import { DroneLiveWorldTab } from "@/components/drone-detail/DroneLiveWorldTab";
import { DroneWorldModelTab } from "@/components/drone-detail/DroneWorldModelTab";
import { ParametersPanel } from "@/components/fc/parameters/ParametersPanel";
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
    // The flight HUD/map lands here. "Enter cockpit" still routes to /fly.
    id: "flight",
    labelKey: "dronePanel.flight",
    group: FLIGHT_GROUP,
    render: (ctx) => <DroneOverviewTab drone={ctx.drone} />,
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
    when: (ctx) => ctx.atlasEnabled && ctx.atlasCapturing,
    render: (ctx) => <DroneLiveWorldTab droneId={ctx.droneId} />,
  },
  {
    // Always shown when the Atlas feature flag is on: the setup + reconstruction
    // viewer surface. Per-drone "enable" is a capture action (PUT config), not a
    // visibility gate.
    id: "world-model",
    labelKey: "dronePanel.worldModel",
    group: FLIGHT_GROUP,
    when: (ctx) => ctx.atlasEnabled,
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
    id: "radio",
    labelKey: "dronePanel.link",
    group: VEHICLE_GROUP,
    when: (ctx) => ctx.radioPresent,
    render: (ctx) => <DroneRadioPanel droneId={ctx.droneId} />,
  },
  ...DRONE_UNIVERSAL_SURFACES,
];
