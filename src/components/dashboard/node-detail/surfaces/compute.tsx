/**
 * @module node-detail/surfaces/compute
 * @description Surfaces for a compute node: the placeholder overview plus the
 * companion strip. The full compute surface lands in a future stage.
 * @license GPL-3.0-only
 */

import { ComputePanelPlaceholder } from "@/components/command/nodes/compute/ComputePanelPlaceholder";
import type { SurfaceSpec } from "../surface-types";
import { NODE_UNIVERSAL_SURFACES } from "./universal";

export const COMPUTE_SURFACES: SurfaceSpec[] = [
  {
    id: "overview",
    labelKey: "dronePanel.overview",
    render: () => <ComputePanelPlaceholder />,
  },
  ...NODE_UNIVERSAL_SURFACES,
];
