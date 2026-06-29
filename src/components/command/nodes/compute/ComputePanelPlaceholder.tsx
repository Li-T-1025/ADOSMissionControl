"use client";

/**
 * @module ComputePanelPlaceholder
 * @description Right-pane detail surface for nodes that advertise
 * profile === "compute" (NPU-only headless inference / mesh / relay
 * companions with no FC and no video pipeline). Renders the live
 * compute overview — agent status, system resources, compute metrics
 * (NPU/GPU), running services, and logs — from the data the agent
 * already reports. The richer Jobs / Models / GPU / Datasets / Outputs
 * / Studio surfaces are tracked separately; this pane shows the real
 * node state today rather than a notice.
 * @license GPL-3.0-only
 */

import { ComputeOverview } from "../../overview/ComputeOverview";

export function ComputePanelPlaceholder({ nodeId }: { nodeId?: string }) {
  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <ComputeOverview nodeId={nodeId} />
    </div>
  );
}
