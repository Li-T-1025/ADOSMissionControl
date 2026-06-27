"use client";

/**
 * @module compute-store
 * @description Focused-agent compute-node runtime telemetry: the
 * master/slave cluster view plus this node's job-queue depth and worker
 * occupancy. Mirrors the focused-agent shape of the ground-station store —
 * one slice for the node currently mapped by the status bridge.
 *
 * Two producers feed this store (both write the same `cluster` slice):
 * the cloud-relay heartbeat fan-out in `CloudStatusBridge` (via
 * `buildComputePatch`), and, on the LAN, a direct poll of the compute
 * node's status endpoint. Today only the cloud fan-out is wired; the LAN
 * poll lands with the compute heartbeat producer. The slice stays empty
 * (every field null / no slaves) until a compute-profile heartbeat
 * arrives, so the card renders an "awaiting heartbeat" state on any other
 * profile.
 *
 * @license GPL-3.0-only
 */

import { create } from "zustand";

/** One slave node registered with the master in the compute cluster. */
export interface ComputeSlave {
  nodeId: string;
  /** Accelerator ids the slave offers (e.g. "cuda:0", "mps"). */
  accelerators: string[];
  workersIdle: number;
  queueDepth: number;
}

/** The compute node's runtime status: its own queue + workers, and the
 * cluster (master id + aggregate idle capacity + registered slaves) it
 * fronts. Every scalar is null until a compute heartbeat populates it. */
export interface ComputeClusterStatus {
  /** "master" | "slave", or null before the first heartbeat. */
  role: string | null;
  masterId: string | null;
  queueDepth: number | null;
  activeJobs: number | null;
  workersIdle: number | null;
  /** Sum of idle workers across the master and all slaves. */
  aggregateWorkersIdle: number | null;
  slaves: ComputeSlave[];
  /** Epoch ms of the heartbeat this slice was last populated from (the
   * source row's updatedAt), or null before the first heartbeat. */
  updatedAt: number | null;
}

export const EMPTY_COMPUTE_CLUSTER: ComputeClusterStatus = {
  role: null,
  masterId: null,
  queueDepth: null,
  activeJobs: null,
  workersIdle: null,
  aggregateWorkersIdle: null,
  slaves: [],
  updatedAt: null,
};

interface ComputeStoreState {
  cluster: ComputeClusterStatus;
  /** Replace the cluster slice (the bridge passes a fully-merged slice). */
  setCluster: (cluster: ComputeClusterStatus) => void;
  /** Reset to the empty slice (connection reset). */
  clear: () => void;
}

export const useComputeStore = create<ComputeStoreState>((set) => ({
  cluster: { ...EMPTY_COMPUTE_CLUSTER },
  setCluster: (cluster) => set({ cluster }),
  clear: () => set({ cluster: { ...EMPTY_COMPUTE_CLUSTER } }),
}));
