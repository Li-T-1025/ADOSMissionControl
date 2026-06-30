/**
 * @module node-detail/surfaces/workstation
 * @description Surfaces for a workstation in two-tier order: a Status section
 * (the overview + the Atlas Forge compute workbench, behind the Atlas flag)
 * plus the Onboard computer companion strip (Health / Extensions / Logs).
 * @license GPL-3.0-only
 */

import { WorkstationPanelPlaceholder } from "@/components/command/nodes/workstation/WorkstationPanelPlaceholder";
import { AtlasForge } from "@/components/command/nodes/atlas/AtlasForge";
import { useAtlasModeStore } from "@/stores/atlas-mode-store";
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
    when: () => useAtlasModeStore.getState().enabled,
    render: (ctx) => <AtlasForge nodeId={ctx.droneId} />,
  },
  ...NODE_UNIVERSAL_SURFACES,
];
