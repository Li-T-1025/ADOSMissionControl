/**
 * @license GPL-3.0-only
 *
 * Tests for the compute local-first poll: a LAN-paired compute node with the
 * Atlas flag on polls its agent's /api/compute/status and feeds the compute
 * store, signed in or not (local-first, Rule 39); the inert guards (flag off,
 * no LAN key, cloud-relay device, 404) hold; the store clears on node switch.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";

const {
  authRef,
  atlasEnabledRef,
  cloudDeviceIdRef,
  nodesRef,
  clusterRef,
  getStatusImpl,
  setClusterSpy,
  clearSpy,
} = vi.hoisted(() => ({
  authRef: { value: false },
  atlasEnabledRef: { value: true },
  cloudDeviceIdRef: { value: null as string | null },
  nodesRef: {
    value: [
      { deviceId: "node-1", hostname: "http://node-1.local:8080", apiKey: "key-abc" },
    ] as Array<{ deviceId: string; hostname: string; apiKey: string }>,
  },
  clusterRef: { value: { role: null } as Record<string, unknown> },
  getStatusImpl: { value: (async () => null) as () => Promise<unknown> },
  setClusterSpy: { fn: vi.fn() },
  clearSpy: { fn: vi.fn() },
}));

vi.mock("@/lib/agent/compute-client", () => ({
  ComputeAgentClient: class {
    constructor(
      public baseUrl: string,
      public apiKey: string,
    ) {}
    getStatus() {
      return getStatusImpl.value();
    }
  },
}));
vi.mock("@/lib/utils", async (orig) => ({
  ...(await orig<typeof import("@/lib/utils")>()),
  isDemoMode: () => false,
}));
vi.mock("@/stores/auth-store", () => ({
  useAuthStore: (sel: (s: { isAuthenticated: boolean }) => unknown) =>
    sel({ isAuthenticated: authRef.value }),
}));
vi.mock("@/stores/atlas-mode-store", () => ({
  useAtlasModeStore: (sel: (s: { enabled: boolean }) => unknown) =>
    sel({ enabled: atlasEnabledRef.value }),
}));
vi.mock("@/stores/agent-connection-store", () => ({
  useAgentConnectionStore: (sel: (s: { cloudDeviceId: string | null }) => unknown) =>
    sel({ cloudDeviceId: cloudDeviceIdRef.value }),
}));
vi.mock("@/stores/local-nodes-store", () => ({
  useLocalNodesStore: (sel: (s: { nodes: unknown[] }) => unknown) =>
    sel({ nodes: nodesRef.value }),
}));
vi.mock("@/stores/compute-store", () => ({
  useComputeStore: {
    getState: () => ({
      cluster: clusterRef.value,
      setCluster: setClusterSpy.fn,
      clear: clearSpy.fn,
    }),
  },
}));

import { useComputeLocalState } from "@/hooks/use-compute-local-state";

describe("useComputeLocalState", () => {
  beforeEach(() => {
    authRef.value = false;
    atlasEnabledRef.value = true;
    cloudDeviceIdRef.value = null;
    nodesRef.value = [
      { deviceId: "node-1", hostname: "http://node-1.local:8080", apiKey: "key-abc" },
    ];
    clusterRef.value = { role: null };
    setClusterSpy.fn = vi.fn();
    clearSpy.fn = vi.fn();
    getStatusImpl.value = async () => ({
      computeRole: "master",
      computeClusterMasterId: "node-1",
      computeQueueDepth: 2,
      computeActiveJobs: 1,
      computeWorkersIdle: 3,
      computeClusterAggregateWorkersIdle: 3,
      computeClusterSlaves: [],
    });
  });

  afterEach(() => vi.restoreAllMocks());

  it("polls the node's status and feeds the compute store", async () => {
    renderHook(() => useComputeLocalState("node-1"));
    await waitFor(() => expect(setClusterSpy.fn).toHaveBeenCalled());
    const cluster = setClusterSpy.fn.mock.calls[0][0];
    expect(cluster).toMatchObject({
      role: "master",
      masterId: "node-1",
      queueDepth: 2,
      activeJobs: 1,
      workersIdle: 3,
    });
  });

  it("still polls when signed in (local-first for a non-cloud-relay node)", async () => {
    authRef.value = true;
    renderHook(() => useComputeLocalState("node-1"));
    await waitFor(() => expect(setClusterSpy.fn).toHaveBeenCalled());
  });

  it("is inert when the Atlas flag is off", async () => {
    atlasEnabledRef.value = false;
    renderHook(() => useComputeLocalState("node-1"));
    await new Promise((r) => setTimeout(r, 20));
    expect(setClusterSpy.fn).not.toHaveBeenCalled();
  });

  it("is inert when no LAN key is held / no node selected", async () => {
    nodesRef.value = [];
    renderHook(() => useComputeLocalState("node-1"));
    await new Promise((r) => setTimeout(r, 20));
    expect(setClusterSpy.fn).not.toHaveBeenCalled();

    renderHook(() => useComputeLocalState(null));
    await new Promise((r) => setTimeout(r, 20));
    expect(setClusterSpy.fn).not.toHaveBeenCalled();
  });

  it("is inert when this node is the active cloud-relay device (no double-write)", async () => {
    cloudDeviceIdRef.value = "node-1";
    renderHook(() => useComputeLocalState("node-1"));
    await new Promise((r) => setTimeout(r, 20));
    expect(setClusterSpy.fn).not.toHaveBeenCalled();
  });

  it("skips a 404 (no compute sidecar) without writing the store", async () => {
    getStatusImpl.value = async () => null;
    renderHook(() => useComputeLocalState("node-1"));
    await new Promise((r) => setTimeout(r, 20));
    expect(setClusterSpy.fn).not.toHaveBeenCalled();
  });

  it("clears the store on node switch (local-first)", async () => {
    const { rerender } = renderHook((id: string) => useComputeLocalState(id), {
      initialProps: "node-1",
    });
    expect(clearSpy.fn).toHaveBeenCalledTimes(1);
    nodesRef.value = [];
    rerender("node-2");
    expect(clearSpy.fn).toHaveBeenCalledTimes(2);
  });
});
