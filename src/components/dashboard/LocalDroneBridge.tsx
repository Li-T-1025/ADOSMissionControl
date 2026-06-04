"use client";

/**
 * @module LocalDroneBridge
 * @description Projects LAN-paired (browser-local, no cloud account) agent
 * nodes into the Dashboard fleet store so they appear and are selectable in the
 * unified drone list. The cloud projector (CloudDroneBridge) only sees
 * Convex-paired drones; without this bridge a locally-paired node would be
 * invisible once the separate Command tab is retired, breaking the local-first
 * path. A node that is also cloud-paired is left to CloudDroneBridge so it is
 * not listed twice.
 * @license GPL-3.0-only
 */

import { useEffect, useRef } from "react";
import { useFleetStore } from "@/stores/fleet-store";
import { useLocalNodesStore } from "@/stores/local-nodes-store";
import { usePairingStore } from "@/stores/pairing-store";
import { useCommandFleetStore } from "@/stores/command-fleet-store";
import { STALE_THRESHOLD_MS } from "@/lib/agent/freshness";
import type { FleetDrone } from "@/lib/types/drone";

export function LocalDroneBridge() {
  const trackedIds = useRef<Set<string>>(new Set());
  const nodes = useLocalNodesStore((s) => s.nodes);
  const pairedDrones = usePairingStore((s) => s.pairedDrones);
  const cloudStatuses = useCommandFleetStore((s) => s.cloudStatuses);

  useEffect(() => {
    const fleet = useFleetStore.getState();
    const now = Date.now();
    const current = new Set<string>();
    // deviceIds that are also cloud-paired. We only defer to the cloud row
    // for these when the cloud row is actually live: the cloud projector
    // drops the row once its heartbeat goes stale, so an unconditional skip
    // here would make a still-LAN-reachable node vanish. Local-first means
    // the LAN row resurrects it.
    const cloudDeviceIds = new Set(pairedDrones.map((d) => d.deviceId));

    for (const node of nodes) {
      const cloudFleetId = `cloud-${node.deviceId}`;
      if (cloudDeviceIds.has(node.deviceId)) {
        const cloudStatus = cloudStatuses[node.deviceId];
        const cloudFresh =
          cloudStatus != null && now - cloudStatus.updatedAt < STALE_THRESHOLD_MS;
        // The cloud row exists only while the cloud projector considers the
        // node online. When it is present we let it own the row and skip the
        // local projection — but we hold the local row until the cloud row
        // has actually landed so the device never blinks out across the
        // local→cloud handoff.
        const cloudRowPresent = fleet.drones.some((d) => d.id === cloudFleetId);
        if (cloudFresh && cloudRowPresent) continue;
      }
      const fleetId = `local-${node.deviceId}`;
      current.add(fleetId);

      const status = cloudStatuses[node.deviceId];
      const lastSeen = status?.updatedAt ?? node.lastSeenAt ?? 0;
      const online = now - lastSeen < STALE_THRESHOLD_MS;

      const profile: FleetDrone["profile"] =
        node.profile === "ground-station" || node.profile === "compute"
          ? node.profile
          : "drone";

      const drone: FleetDrone = {
        id: fleetId,
        name: node.name || `Agent ${node.deviceId.slice(0, 8)}`,
        status: online ? "online" : "offline",
        connectionState: online ? "connected" : "disconnected",
        flightMode: "STABILIZE",
        armState: "disarmed",
        lastHeartbeat: lastSeen,
        firmwareVersion: node.version,
        healthScore: online ? 80 : 0,
        hasAgent: true,
        // The agent's device id, used to resolve the LAN credentials for the
        // connect-on-select path. Not a cloud-relay id; the connection goes
        // over the LAN. cloudPosture stays "local" so the card reads correctly.
        cloudDeviceId: node.deviceId,
        cloudPosture: "local",
        profile,
        role: node.role ?? undefined,
      };

      if (trackedIds.current.has(fleetId)) {
        fleet.updateDrone(fleetId, drone);
      } else {
        fleet.addDrone(drone);
        trackedIds.current.add(fleetId);
      }
    }

    for (const id of trackedIds.current) {
      if (!current.has(id)) {
        fleet.removeDrone(id);
        trackedIds.current.delete(id);
      }
    }
  }, [nodes, pairedDrones, cloudStatuses]);

  useEffect(() => {
    return () => {
      const fleet = useFleetStore.getState();
      for (const id of trackedIds.current) fleet.removeDrone(id);
      trackedIds.current.clear();
    };
  }, []);

  return null;
}
