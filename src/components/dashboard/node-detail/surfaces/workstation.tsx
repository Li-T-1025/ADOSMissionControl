/**
 * @module node-detail/surfaces/workstation
 * @description Surfaces for a workstation in two-tier order: a Status section
 * (the placeholder overview) plus the Onboard computer companion strip
 * (Health / Extensions / Logs). The full compute surface lands in a future
 * stage.
 * @license GPL-3.0-only
 */

import { WorkstationPanelPlaceholder } from "@/components/command/nodes/workstation/WorkstationPanelPlaceholder";
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
  ...NODE_UNIVERSAL_SURFACES,
];
