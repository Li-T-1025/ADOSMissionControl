"use client";

/**
 * @module workstation/panels/forge
 * @description The Forge workspace's built-in workstation panels — the compute /
 * Atlas workbench. Thin, first-party adapters that mount the existing compute +
 * world-model surfaces as dockable Dockview panels: the compute-node overview,
 * the compute-cluster status card, the during-flight Live World capture monitor,
 * and the post-flight World Model viewer. Each wrapper only adapts the host's
 * {@link WorkstationContext} to the wrapped component's props — no new behavior,
 * no stubs. The compute overview is the always-on node view; the cluster card and
 * the two world panels share the same opt-in Atlas gate the drone node tabs use,
 * so they appear only when Atlas mode is enabled.
 *
 * @license GPL-3.0-only
 */

import { Boxes } from "lucide-react";
import { useTranslations } from "next-intl";
import { ComputeOverview } from "@/components/command/overview/ComputeOverview";
import { ComputeClusterCard } from "@/components/command/shared/ComputeClusterCard";
import { DroneLiveWorldTab } from "@/components/drone-detail/DroneLiveWorldTab";
import { DroneWorldModelTab } from "@/components/drone-detail/DroneWorldModelTab";
import { useAtlasModeStore } from "@/stores/atlas-mode-store";
import type { WorkstationPanel, WorkstationPanelProps } from "../types";

/**
 * Atlas surfaces are gated on the same opt-in flag the drone node tabs read
 * (`surfaces/drone.tsx`). Read via `getState()` so this stays a plain predicate;
 * like those surfaces, the open set re-resolves on the next context change.
 */
const atlasEnabled = (): boolean => useAtlasModeStore.getState().enabled;

/** Compute-node overview — agent status, resources, compute metrics, services. */
function ForgeComputeOverviewPanel({
  context,
}: WorkstationPanelProps): React.ReactElement {
  return <ComputeOverview nodeId={context.droneId ?? undefined} />;
}

/** Compute-cluster status card (role / queue / workers / registered slaves). */
function ForgeComputeClusterPanel(): React.ReactElement {
  return (
    <div className="p-4">
      <ComputeClusterCard />
    </div>
  );
}

/** During-flight Live World capture monitor for the selected node. */
function ForgeLiveWorldPanel({
  context,
}: WorkstationPanelProps): React.ReactElement {
  const t = useTranslations("command");
  if (context.droneId === null) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <div className="text-center">
          <Boxes className="mx-auto mb-2 h-5 w-5 text-text-tertiary" />
          <p className="text-[11px] text-text-tertiary">{t("selectNode")}</p>
        </div>
      </div>
    );
  }
  return <DroneLiveWorldTab droneId={context.droneId} />;
}

/** Post-flight World Model viewer (Rerun / gsplat / point-cloud switcher). */
function ForgeWorldModelPanel(): React.ReactElement {
  return <DroneWorldModelTab />;
}

/** Built-in Forge-workspace workstation panels. */
export const forgePanels: WorkstationPanel[] = [
  {
    id: "forge-compute-overview",
    workspace: "forge",
    title: "Compute Overview",
    group: "forge-compute",
    order: 0,
    component: ForgeComputeOverviewPanel,
  },
  {
    id: "forge-compute-cluster",
    workspace: "forge",
    title: "Compute Cluster",
    group: "forge-compute",
    order: 1,
    component: ForgeComputeClusterPanel,
    when: atlasEnabled,
  },
  {
    id: "forge-live-world",
    workspace: "forge",
    title: "Live World",
    group: "forge-world",
    order: 2,
    component: ForgeLiveWorldPanel,
    when: atlasEnabled,
  },
  {
    id: "forge-world-model",
    workspace: "forge",
    title: "World Model",
    group: "forge-world",
    order: 3,
    component: ForgeWorldModelPanel,
    when: atlasEnabled,
  },
];
