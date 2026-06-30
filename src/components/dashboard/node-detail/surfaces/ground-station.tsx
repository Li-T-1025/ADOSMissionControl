/**
 * @module node-detail/surfaces/ground-station
 * @description Surfaces for a ground-station node in two-tier order, role-gated
 * (direct / relay / receiver): a Status section (its overview), a Link section
 * (ground-side radio + network/uplink + mesh + distributed RX), a Device
 * section (local display + buttons + peripherals), then the Onboard computer
 * companion strip (Health / Extensions / Logs). Controls drive the agent REST
 * surface, so each body falls back to a demo notice in demo mode.
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
import { GroundStationAtlasRelay } from "@/components/command/nodes/ground-station/GroundStationAtlasRelay";
import { useAtlasModeStore } from "@/stores/atlas-mode-store";
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

const STATUS_GROUP = "command.groundStation.groups.status";
const LINK_GROUP = "command.groundStation.groups.link";
const DEVICE_GROUP = "command.groundStation.groups.device";

export const GROUND_STATION_SURFACES: SurfaceSpec[] = [
  {
    id: "overview",
    labelKey: "dronePanel.status",
    group: STATUS_GROUP,
    render: () => gsBody(<GroundStationOverview />),
  },
  {
    id: "radio",
    labelKey: "command.groundStation.tabs.radio",
    group: LINK_GROUP,
    when: (ctx) => ctx.role !== "receiver",
    render: () => gsBody(<RadioTab />),
  },
  {
    id: "network",
    labelKey: "command.groundStation.tabs.network",
    group: LINK_GROUP,
    render: () => gsBody(<NetworkTab />),
  },
  {
    id: "mesh",
    labelKey: "command.groundStation.tabs.mesh",
    group: LINK_GROUP,
    when: hasMesh,
    render: () => gsBody(<MeshTab />),
  },
  {
    id: "distributedRx",
    labelKey: "command.groundStation.tabs.distributedRx",
    group: LINK_GROUP,
    when: hasMesh,
    render: () => gsBody(<DistributedRxTab />),
  },
  {
    id: "atlasRelay",
    labelKey: "atlas.atlasRelay",
    group: LINK_GROUP,
    when: () => useAtlasModeStore.getState().enabled,
    render: () => gsBody(<GroundStationAtlasRelay />),
  },
  {
    id: "display",
    labelKey: "command.groundStation.tabs.display",
    group: DEVICE_GROUP,
    render: () => gsBody(<DisplayTab />),
  },
  {
    id: "physicalUi",
    labelKey: "dronePanel.buttons",
    group: DEVICE_GROUP,
    render: () => gsBody(<PhysicalUiTab />),
  },
  {
    id: "peripherals",
    labelKey: "command.groundStation.tabs.peripherals",
    group: DEVICE_GROUP,
    render: () => gsBody(<PeripheralsTab />),
  },
  ...NODE_UNIVERSAL_SURFACES,
];
