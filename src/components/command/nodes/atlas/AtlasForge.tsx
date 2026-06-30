"use client";

/**
 * @module AtlasForge
 * @description The compute-node operator workbench (Atlas Forge): process,
 * view, and inspect reconstruction / offload jobs on the node, plus its GPU /
 * cluster status. Four sub-views — Jobs, Outputs, Datasets, GPU. Reaches the
 * node's job API directly over the LAN (Rule 39, local-first); when that API is
 * unreachable it renders a calm "awaiting compute node" state, never an error.
 * Always mounted on the workstation surface; renders an in-place "Enable Atlas"
 * card when the flag is off (the opt-in lives here, not in global settings).
 * @license GPL-3.0-only
 */

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Boxes } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAtlasModeStore } from "@/stores/atlas-mode-store";
import { useComputeJobs } from "@/hooks/use-compute-jobs";
import { useComputeLocalState } from "@/hooks/use-compute-local-state";
import { ComputeMetricsCard } from "@/components/command/shared/ComputeMetricsCard";
import { ComputeClusterCard } from "@/components/command/shared/ComputeClusterCard";
import { ForgeJobs } from "./ForgeJobs";
import { ForgeOutputs } from "./ForgeOutputs";
import { ForgeDatasets } from "./ForgeDatasets";

type ForgeView = "jobs" | "outputs" | "datasets" | "gpu";

const VIEW_KEYS: Record<ForgeView, string> = {
  jobs: "forgeJobs",
  outputs: "forgeOutputs",
  datasets: "forgeDatasets",
  gpu: "forgeGpu",
};

function ForgeEmpty({ message }: { message: string }) {
  return (
    <div className="absolute inset-0 flex items-center justify-center p-6">
      <div className="text-center">
        <Boxes className="w-5 h-5 text-text-tertiary mx-auto mb-2" />
        <p className="text-[11px] text-text-tertiary max-w-sm">{message}</p>
      </div>
    </div>
  );
}

/** Atlas is opt-in. The Forge tab is always present on a workstation, so when
 *  the flag is off it offers to turn it on right here — no global-settings hunt. */
function AtlasEnableCard() {
  const t = useTranslations("atlas");
  const setEnabled = useAtlasModeStore((s) => s.setEnabled);
  return (
    <div className="flex h-full min-h-[320px] items-center justify-center p-6">
      <div className="max-w-sm text-center">
        <Boxes className="mx-auto mb-3 h-6 w-6 text-accent-primary" />
        <h3 className="mb-1 text-sm font-semibold text-text-primary">
          {t("enableTitle")}
        </h3>
        <p className="mb-4 text-[11px] text-text-tertiary">{t("enableBody")}</p>
        <button
          type="button"
          onClick={() => setEnabled(true)}
          className="rounded bg-accent-primary px-4 py-1.5 text-[12px] font-medium text-bg-primary transition-colors hover:bg-accent-primary/90"
        >
          {t("enableButton")}
        </button>
      </div>
    </div>
  );
}

export function AtlasForge({ nodeId }: { nodeId?: string }) {
  const t = useTranslations("atlas");
  const atlasEnabled = useAtlasModeStore((s) => s.enabled);
  // Feed the compute store so the GPU sub-view's cluster card is live (the
  // poll is idempotent and disjoint from the cloud bridge — Rule 39).
  useComputeLocalState(nodeId);
  const { jobs, loading, unreachable, client } = useComputeJobs(nodeId);
  const [view, setView] = useState<ForgeView>("jobs");

  // Atlas is the opt-in. The tab is always present, so offer to enable it here.
  if (!atlasEnabled) {
    return <AtlasEnableCard />;
  }

  // Atlas is on, but this node's compute API isn't reachable over the LAN (no
  // node / no LAN key). A calm "pair the node" state, never an error.
  if (!client) {
    return (
      <div className="relative h-full min-h-[320px]">
        <ForgeEmpty message={t("forgeLocalOnly")} />
      </div>
    );
  }

  const body = () => {
    if (loading) {
      return (
        <div className="flex items-center justify-center py-16">
          <div className="w-5 h-5 border-2 border-accent-primary border-t-transparent rounded-full animate-spin" />
        </div>
      );
    }
    // The job API is unreachable: a calm awaiting state, not an error. The GPU
    // view reads the status sidecar (a separate port), so keep it available.
    if (unreachable && view !== "gpu") {
      return (
        <div className="relative h-full min-h-[280px]">
          <ForgeEmpty message={t("forgeAwaiting")} />
        </div>
      );
    }
    switch (view) {
      case "jobs":
        return <ForgeJobs jobs={jobs} client={client} />;
      case "outputs":
        return <ForgeOutputs jobs={jobs} client={client} />;
      case "datasets":
        return <ForgeDatasets jobs={jobs} />;
      case "gpu":
        return (
          <div className="p-3 space-y-3">
            <ComputeMetricsCard />
            <ComputeClusterCard />
          </div>
        );
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div
        className="flex items-center gap-1 p-2 border-b border-border-default"
        role="group"
        aria-label="Atlas Forge"
      >
        {(Object.keys(VIEW_KEYS) as ForgeView[]).map((v) => (
          <button
            key={v}
            type="button"
            aria-pressed={view === v}
            onClick={() => setView(v)}
            className={cn(
              "text-[11px] px-2.5 py-1 rounded transition-colors",
              view === v
                ? "bg-accent-primary/20 text-accent-primary"
                : "text-text-tertiary hover:text-text-secondary",
            )}
          >
            {t(VIEW_KEYS[v])}
          </button>
        ))}
      </div>
      <div className="flex-1 overflow-y-auto">{body()}</div>
    </div>
  );
}
