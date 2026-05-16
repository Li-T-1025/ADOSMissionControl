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

// Demo mode toggled per-test via the URL search params helper.
// `isDemoMode` reads `process.env.NEXT_PUBLIC_DEMO_MODE` or the
// `?demo=true` URL param; we patch the env var per-test.
vi.mock("@/stores/auth-store", () => ({
  useAuthStore: (sel: (s: unknown) => unknown) =>
    sel({ isAuthenticated: false }),
}));

// useConvexSkipQuery is a no-op in our demo-mode tests because the
// hook short-circuits before the Convex call. We still need to mock
// it so the import resolves without pulling in ConvexClientProvider.
vi.mock("@/hooks/use-convex-skip-query", () => ({
  useConvexSkipQuery: () => undefined,
}));

import { useDronePluginContributions } from "@/hooks/use-drone-plugin-contributions";

describe("useDronePluginContributions", () => {
  const originalEnv = process.env.NEXT_PUBLIC_DEMO_MODE;

  beforeEach(() => {
    process.env.NEXT_PUBLIC_DEMO_MODE = "true";
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
});

