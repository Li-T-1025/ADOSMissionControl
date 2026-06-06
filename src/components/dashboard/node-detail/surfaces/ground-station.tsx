/**
 * @module node-detail/surfaces/ground-station
 * @description Surfaces for a ground-station node, role-gated (direct /
 * relay / receiver): its overview, ground-side radio, network / uplink, mesh
 * + distributed RX, local display + physical UI + peripherals, then the
 * companion strip (System / Black Box / Plugins). Controls drive the agent
 * REST surface, so each body falls back to a demo notice in demo mode.
 * @license GPL-3.0-only
 */

import type { ReactNode } from "react";
import { isDemoMode } from "@/lib/utils";
import { GroundStationOverview } from "@/components/command/overview/GroundStationOverview";
import { RadioTab } from "@/components/command/nodes/ground-station/RadioTab";
import { NetworkTab } from "@/components/command/nodes/ground-station/NetworkTab";
import { DisplayTab } from "@/components/command/nodes/ground-station/DisplayTab";
import { PhysicalUiTab } from "@/components/command/nodes/ground-station/PhysicalUiTab";
import { PeripheralsTab } from "@/components/command/nodes/ground-station/PeripheralsTab";
import { MeshTab } from "@/components/command/nodes/ground-station/MeshTab";
import { DistributedRxTab } from "@/components/command/nodes/ground-station/DistributedRxTab";
import type { SurfaceSpec, SurfaceContext } from "../surface-types";
import { NODE_UNIVERSAL_SURFACES } from "./universal";
import { GroundStationDemoNotice } from "./GroundStationDemoNotice";

/** GS controls are inert without a live agent; swap the body for a notice in
 * demo (mirrors the prior GroundStationDetailPanel demo guard). */
function gsBody(node: ReactNode): ReactNode {
  return isDemoMode() ? <GroundStationDemoNotice /> : node;
}

// Role gates mirror the prior GroundStationDetailPanel.visibleTabsForRole:
// a receiver hides Radio (RX-only); a direct node (and unknown / null role)
// hides Mesh + Distributed RX (solo node).
const hasMesh = (ctx: SurfaceContext) =>
  ctx.role === "relay" || ctx.role === "receiver";

export const GROUND_STATION_SURFACES: SurfaceSpec[] = [
  {
    id: "overview",
    labelKey: "command.groundStation.tabs.overview",
    render: () => gsBody(<GroundStationOverview />),
  },
  {
    id: "radio",
    labelKey: "command.groundStation.tabs.radio",
    when: (ctx) => ctx.role !== "receiver",
    render: () => gsBody(<RadioTab />),
  },
  {
    id: "network",
    labelKey: "command.groundStation.tabs.network",
    render: () => gsBody(<NetworkTab />),
  },
  {
    id: "mesh",
    labelKey: "command.groundStation.tabs.mesh",
    when: hasMesh,
    render: () => gsBody(<MeshTab />),
  },
  {
    id: "distributedRx",
    labelKey: "command.groundStation.tabs.distributedRx",
    when: hasMesh,
    render: () => gsBody(<DistributedRxTab />),
  },
  {
    id: "display",
    labelKey: "command.groundStation.tabs.display",
    render: () => gsBody(<DisplayTab />),
  },
  {
    id: "physicalUi",
    labelKey: "command.groundStation.tabs.physicalUi",
    render: () => gsBody(<PhysicalUiTab />),
  },
  {
    id: "peripherals",
    labelKey: "command.groundStation.tabs.peripherals",
    render: () => gsBody(<PeripheralsTab />),
  },
  ...NODE_UNIVERSAL_SURFACES,
];
