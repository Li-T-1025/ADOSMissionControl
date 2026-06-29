/**
 * @module node-detail/surfaces/compute
 * @description Surfaces for a compute node in two-tier order: a Status section
 * (the placeholder overview) plus the Onboard computer companion strip
 * (Health / Extensions / Logs). The full compute surface lands in a future
 * stage.
 * @license GPL-3.0-only
 */

import { ComputePanelPlaceholder } from "@/components/command/nodes/compute/ComputePanelPlaceholder";
import type { SurfaceSpec } from "../surface-types";
import { NODE_UNIVERSAL_SURFACES } from "./universal";

const STATUS_GROUP = "command.groundStation.groups.status";

export const COMPUTE_SURFACES: SurfaceSpec[] = [
  {
    id: "overview",
    labelKey: "dronePanel.status",
    group: STATUS_GROUP,
    render: (ctx) => <ComputePanelPlaceholder nodeId={ctx.droneId} />,
  },
  ...NODE_UNIVERSAL_SURFACES,
];
