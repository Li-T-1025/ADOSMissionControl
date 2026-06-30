"use client";

/**
 * @module WorkstationBrandHeader
 * @description Branded "ADOS Workstation" hero for the workstation overview.
 * Identity (chip + host) on the right, a one-line cluster summary
 * ("Master · N workers idle · M jobs queued") underneath. Reads the live GPU /
 * cluster snapshot off the compute store; degrades to a calm "awaiting compute
 * telemetry" line before the first poll lands.
 * @license GPL-3.0-only
 */

import { useTranslations } from "next-intl";
import { Cpu } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AgentStatus } from "@/lib/agent/types";
import { useComputeStore } from "@/stores/compute-store";

export function WorkstationBrandHeader({ status }: { status: AgentStatus }) {
  const t = useTranslations("workstation");
  const gpu = useComputeStore((s) => s.gpu);
  const cluster = useComputeStore((s) => s.cluster);

  const host = status.board?.name || status.board?.model || "—";
  const chip = status.board?.soc ?? null;

  const role = cluster.role;
  const roleLabel =
    role === "master"
      ? t("brand.roleMaster")
      : role === "slave"
        ? t("brand.roleSlave")
        : t("brand.roleStandalone");
  // Prefer the cluster-aggregate idle figure (master + slaves); fall back to
  // this node's own idle count.
  const idle = cluster.aggregateWorkersIdle ?? cluster.workersIdle;
  const queued = cluster.queueDepth;

  const summary =
    role !== null && idle != null && queued != null
      ? t("brand.summary", { role: roleLabel, idle, queued })
      : t("brand.awaiting");

  return (
    <div className="relative overflow-hidden rounded-xl border border-border-default bg-gradient-to-br from-accent-primary/10 via-bg-secondary to-bg-secondary p-5">
      {/* Soft brand glow */}
      <div
        className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-accent-primary/10 blur-2xl"
        aria-hidden
      />
      <div className="relative flex items-center gap-4">
        <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-lg bg-accent-primary/15 ring-1 ring-accent-primary/30">
          <Cpu className="h-6 w-6 text-accent-primary" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold text-text-primary">
              {t("brand.title")}
            </h2>
            {gpu?.metal && (
              <span className="rounded bg-accent-primary/15 px-1.5 py-0.5 text-[10px] font-medium text-accent-primary">
                {t("brand.metal")}
              </span>
            )}
          </div>
          <p className="text-xs text-text-tertiary">{t("brand.tagline")}</p>
        </div>
        <div className="hidden flex-col items-end gap-0.5 text-right sm:flex">
          <span className="max-w-[220px] truncate font-mono text-sm text-text-primary">
            {host}
          </span>
          {chip && (
            <span className="max-w-[220px] truncate font-mono text-[11px] text-text-secondary">
              {chip}
            </span>
          )}
        </div>
      </div>
      <div className="relative mt-3 flex items-center gap-1.5 border-t border-border-default/60 pt-3 text-[11px] text-text-secondary">
        <span
          className={cn(
            "h-1.5 w-1.5 flex-shrink-0 rounded-full",
            role !== null ? "bg-status-success" : "bg-text-tertiary/60",
          )}
        />
        <span>{summary}</span>
      </div>
    </div>
  );
}
