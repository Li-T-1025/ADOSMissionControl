"use client";

/**
 * @module use-compute-jobs
 * @description Local-first source for a compute node's reconstruction / offload
 * jobs. A LAN-paired compute node is not necessarily beaconing to Convex
 * (Rule 39), and the job API lives on the engine's own `:8092` listener (not the
 * cloud heartbeat), so the Forge workbench polls the node directly. Mirrors
 * `use-compute-local-state`'s gating: inert unless local-first, the Atlas flag
 * is on, a node is selected, a LAN key is held, and the node is not the active
 * cloud-relay device. Returns the job list plus a client for on-demand reads
 * (outputs) and writes (cancel). Stops on unmount.
 *
 * @license GPL-3.0-only
 */

import { useEffect, useMemo, useState } from "react";

import {
  ComputeAgentClient,
  type ComputeJob,
} from "@/lib/agent/compute-client";
import { isDemoMode } from "@/lib/utils";
import { useAgentConnectionStore } from "@/stores/agent-connection-store";
import { useAtlasModeStore } from "@/stores/atlas-mode-store";
import { useLocalNodesStore } from "@/stores/local-nodes-store";

/** How often to poll the node's job list, in ms. Jobs are slow-moving, so a
 * 2 s cadence is plenty (the engine state machine ticks far slower). */
export const COMPUTE_JOBS_POLL_INTERVAL_MS = 2000;

export interface ComputeJobsState {
  jobs: ComputeJob[];
  /** True until the first poll resolves (the workbench shows a spinner). */
  loading: boolean;
  /** True when the job API is unreachable (404 / transport / no LAN client) —
   * the workbench shows a calm "awaiting compute node" state, not an error. */
  unreachable: boolean;
  /** A client for on-demand reads (outputs) + writes (cancel), or null when
   * not local-first for this node (signed in, demo, cloud, no LAN key). */
  client: ComputeAgentClient | null;
}

/**
 * Poll the selected compute node's job API and return its jobs + a client.
 * No-op (client null, empty jobs) when not local-first for the node, when the
 * Atlas flag is off, or when no node is selected.
 *
 * @param nodeId The selected compute node's device id, or null/undefined.
 */
export function useComputeJobs(
  nodeId: string | null | undefined,
): ComputeJobsState {
  const atlasEnabled = useAtlasModeStore((s) => s.enabled);
  const cloudDeviceId = useAgentConnectionStore((s) => s.cloudDeviceId);
  const node = useLocalNodesStore((s) =>
    nodeId ? s.nodes.find((n) => n.deviceId === nodeId) : undefined,
  );

  const host = node?.hostname ?? "";
  const apiKey = node?.apiKey ?? "";
  // A locally-paired node (present in local-nodes-store with host + apiKey) is
  // reached over the LAN regardless of cloud auth (local-first, Rule 39). The
  // `cloudDeviceId !== nodeId` guard is what keeps us off the one node the cloud
  // bridge drives — being signed in is NOT a reason to stop polling a workstation
  // that runs its own compute on the same box.
  const active =
    atlasEnabled &&
    !isDemoMode() &&
    Boolean(nodeId) &&
    Boolean(host) &&
    Boolean(apiKey) &&
    cloudDeviceId !== nodeId;

  // The client is a pure derivation of the active LAN target, so memoizing it
  // (rather than storing it via the effect) keeps the effect free of in-body
  // setState — and its identity drives the poll.
  const client = useMemo(
    () => (active ? new ComputeAgentClient(host, apiKey) : null),
    [active, host, apiKey],
  );
  // The poll result is tagged with the target it came from, so a node switch
  // never surfaces the previous node's jobs while the new poll is in flight.
  const clientKey = active ? `${host}|${apiKey}` : "";
  const [poll, setPoll] = useState<{
    key: string;
    jobs: ComputeJob[];
    unreachable: boolean;
  }>({ key: "", jobs: [], unreachable: false });

  useEffect(() => {
    if (!client) return;
    let cancelled = false;
    const pollOnce = async () => {
      const result = await client.listJobs();
      if (cancelled) return;
      setPoll(
        result === null
          ? { key: clientKey, jobs: [], unreachable: true }
          : { key: clientKey, jobs: result, unreachable: false },
      );
    };
    void pollOnce();
    const handle = setInterval(
      () => void pollOnce(),
      COMPUTE_JOBS_POLL_INTERVAL_MS,
    );
    return () => {
      cancelled = true;
      clearInterval(handle);
    };
  }, [client, clientKey]);

  const fresh = clientKey !== "" && poll.key === clientKey;
  return {
    jobs: fresh ? poll.jobs : [],
    loading: active && !fresh,
    unreachable: fresh ? poll.unreachable : false,
    client,
  };
}
