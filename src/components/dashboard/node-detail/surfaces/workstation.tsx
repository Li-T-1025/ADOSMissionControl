"use client";

/**
 * @module node-detail/surfaces/workstation
 * @description Surfaces for a workstation node: Overview + Jobs + Viewer + the
 * Onboard-computer companion strip. The Forge 4-subview wrapper is collapsed
 * into first-class Jobs (a group-by that absorbs Datasets) and Viewer tabs,
 * with GPU folded into the Overview vitals.
 * @license GPL-3.0-only
 */

import { useTranslations } from "next-intl";
import { Boxes } from "lucide-react";
import { ComputeOverview } from "@/components/command/overview/ComputeOverview";
import { JobsPanel } from "@/components/command/nodes/atlas/JobsPanel";
import { ForgeOutputs } from "@/components/command/nodes/atlas/ForgeOutputs";
import { useComputeJobs } from "@/hooks/use-compute-jobs";
import { useAtlasModeStore } from "@/stores/atlas-mode-store";
import type { SurfaceSpec } from "../surface-types";
import { NODE_UNIVERSAL_SURFACES } from "./universal";

const STATUS_GROUP = "command.groundStation.groups.status";
// i18n: a dedicated "Compute" section key can replace this reused label.
const COMPUTE_GROUP = "atlas.compute";

/** The Viewer tab body: the reconstruction viewer over the node's finished
 * jobs (renamed from "Outputs"). Adapts the selected node to ForgeOutputs, with
 * a calm state when Atlas is off or the compute node is unreachable (Rule 39). */
function WorkstationViewer({ nodeId }: { nodeId?: string }) {
  const t = useTranslations("atlas");
  const atlasEnabled = useAtlasModeStore((s) => s.enabled);
  const { jobs, client } = useComputeJobs(nodeId);
  if (!atlasEnabled || !client) {
    return (
      <div className="flex h-full min-h-[320px] items-center justify-center p-6">
        <div className="text-center">
          <Boxes className="mx-auto mb-2 h-5 w-5 text-text-tertiary" />
          <p className="max-w-sm text-[11px] text-text-tertiary">
            {t("forgeLocalOnly")}
          </p>
        </div>
      </div>
    );
  }
  return <ForgeOutputs jobs={jobs} client={client} />;
}

export const WORKSTATION_SURFACES: SurfaceSpec[] = [
  // Overview (GPU folded in).
  {
    id: "overview",
    labelKey: "dronePanel.overview",
    group: STATUS_GROUP,
    render: (ctx) => <ComputeOverview nodeId={ctx.droneId} />,
  },
  // Compute band: Jobs (absorbs Datasets) + Viewer.
  {
    id: "jobs",
    labelKey: "atlas.forgeJobs",
    group: COMPUTE_GROUP,
    render: (ctx) => <JobsPanel nodeId={ctx.droneId} />,
  },
  {
    id: "viewer",
    labelKey: "atlas.viewerGroupLabel",
    group: COMPUTE_GROUP,
    render: (ctx) => <WorkstationViewer nodeId={ctx.droneId} />,
  },
  ...NODE_UNIVERSAL_SURFACES,
];
