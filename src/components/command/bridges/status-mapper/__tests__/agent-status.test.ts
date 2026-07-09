/**
 * @license GPL-3.0-only
 *
 * Unit tests for mapCloudStatus: the transform that turns a cmd_droneStatus
 * cloud heartbeat row into the AgentStatus shape the GCS consumes. Focused on
 * the FC-variant surface so a cloud-relayed Betaflight/iNav FC drives the MSP
 * adapter + MSP relay lane the same way the LAN-direct path does.
 */

import { describe, it, expect } from "vitest";
import { mapCloudStatus } from "../agent-status";

// updatedAt is required (it seeds the health timestamp); every row carries it.
const base = { updatedAt: 1_000 } as const;

describe("mapCloudStatus — fcVariant", () => {
  it("maps a betaflight heartbeat's fcVariant to fc_variant", () => {
    const status = mapCloudStatus({ ...base, fcVariant: "betaflight", fcConnected: true });
    expect(status.fc_variant).toBe("betaflight");
  });

  it("maps an inav heartbeat's fcVariant to fc_variant", () => {
    const status = mapCloudStatus({ ...base, fcVariant: "inav" });
    expect(status.fc_variant).toBe("inav");
  });

  it("leaves fc_variant undefined when the heartbeat omits fcVariant (older agent)", () => {
    const status = mapCloudStatus({ ...base });
    expect(status.fc_variant).toBeUndefined();
  });

  it("leaves fc_variant undefined for a non-string fcVariant", () => {
    const status = mapCloudStatus({ ...base, fcVariant: 42 });
    expect(status.fc_variant).toBeUndefined();
  });
});
