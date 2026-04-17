"use client";

/**
 * @module HardwareMeshPage
 * @description batman-adv mesh health, neighbors, gateways, and the log
 * aggregator stub. Polls /mesh/* at 3 s while visible. Pauses on
 * document.hidden. Live updates from /ws/mesh patch the slice without
 * needing the poll, so the cadence here is just a recovery from missed
 * frames.
 * @license GPL-3.0-only
 */

import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { useGroundStationStore } from "@/stores/ground-station-store";
import { useAgentConnectionStore } from "@/stores/agent-connection-store";
import { groundStationApiFromAgent } from "@/lib/api/ground-station-api";
import { MeshHealthCard } from "@/components/hardware/MeshHealthCard";
import { MeshNeighborsTable } from "@/components/hardware/MeshNeighborsTable";
import { MeshGatewaysTable } from "@/components/hardware/MeshGatewaysTable";
import { MeshLogAggregator } from "@/components/hardware/MeshLogAggregator";

const POLL_INTERVAL_MS = 3000;

export default function HardwareMeshPage() {
  const t = useTranslations("hardware.mesh");
  const agentUrl = useAgentConnectionStore((s) => s.agentUrl);
  const apiKey = useAgentConnectionStore((s) => s.apiKey);
  const loadRole = useGroundStationStore((s) => s.loadRole);
  const loadMesh = useGroundStationStore((s) => s.loadMesh);
  const role = useGroundStationStore((s) => s.role.info?.current ?? "direct");
  const meshError = useGroundStationStore((s) => s.mesh.error);

  useEffect(() => {
    const api = groundStationApiFromAgent(agentUrl, apiKey);
    if (!api) return;
    let cancelled = false;
    const poll = async () => {
      if (cancelled || document.hidden) return;
      await loadRole(api);
      await loadMesh(api);
    };
    poll();
    const interval = setInterval(poll, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [agentUrl, apiKey, loadRole, loadMesh]);

  if (role === "direct") {
    return (
      <div className="px-4 py-6 text-center text-text-secondary">
        {t("emptyDirect")}
      </div>
    );
  }

  return (
    <div className="px-4 py-4 flex flex-col gap-4">
      <MeshHealthCard />
      <MeshNeighborsTable />
      <MeshGatewaysTable />
      <MeshLogAggregator />
      {meshError ? (
        <div className="text-sm text-status-error">{meshError}</div>
      ) : null}
    </div>
  );
}
