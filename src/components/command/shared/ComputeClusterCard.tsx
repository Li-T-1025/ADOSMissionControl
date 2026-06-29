"use client";

/**
 * @module ComputeClusterCard
 * @description Compact compute-cluster status card for the ComputeOverview.
 * Shows the node's role (master / slave), its job-queue depth and worker
 * occupancy, the cluster's aggregate idle capacity, and any registered
 * slave nodes. Renders an "awaiting heartbeat" state until a compute-profile
 * heartbeat populates the store. Mounted behind the Atlas flag.
 * @license GPL-3.0-only
 */

import { Boxes, Cpu, Layers } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { useComputeStore } from "@/stores/compute-store";

interface ComputeClusterCardProps {
  className?: string;
}

function num(v: number | null): string {
  return v === null ? "—" : String(v);
}

function roleBadgeClass(role: string): string {
  if (role === "master") return "bg-accent-primary/15 text-accent-primary";
  if (role === "slave") return "bg-white/[0.06] text-text-secondary";
  return "bg-white/[0.04] text-text-tertiary";
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded bg-white/[0.02] px-2 py-1.5 text-center">
      <div className="text-sm font-mono text-text-primary tabular-nums">{value}</div>
      <div className="text-[9px] uppercase tracking-wide text-text-tertiary">
        {label}
      </div>
    </div>
  );
}

export function ComputeClusterCard({ className }: ComputeClusterCardProps) {
  const t = useTranslations("atlas");
  const cluster = useComputeStore((s) => s.cluster);

  if (cluster.role === null) {
    return (
      <div
        className={cn("border border-border-default rounded-lg p-4", className)}
      >
        <div className="flex items-center gap-1.5 mb-3">
          <Boxes className="w-3.5 h-3.5 text-text-tertiary" />
          <span className="text-xs font-medium text-text-secondary">
            {t("computeCluster")}
          </span>
        </div>
        <div className="text-[10px] text-text-tertiary text-center py-3">
          {t("awaitingHeartbeat")}
        </div>
      </div>
    );
  }

  const badgeCls = roleBadgeClass(cluster.role);
  const badgeLabel =
    cluster.role === "master"
      ? t("master")
      : cluster.role === "slave"
        ? t("slave")
        : cluster.role;

  return (
    <div
      className={cn(
        "border border-border-default rounded-lg p-4 space-y-3",
        className,
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Boxes className="w-3.5 h-3.5 text-text-tertiary" />
          <span className="text-xs font-medium text-text-secondary">
            {t("computeCluster")}
          </span>
        </div>
        <span
          className={cn(
            "text-[10px] font-medium px-1.5 py-0.5 rounded",
            badgeCls,
          )}
        >
          {badgeLabel}
        </span>
      </div>

      {/* This node's queue + workers */}
      <div className="grid grid-cols-3 gap-2">
        <Stat label={t("queue")} value={num(cluster.queueDepth)} />
        <Stat label={t("active")} value={num(cluster.activeJobs)} />
        <Stat label={t("idle")} value={num(cluster.workersIdle)} />
      </div>

      {/* Cluster aggregate idle capacity (master + all slaves) */}
      <div className="flex items-center justify-between border-t border-border-default pt-2">
        <span className="text-[10px] text-text-secondary flex items-center gap-1">
          <Layers className="w-3 h-3 text-text-tertiary" />
          {t("clusterIdleWorkers")}
        </span>
        <span className="text-[10px] font-mono text-text-primary tabular-nums">
          {num(cluster.aggregateWorkersIdle)}
        </span>
      </div>

      {cluster.masterId && (
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-text-tertiary">{t("master")}</span>
          <span
            className="text-[10px] font-mono text-text-secondary truncate max-w-[60%]"
            title={cluster.masterId}
          >
            {cluster.masterId}
          </span>
        </div>
      )}

      {/* Registered slave nodes */}
      {cluster.slaves.length > 0 && (
        <div className="pt-2 border-t border-border-default space-y-1.5">
          <span className="text-[10px] text-text-tertiary">
            {t("slaves")} ({cluster.slaves.length})
          </span>
          {cluster.slaves.map((s) => (
            <div
              key={s.nodeId}
              className="flex items-center gap-2 px-2 py-1 rounded bg-white/[0.02]"
            >
              <Cpu size={10} className="text-text-tertiary flex-shrink-0" />
              <span
                className="text-[10px] font-mono text-text-secondary truncate"
                title={
                  s.accelerators.length > 0
                    ? s.accelerators.join(", ")
                    : s.nodeId
                }
              >
                {s.nodeId}
              </span>
              <span className="text-[10px] font-mono text-text-tertiary ml-auto flex-shrink-0 tabular-nums">
                {s.workersIdle} idle · {s.queueDepth} q
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
