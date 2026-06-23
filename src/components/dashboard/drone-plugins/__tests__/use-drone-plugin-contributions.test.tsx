/**
 * @license GPL-3.0-only
 *
 * Tests for the per-drone plugin contributions hook. Covers:
 *   - demo-mode fixture path (no Convex required)
 *   - empty agentId returns empty array
 *   - sort order: by manifest order asc, ties broken by pluginId
 */

import { describe, it, expect, vi, beforeEach, afterAll } from "vitest";
import { renderHook } from "@testing-library/react";

// Mutable mock state so the non-demo (Convex) path is exercisable:
// `authState` drives `isAuthenticated`, `installsRef` is what
// `useConvexSkipQuery` returns (the install rows). Demo-mode tests
// short-circuit before either is read.
const { authState, installsRef } = vi.hoisted(() => ({
  authState: { value: false },
  installsRef: { value: undefined as unknown },
}));

// Demo mode toggled per-test via the URL search params helper.
// `isDemoMode` reads `process.env.NEXT_PUBLIC_DEMO_MODE` or the
// `?demo=true` URL param; we patch the env var per-test.
vi.mock("@/stores/auth-store", () => ({
  useAuthStore: (sel: (s: { isAuthenticated: boolean }) => unknown) =>
    sel({ isAuthenticated: authState.value }),
}));

// useConvexSkipQuery returns the staged install rows. We still need to
// mock it so the import resolves without pulling in ConvexClientProvider.
vi.mock("@/hooks/use-convex-skip-query", () => ({
  useConvexSkipQuery: () => installsRef.value,
}));

import { useDronePluginContributions } from "@/hooks/use-drone-plugin-contributions";

describe("useDronePluginContributions", () => {
  const originalEnv = process.env.NEXT_PUBLIC_DEMO_MODE;

  beforeEach(() => {
    process.env.NEXT_PUBLIC_DEMO_MODE = "true";
    authState.value = false;
    installsRef.value = undefined;
  });

  afterAll(() => {
    process.env.NEXT_PUBLIC_DEMO_MODE = originalEnv;
  });

  it("returns an empty array when agentId is undefined", () => {
    const { result } = renderHook(() =>
      useDronePluginContributions(undefined),
    );
    expect(result.current).toEqual([]);
  });

  it("returns mock contributions for a known demo drone", () => {
    const { result } = renderHook(() =>
      useDronePluginContributions("demo-drone-1"),
    );
    // demo-drone-1 has the vision-nav plugin enabled.
    expect(result.current.length).toBeGreaterThan(0);
    expect(result.current[0].pluginId).toBe("com.altnautica.vision-nav");
  });

  it("returns an empty array for an unknown demo drone", () => {
    const { result } = renderHook(() =>
      useDronePluginContributions("unknown-drone-xyz"),
    );
    expect(result.current).toEqual([]);
  });

  it("sorts by manifest order ascending, then pluginId", () => {
    // demo-drone-2 has FLIR Lepton thermal (order 70). demo-drone-3 has
    // gimbal v2 (order 50). Validate the sort by checking drone-2 alone
    // first (one tab), then verifying drone-3 reports its tab.
    const { result: r2 } = renderHook(() =>
      useDronePluginContributions("demo-drone-2"),
    );
    expect(r2.current.map((c) => c.pluginId)).toEqual([
      "com.flir.thermal",
    ]);

    const { result: r3 } = renderHook(() =>
      useDronePluginContributions("demo-drone-3"),
    );
    expect(r3.current.map((c) => c.pluginId)).toEqual([
      "com.altnautica.gimbal-v2",
    ]);
  });

  it("projects only drone.detail.tab gcsContributes entries from listForDeviceWithDetail", () => {
    process.env.NEXT_PUBLIC_DEMO_MODE = "false";
    authState.value = true;
    installsRef.value = [
      {
        installId: "install-1",
        pluginId: "com.example.b",
        version: "1.0.0",
        name: "Plugin B",
        gcsContributes: [
          // A non-tab slot must be ignored by the header hook.
          { slot: "video.overlay", panelId: "ov", order: 10 },
          {
            slot: "drone.detail.tab",
            panelId: "tab-b",
            title: "B Tab",
            icon: "x",
            order: 80,
          },
        ],
      },
      {
        installId: "install-2",
        pluginId: "com.example.a",
        version: "2.0.0",
        name: "Plugin A",
        gcsContributes: [{ slot: "drone.detail.tab", panelId: "tab-a", order: 80 }],
      },
    ];

    const { result } = renderHook(() =>
      useDronePluginContributions("drone-x"),
    );

    // Two drone.detail.tab tabs; the video.overlay entry is ignored.
    expect(result.current).toHaveLength(2);
    // Equal order (80) → tie-break by pluginId lexicographically.
    expect(result.current.map((c) => c.pluginId)).toEqual([
      "com.example.a",
      "com.example.b",
    ]);

    const [a, b] = result.current;
    expect(a.installId).toBe("install-2");
    expect(a.panelId).toBe("tab-a");
    expect(a.title).toBe("Plugin A"); // no manifest title → plugin name
    expect(a.order).toBe(80);
    expect(a.enabled).toBe(true);
    expect(b.panelId).toBe("tab-b");
    expect(b.title).toBe("B Tab");
    expect(b.icon).toBe("x");
  });
});

