/**
 * @module node-detail/surfaces/workstation
 * @description Surfaces for a workstation in two-tier order: a Status section
 * (the overview + the Atlas Forge compute workbench, which carries its own
 * enable affordance) plus the Onboard computer companion strip (Health /
 * Extensions / Logs).
 * @license GPL-3.0-only
 */

import { WorkstationPanelPlaceholder } from "@/components/command/nodes/workstation/WorkstationPanelPlaceholder";
import { AtlasForge } from "@/components/command/nodes/atlas/AtlasForge";
import type { SurfaceSpec } from "../surface-types";
import { NODE_UNIVERSAL_SURFACES } from "./universal";

const STATUS_GROUP = "command.groundStation.groups.status";

export const WORKSTATION_SURFACES: SurfaceSpec[] = [
  {
    id: "overview",
    labelKey: "dronePanel.status",
    group: STATUS_GROUP,
    render: (ctx) => <WorkstationPanelPlaceholder nodeId={ctx.droneId} />,
  },
  {
    id: "forge",
    labelKey: "workstation.workspace.forge",
    group: STATUS_GROUP,
    // Always shown. AtlasForge renders an in-place "Enable Atlas World Model"
    // card when the flag is off, so the workstation's primary surface is
    // discoverable without digging through global settings.
    render: (ctx) => <AtlasForge nodeId={ctx.droneId} />,
  },
  ...NODE_UNIVERSAL_SURFACES,
];
