"use client";

/**
 * @module CommandFleetOverview
 * @description All-paired-agent Command entry screen.
 * @license GPL-3.0-only
 */

import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import { Activity, Cpu, Radio, Video, WifiOff } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PairedDrone } from "@/stores/pairing-store";
import { useCommandFleetStore, type CommandCloudStatus } from "@/stores/command-fleet-store";
import { STALE_THRESHOLD_MS, useClockTick } from "@/lib/agent/freshness";
import { useCommandAgentFleet } from "@/hooks/use-command-agent-fleet";
import { AgentFeedTile } from "./AgentFeedTile";

const MAX_ACTIVE_FEEDS = 4;

type Filter = "all" | "live" | "video" | "offline";

interface CommandFleetOverviewProps {
  pairedDrones: PairedDrone[];
  onOpenAgent: (deviceId: string) => void;
  onOpenPairing: () => void;
}

function canRunVideo(
  drone: PairedDrone,
  status: CommandCloudStatus | undefined,
  pausedIds: Set<string>,
): boolean {
  if (pausedIds.has(drone.deviceId)) return false;
  if (!status) return false;
  const hasVideoUrl = Boolean(status?.videoWhepUrl)
    || Boolean(status.lastIp && status.videoWhepPort && status.videoWhepPort > 0);
  if (!hasVideoUrl) return false;
  if (status.videoState !== "running") return false;
  const lastSeen = Math.max(drone.lastSeen ?? 0, status.updatedAt ?? 0);
  return Date.now() - lastSeen < STALE_THRESHOLD_MS;
}

export function CommandFleetOverview({
  pairedDrones,
  onOpenAgent,
  onOpenPairing,
}: CommandFleetOverviewProps) {
  const t = useTranslations("commandFleet");
  const cloudStatuses = useCommandFleetStore((s) => s.cloudStatuses);
  const [pinnedIds, setPinnedIds] = useState<Set<string>>(new Set());
  const [pausedIds, setPausedIds] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState<Filter>("all");

  // Shared 1Hz tick makes liveness and "last seen" labels age without
  // waiting for a query or MQTT event.
  useClockTick();

  const activeVideoIds = useMemo(() => {
    const candidates = pairedDrones
      .filter((drone) => canRunVideo(drone, cloudStatuses[drone.deviceId], pausedIds))
      .sort((a, b) => {
        const pinnedDelta = Number(pinnedIds.has(b.deviceId)) - Number(pinnedIds.has(a.deviceId));
        if (pinnedDelta !== 0) return pinnedDelta;
        const aSeen = Math.max(a.lastSeen ?? 0, cloudStatuses[a.deviceId]?.updatedAt ?? 0);
        const bSeen = Math.max(b.lastSeen ?? 0, cloudStatuses[b.deviceId]?.updatedAt ?? 0);
        return bSeen - aSeen || a.name.localeCompare(b.name);
      })
      .slice(0, MAX_ACTIVE_FEEDS)
      .map((drone) => drone.deviceId);
    return new Set(candidates);
  }, [cloudStatuses, pairedDrones, pausedIds, pinnedIds]);

  const agents = useCommandAgentFleet(pairedDrones, activeVideoIds, pausedIds);

  const filteredAgents = useMemo(() => {
    if (filter === "live") return agents.filter((agent) => agent.liveness === "live");
    if (filter === "video") return agents.filter((agent) => agent.video.whepUrl);
    if (filter === "offline") return agents.filter((agent) => agent.liveness !== "live");
    return agents;
  }, [agents, filter]);

  const stats = useMemo(() => ({
    total: agents.length,
    live: agents.filter((agent) => agent.liveness === "live").length,
    stale: agents.filter((agent) => agent.liveness === "stale").length,
    offline: agents.filter((agent) => agent.liveness === "offline").length,
    video: agents.filter((agent) => agent.video.state === "live").length,
    fc: agents.filter((agent) => agent.system.fcConnected).length,
  }), [agents]);

  function toggleSet(setter: (next: Set<string>) => void, current: Set<string>, id: string) {
    const next = new Set(current);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setter(next);
  }

  if (pairedDrones.length === 0) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <div className="max-w-sm text-center">
          <Cpu size={32} className="mx-auto text-text-tertiary" />
          <h2 className="mt-4 text-lg font-semibold text-text-primary">
            {t("noAgentsTitle")}
          </h2>
          <p className="mt-2 text-sm text-text-secondary">
            {t("noAgentsBody")}
          </p>
          <button
            type="button"
            onClick={onOpenPairing}
            className="mt-4 rounded bg-accent-primary px-3 py-2 text-sm font-medium text-white hover:opacity-90"
          >
            {t("pairAgent")}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-3 md:p-4">
      <div className="mb-3 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <h1 className="text-lg font-semibold text-text-primary">
            {t("title")}
          </h1>
          <p className="text-xs text-text-tertiary">
            {t("subtitle")}
          </p>
        </div>

        <div className="grid grid-cols-3 gap-2 md:flex md:flex-wrap">
          <Stat icon={<Cpu size={13} />} label={t("total")} value={stats.total} />
          <Stat icon={<Activity size={13} />} label={t("live")} value={stats.live} tone="success" />
          <Stat icon={<Radio size={13} />} label={t("stale")} value={stats.stale} tone="warning" />
          <Stat icon={<WifiOff size={13} />} label={t("offline")} value={stats.offline} />
          <Stat icon={<Video size={13} />} label={t("videoLive")} value={stats.video} tone="accent" />
          <Stat icon={<Cpu size={13} />} label={t("fc")} value={stats.fc} />
        </div>
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        {(["all", "live", "video", "offline"] as const).map((id) => (
          <button
            key={id}
            type="button"
            onClick={() => setFilter(id)}
            className={cn(
              "rounded px-2.5 py-1 text-xs font-medium transition-colors",
              filter === id
                ? "bg-accent-primary text-white"
                : "bg-bg-secondary text-text-secondary hover:text-text-primary border border-border-default",
            )}
          >
            {t(`filter.${id}`)}
          </button>
        ))}
        <span className="ml-auto text-[11px] text-text-tertiary">
          {t("feedBudget", { active: activeVideoIds.size, max: MAX_ACTIVE_FEEDS })}
        </span>
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2 2xl:grid-cols-3">
        {filteredAgents.map((agent) => (
          <AgentFeedTile
            key={agent.identity.deviceId}
            agent={agent}
            pinned={pinnedIds.has(agent.identity.deviceId)}
            paused={pausedIds.has(agent.identity.deviceId)}
            onOpen={onOpenAgent}
            onTogglePin={(id) => toggleSet(setPinnedIds, pinnedIds, id)}
            onTogglePause={(id) => toggleSet(setPausedIds, pausedIds, id)}
          />
        ))}
      </div>

      {filteredAgents.length === 0 && (
        <div className="mt-10 text-center text-sm text-text-tertiary">
          {t("noFilterMatches")}
        </div>
      )}
    </div>
  );
}

function Stat({
  icon,
  label,
  value,
  tone,
}: {
  icon: ReactNode;
  label: string;
  value: number;
  tone?: "success" | "warning" | "accent";
}) {
  return (
    <div className="min-w-24 rounded border border-border-default bg-bg-secondary px-2.5 py-2">
      <div className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-text-tertiary">
        {icon}
        <span>{label}</span>
      </div>
      <div
        className={cn(
          "mt-1 text-lg font-semibold text-text-primary",
          tone === "success" && "text-status-success",
          tone === "warning" && "text-status-warning",
          tone === "accent" && "text-accent-primary",
        )}
      >
        {value}
      </div>
    </div>
  );
}
