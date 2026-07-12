import { describe, expect, it } from "vitest";

import { resolveSurfaces } from "@/components/dashboard/node-detail/surfaces";
import type { SurfaceContext } from "@/components/dashboard/node-detail/surface-types";

/** A minimal SurfaceContext; overrides tune the gate inputs under test. */
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

const hasSettings = (c: SurfaceContext) =>
  resolveSurfaces(c).some((s) => s.id === "settings");

describe("Settings surface gate", () => {
  it("shows for a companion-backed drone (paired agent)", () => {
    expect(
      hasSettings(ctx({ agentDeviceId: "dev-1", showLockedTabs: false })),
    ).toBe(true);
  });

  it("shows for a workstation node", () => {
    expect(
      hasSettings(
        ctx({
          drone: { profile: "workstation" } as SurfaceContext["drone"],
          showLockedTabs: false,
        }),
      ),
    ).toBe(true);
  });

  it("shows for a ground-station node", () => {
    expect(
      hasSettings(
        ctx({
          drone: { profile: "ground-station" } as SurfaceContext["drone"],
          showLockedTabs: false,
        }),
      ),
    ).toBe(true);
  });

  it("hides for an FC-only drone (no companion agent)", () => {
    expect(
      hasSettings(ctx({ agentDeviceId: null, showLockedTabs: true })),
    ).toBe(false);
  });
});
