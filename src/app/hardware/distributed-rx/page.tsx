"use client";

/**
 * @module HardwareDistributedRxPage
 * @description Hardware sub-view for the distributed receive role.
 * Polls /role and the role-specific WFB endpoints at 2 Hz while the
 * tab is visible. Pauses on document.hidden to spare the agent.
 * @license GPL-3.0-only
 */

import { useEffect } from "react";
import { useGroundStationStore } from "@/stores/ground-station-store";
import { useAgentConnectionStore } from "@/stores/agent-connection-store";
import { groundStationApiFromAgent } from "@/lib/api/ground-station-api";
import { DistributedRxPanel } from "@/components/hardware/DistributedRxPanel";

const POLL_INTERVAL_MS = 2000;

export default function HardwareDistributedRxPage() {
  const agentUrl = useAgentConnectionStore((s) => s.agentUrl);
  const apiKey = useAgentConnectionStore((s) => s.apiKey);
  const loadRole = useGroundStationStore((s) => s.loadRole);
  const loadDistributedRx = useGroundStationStore((s) => s.loadDistributedRx);

  useEffect(() => {
    const api = groundStationApiFromAgent(agentUrl, apiKey);
    if (!api) return;
    let cancelled = false;
    const poll = async () => {
      if (cancelled || document.hidden) return;
      await loadRole(api);
      await loadDistributedRx(api);
    };
    poll();
    const interval = setInterval(poll, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [agentUrl, apiKey, loadRole, loadDistributedRx]);

  return (
    <div className="px-4 py-4">
      <DistributedRxPanel />
    </div>
  );
}
