import { describe, expect, it } from "vitest";

import { resolveSurfaces } from "@/components/dashboard/node-detail/surfaces";
import type { SurfaceContext } from "@/components/dashboard/node-detail/surface-types";

/** A minimal drone SurfaceContext; overrides tune the gate inputs under test. */
function ctx(over: Partial<SurfaceContext>): SurfaceContext {
  return {
    droneId: "node:d1",
    drone: { profile: "drone" } as SurfaceContext["drone"],
    displayName: "d1",
    isConnected: true,
    firmwareType: null,
    agentDeviceId: null,
    fcLinking: false,
    radioPresent: false,
    visionPresent: false,
    role: "drone" as SurfaceContext["role"],
    showLockedTabs: true,
    isFeatureEnabled: () => false,
    atlasCapturing: false,
    ...over,
  };
}

const hasVision = (c: SurfaceContext) =>
  resolveSurfaces(c).some((s) => s.id === "vision");

describe("Vision surface gate", () => {
  it("shows for any SBC/companion-backed drone, even with no engine running", () => {
    // Companion present (agentDeviceId set) but vision not yet active: the tab
    // still appears so the operator can set vision up from it.
    expect(
      hasVision(
        ctx({ agentDeviceId: "dev-1", showLockedTabs: false, visionPresent: false }),
      ),
    ).toBe(true);
  });

  it("shows for a companion drone that is already running vision", () => {
    expect(
      hasVision(
        ctx({ agentDeviceId: "dev-1", showLockedTabs: false, visionPresent: true }),
      ),
    ).toBe(true);
  });

  it("hides for an FC-only drone (no companion agent)", () => {
    // No companion (agentDeviceId null) — vision runs on the companion, so an
    // FC-only drone has no vision tab regardless of any stale visionPresent.
    expect(
      hasVision(ctx({ agentDeviceId: null, showLockedTabs: true, visionPresent: true })),
    ).toBe(false);
  });
});
