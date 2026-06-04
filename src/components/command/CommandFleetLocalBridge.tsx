"use client";

/**
 * @module CommandFleetLocalBridge
 * @description Populates Agent Overview tile telemetry for LAN-only
 * paired nodes. The Convex-backed `CommandFleetStatusBridge` covers
 * cloud-paired drones; nodes paired locally (via the Add-a-Node form)
 * have no heartbeat row in Convex, so this bridge polls each one over
 * LAN REST and writes the result into the same `cloudStatuses` map the
 * cloud bridge writes to. Both bridges co-own the map via the
 * `upsertCloudStatuses` setter.
 * @license GPL-3.0-only
 */

import { useEffect, useRef } from "react";
import { AgentClient } from "@/lib/agent/agent-client/client";
import { useLocalNodesStore } from "@/stores/local-nodes-store";
import { useCommandFleetStore } from "@/stores/command-fleet-store";
import { mapFullStatusToCloudStatus } from "@/lib/agent/full-status-to-cloud-status";

// Lighter cadence than the single-agent System tab (3s) — overview
// tiles are quick-glance and only need refresh every few seconds.
const POLL_INTERVAL_MS = 5000;

interface CommandFleetLocalBridgeProps {
  enabled: boolean;
}

export function CommandFleetLocalBridge({
  enabled,
}: CommandFleetLocalBridgeProps) {
  const nodes = useLocalNodesStore((s) => s.nodes);
  // Per-deviceId polling timer registry. Refs (not state) because
  // mutating these should never trigger a render.
  const intervalsRef = useRef<Map<string, ReturnType<typeof setInterval>>>(
    new Map(),
  );
  // Per-deviceId "still active" gate to drop in-flight responses that
  // land after we've cleaned up the node (StrictMode double-mount,
  // node removal during a pending fetch, etc.).
  const aliveRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const intervals = intervalsRef.current;
    const alive = aliveRef.current;

    function stop(deviceId: string) {
      const handle = intervals.get(deviceId);
      if (handle) clearInterval(handle);
      intervals.delete(deviceId);
      alive.delete(deviceId);
    }

    function stopAll() {
      const ids = Array.from(intervals.keys());
      for (const id of ids) stop(id);
      if (ids.length > 0) {
        useCommandFleetStore.getState().removeCloudStatuses(ids);
      }
    }

    // Disabled or wrong protocol → tear everything down. Browsers
    // block mixed-content fetches to http://*.local from an https
    // origin, so https deployments route LAN nodes through the cloud
    // relay instead (see `selectNode` in node-click-handler).
    if (!enabled) {
      stopAll();
      return;
    }
    if (typeof window !== "undefined" && window.location.protocol === "https:") {
      stopAll();
      return;
    }

    const currentIds = new Set(nodes.map((n) => n.deviceId));

    // Stop polling for nodes that disappeared from the local store.
    const droppedIds: string[] = [];
    for (const deviceId of intervals.keys()) {
      if (!currentIds.has(deviceId)) {
        droppedIds.push(deviceId);
      }
    }
    for (const id of droppedIds) stop(id);
    if (droppedIds.length > 0) {
      useCommandFleetStore.getState().removeCloudStatuses(droppedIds);
    }

    // Start polling for nodes we don't already have a timer for.
    for (const node of nodes) {
      if (intervals.has(node.deviceId)) continue;
      alive.add(node.deviceId);

      const deviceId = node.deviceId;

      async function tick() {
        if (!alive.has(deviceId)) return;
        // Read the node's fields fresh from the store every tick. The timer
        // is created once and never recreated on rename / IP change (the
        // reconciliation effect skips deviceIds that already have a timer),
        // so capturing hostname / apiKey / name at creation time would poll
        // a stale identity forever. Looking them up live keeps the poll in
        // step with the operator's edits.
        const live = useLocalNodesStore
          .getState()
          .nodes.find((n) => n.deviceId === deviceId);
        if (!live) return;
        try {
          const client = new AgentClient(live.hostname, live.apiKey);
          const resp = await client.getFullStatus();
          if (!alive.has(deviceId)) return;
          if (!resp) return; // older agent that lacks /api/status/full
          const row = mapFullStatusToCloudStatus(resp, {
            deviceId,
            mdnsHost: live.mdnsHost,
            lastIp: live.ipv4,
            name: live.name,
            hostname: live.hostname,
          });
          useCommandFleetStore.getState().upsertCloudStatuses([row]);
          useLocalNodesStore.getState().touchLastSeen(deviceId);
        } catch {
          // Swallow — the tile degrades to offline via the freshness
          // watchdog reading `lastSeenAt`. We do not want a single bad
          // network round to crash the overview grid.
        }
      }

      void tick();
      intervals.set(deviceId, setInterval(tick, POLL_INTERVAL_MS));
    }
  }, [nodes, enabled]);

  // Unmount teardown — clears any timers the reconciliation effect
  // above did not explicitly stop.
  useEffect(() => {
    return () => {
      const intervals = intervalsRef.current;
      const alive = aliveRef.current;
      for (const handle of intervals.values()) clearInterval(handle);
      intervals.clear();
      alive.clear();
    };
  }, []);

  return null;
}
