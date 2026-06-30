"use client";

/**
 * @module ComputeOverview
 * @description Per-node overview for the `compute` profile (NPU-only
 * boards used as headless inference / mesh / relay companions, no FC,
 * no video pipeline). Renders status, resources, compute metrics, and
 * services. Hides FC / video / RC / battery cards.
 * @license GPL-3.0-only
 */

import { useEffect, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { Boxes, ChevronRight } from "lucide-react";
import { useAgentConnectionStore } from "@/stores/agent-connection-store";
import { useAgentSystemStore } from "@/stores/agent-system-store";
import { useUiStore } from "@/stores/ui-store";
import { AgentStatusCard } from "../shared/AgentStatusCard";
import { ServiceTable } from "../shared/ServiceTable";
import { SystemResourceGauges } from "../shared/SystemResourceGauges";
import { CpuSparkline } from "../shared/CpuSparkline";
import { MemorySparkline } from "../shared/MemorySparkline";
import { GpuSparkline } from "../shared/GpuSparkline";
import { LogViewer } from "../shared/LogViewer";
import { AgentDisconnectedPage } from "../AgentDisconnectedPage";
import { StaleBanner } from "../shared/StaleBanner";
import { ComputeMetricsCard } from "../shared/ComputeMetricsCard";
import { ComputeClusterCard } from "../shared/ComputeClusterCard";
import { WorkstationBrandHeader } from "./WorkstationBrandHeader";
import { useAtlasModeStore } from "@/stores/atlas-mode-store";
import { useComputeLocalState } from "@/hooks/use-compute-local-state";

/** Two-tier column heading for the dashboard sections. */
function ColumnHeading({ children }: { children: ReactNode }) {
  return (
    <h3 className="text-[11px] font-semibold uppercase tracking-wider text-text-tertiary">
      {children}
    </h3>
  );
}

/** A card that jumps to the node-detail Forge tab (the compute workbench). Uses
 * the same pending-tab channel Cmd+K navigation uses, so it works wherever the
 * node-detail panel hosts this overview. */
function ForgeAffordance() {
  const tw = useTranslations("workstation");
  const setPendingDetailTab = useUiStore((s) => s.setPendingDetailTab);
  return (
    <button
      type="button"
      onClick={() => setPendingDetailTab("forge")}
      className="group flex w-full items-center justify-between rounded-lg border border-border-default bg-bg-secondary p-4 text-left transition-colors hover:border-accent-primary/40"
    >
      <div className="flex items-center gap-2.5">
        <div className="flex h-8 w-8 items-center justify-center rounded bg-accent-primary/10">
          <Boxes className="h-4 w-4 text-accent-primary" />
        </div>
        <div>
          <div className="text-xs font-medium text-text-primary">
            {tw("dash.openForge")}
          </div>
          <div className="text-[10px] text-text-tertiary">
            {tw("dash.forgeHint")}
          </div>
        </div>
      </div>
      <ChevronRight className="h-4 w-4 text-text-tertiary transition-transform group-hover:translate-x-0.5 group-hover:text-accent-primary" />
    </button>
  );
}

export function ComputeOverview({ nodeId }: { nodeId?: string }) {
  // Local-first: poll this compute node's cluster status directly when
  // LAN-paired (signed out), feeding the same store the cloud heartbeat feeds.
  useComputeLocalState(nodeId);
  const t = useTranslations("agent");
  const tw = useTranslations("workstation");
  const connected = useAgentConnectionStore((s) => s.connected);
  const status = useAgentSystemStore((s) => s.status);
  const services = useAgentSystemStore((s) => s.services);
  const resources = useAgentSystemStore((s) => s.resources);
  const logs = useAgentSystemStore((s) => s.logs);
  const processCpu = useAgentSystemStore((s) => s.processCpuPercent);
  const processMemMb = useAgentSystemStore((s) => s.processMemoryMb);
  const fetchServices = useAgentSystemStore((s) => s.fetchServices);
  const fetchResources = useAgentSystemStore((s) => s.fetchResources);
  const fetchLogs = useAgentSystemStore((s) => s.fetchLogs);
  const restartService = useAgentSystemStore((s) => s.restartService);
  const atlasEnabled = useAtlasModeStore((s) => s.enabled);

  useEffect(() => {
    if (connected) {
      fetchServices();
      fetchResources();
      fetchLogs();
    }
  }, [connected, fetchServices, fetchResources, fetchLogs]);

  if (!status) {
    if (!connected) return <AgentDisconnectedPage />;
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <div className="w-5 h-5 border-2 border-accent-primary border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-text-secondary">{t("waitingForStatus")}</p>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      <StaleBanner />
      <WorkstationBrandHeader status={status} />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        {/* GPU · Compute */}
        <section className="space-y-3">
          <ColumnHeading>{tw("dash.gpuCompute")}</ColumnHeading>
          <ComputeMetricsCard profile="workstation" />
          <GpuSparkline />
        </section>

        {/* System */}
        <section className="space-y-3">
          <ColumnHeading>{tw("dash.system")}</ColumnHeading>
          <AgentStatusCard status={status} profile="workstation" />
          {resources && <SystemResourceGauges resources={resources} />}
          <CpuSparkline />
          <MemorySparkline />
        </section>

        {/* World Model */}
        <section className="space-y-3">
          <ColumnHeading>{tw("dash.worldModel")}</ColumnHeading>
          {atlasEnabled && <ComputeClusterCard />}
          <ForgeAffordance />
        </section>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <LogViewer logs={logs} onRefresh={fetchLogs} />
        <ServiceTable
          services={services}
          onRestart={restartService}
          onRestartAll={() => restartService("ados-supervisor")}
          processCpu={processCpu}
          processMemoryMb={processMemMb}
        />
      </div>
    </div>
  );
}
