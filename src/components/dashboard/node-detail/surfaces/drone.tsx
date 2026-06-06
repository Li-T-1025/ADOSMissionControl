/**
 * @module node-detail/surfaces/drone
 * @description Surfaces for a drone (flight-controller) node: flight
 * overview, FC parameters, flight logs, Configure, plus capability-gated
 * Vision and air-side Radio, then the companion strip.
 * @license GPL-3.0-only
 */

import { DroneOverviewTab } from "@/components/drone-detail/DroneOverviewTab";
import { DroneFlightsTab } from "@/components/drone-detail/DroneFlightsTab";
import { DroneConfigureTab } from "@/components/drone-detail/DroneConfigureTab";
import { DroneVisionTab } from "@/components/drone-detail/DroneVisionTab";
import { ParametersPanel } from "@/components/fc/parameters/ParametersPanel";
import { DroneRadioPanel } from "@/components/dashboard/DroneRadioPanel";
import { LinkUpPlaceholder } from "@/components/shared/link-up/LinkUpPlaceholder";
import type { SurfaceSpec } from "../surface-types";
import { DRONE_UNIVERSAL_SURFACES } from "./universal";

export const DRONE_SURFACES: SurfaceSpec[] = [
  {
    id: "overview",
    labelKey: "dronePanel.overview",
    render: (ctx) => <DroneOverviewTab drone={ctx.drone} />,
  },
  {
    id: "parameters",
    labelKey: "dronePanel.parameters",
    render: (ctx) =>
      ctx.isConnected ? (
        <ParametersPanel />
      ) : (
        <LinkUpPlaceholder variant="no-fc-direct" droneName={ctx.displayName} />
      ),
  },
  {
    id: "flights",
    labelKey: "dronePanel.flights",
    render: (ctx) => <DroneFlightsTab droneId={ctx.droneId} />,
  },
  {
    id: "configure",
    labelKey: "dronePanel.configure",
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
    id: "radio",
    labelKey: "dronePanel.radio",
    when: (ctx) => ctx.radioPresent,
    render: (ctx) => <DroneRadioPanel droneId={ctx.droneId} />,
  },
  {
    id: "vision",
    labelKey: "dronePanel.vision",
    when: (ctx) => ctx.visionPresent,
    render: (ctx) => <DroneVisionTab droneId={ctx.droneId} />,
  },
  ...DRONE_UNIVERSAL_SURFACES,
];
