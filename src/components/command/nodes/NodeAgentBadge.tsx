"use client";

/**
 * @module nodes/NodeAgentBadge
 * @description The "AGENT" badge shown on a companion-paired drone (a drone with
 * an onboard computer running the ADOS agent) — the visible differentiator from
 * an FC-only drone. Hovering reveals a compact companion summary (board,
 * CPU/MEM/temp, services, capability chips) as progressive disclosure, so an
 * operator can glance the onboard state without opening the node.
 * @license GPL-3.0-only
 */

import type { ReactNode } from "react";
import { Cpu } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Tooltip } from "@/components/ui/tooltip";
import { useCommandFleetStore } from "@/stores/command-fleet-store";

function fmtPct(v?: number | null): string {
  return v != null ? `${Math.round(v)}%` : "—";
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-border-default bg-bg-primary px-1.5 py-1 text-center">
      <p className="text-[8px] uppercase tracking-wider text-text-tertiary">{label}</p>
      <p className="font-mono text-[11px] text-text-primary">{value}</p>
    </div>
  );
}

function Chip({ children }: { children: ReactNode }) {
  return (
    <span className="rounded bg-bg-tertiary px-1.5 py-0.5 text-[9px] text-text-secondary">
      {children}
    </span>
  );
}

export function NodeAgentBadge({
  deviceId,
  board,
  tier,
}: {
  deviceId: string;
  board?: string;
  tier?: number;
}) {
  const status = useCommandFleetStore((s) => s.cloudStatuses[deviceId]);
  const running = status?.services?.filter((sv) => sv.status === "running").length ?? 0;
  const total = status?.services?.length ?? 0;

  const content = (
    <div className="w-56 space-y-2">
      <div>
        <p className="text-xs font-medium text-text-primary">Onboard computer</p>
        <p className="text-[10px] text-text-tertiary">
          {board ?? "Companion"}
          {tier != null ? ` · Tier ${tier}` : ""}
        </p>
      </div>
      <div className="grid grid-cols-3 gap-1.5">
        <Metric label="CPU" value={fmtPct(status?.cpuPercent)} />
        <Metric label="MEM" value={fmtPct(status?.memoryPercent)} />
        <Metric
          label="TEMP"
          value={status?.temperature != null ? `${Math.round(status.temperature)}°` : "—"}
        />
      </div>
      <p className="text-[10px] text-text-tertiary">
        {running}/{total} services running · video {status?.videoState ?? "—"}
      </p>
      <div className="flex flex-wrap gap-1">
        <Chip>Video</Chip>
        <Chip>Vision</Chip>
        <Chip>World Model</Chip>
        <Chip>Compute</Chip>
      </div>
      <p className="text-[9px] text-text-tertiary">
        Open the drone {"→"} Onboard Computer for live video, vision, and compute.
      </p>
    </div>
  );

  return (
    <Tooltip content={content} position="right" multiline>
      <Badge variant="success" className="gap-1 rounded normal-case tracking-normal">
        <Cpu size={9} />
        FC + SBC
      </Badge>
    </Tooltip>
  );
}
