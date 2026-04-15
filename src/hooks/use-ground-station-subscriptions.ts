"use client";

/**
 * @module use-ground-station-subscriptions
 * @description Shared hook that wires both PIC and Uplink WebSocket event
 * subscriptions into the ground-station store for a given agent connection.
 *
 * Extracted from hardware/page.tsx so the GroundStationApi client is built
 * once per (agentUrl, apiKey) tuple via useMemo. The previous inline effects
 * rebuilt the client on every render, which caused short-lived duplicate
 * WebSocket subscriptions during fast re-renders.
 *
 * When a clientId is supplied and the local client holds PIC, the hook also
 * drives the /pic/heartbeat poll so the agent knows this client is alive.
 *
 * @license GPL-3.0-only
 */

import { useEffect, useMemo } from "react";
import {
  GroundStationApi,
  groundStationApiFromAgent,
} from "@/lib/api/ground-station-api";
import { useGroundStationStore } from "@/stores/ground-station-store";

export function useGroundStationSubscriptions(
  agentUrl: string | null,
  apiKey: string | null,
  clientId?: string,
): GroundStationApi | null {
  const client = useMemo(
    () => groundStationApiFromAgent(agentUrl, apiKey),
    [agentUrl, apiKey],
  );

  const subscribePicWs = useGroundStationStore((s) => s.subscribePicWs);
  const subscribeUplinkWs = useGroundStationStore((s) => s.subscribeUplinkWs);
  const pollPicHeartbeat = useGroundStationStore((s) => s.pollPicHeartbeat);
  const claimedBy = useGroundStationStore((s) => s.pic.claimed_by);

  useEffect(() => {
    if (!client) return;
    const unsubPic = subscribePicWs(client);
    const unsubUplink = subscribeUplinkWs(client);
    return () => {
      unsubPic();
      unsubUplink();
    };
  }, [client, subscribePicWs, subscribeUplinkWs]);

  useEffect(() => {
    if (!client) return;
    if (!clientId) return;
    if (claimedBy !== clientId) return;
    const stop = pollPicHeartbeat(client, clientId);
    return () => {
      stop();
    };
  }, [client, clientId, claimedBy, pollPicHeartbeat]);

  return client;
}
