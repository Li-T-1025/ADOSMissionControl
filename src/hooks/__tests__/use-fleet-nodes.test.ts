/**
 * @license GPL-3.0-only
 *
 * Tests for the fleet-node merge + live-FC enrichment. Focus: the live
 * command-fleet status (which carries the MSP variant/transport that a
 * reachable Betaflight/iNav FC advertises) is folded onto the merged node so
 * the sidebar can badge it as connected, and a pair-time fcConnected is
 * preserved when no live status exists yet.
 */

import { describe, it, expect } from "vitest";

import {
  mergeFleetNodes,
  enrichNodeWithLiveFc,
  type FleetNodeEntry,
} from "../use-fleet-nodes";
import type { PairedDrone } from "@/stores/pairing-store";
import type { LocalNode } from "@/stores/local-nodes-store";
import type { CommandCloudStatus } from "@/stores/command-fleet-store";

function nodeEntry(over: Partial<FleetNodeEntry> = {}): FleetNodeEntry {
  return {
    _id: "node:dev",
    userId: "local",
    deviceId: "dev",
    name: "Skynode",
    apiKey: "k",
    pairedAt: 1,
    profile: "drone",
    isLocal: true,
    ...over,
  };
}

function status(over: Partial<CommandCloudStatus> = {}): CommandCloudStatus {
  return { deviceId: "dev", updatedAt: 1, ...over };
}

describe("enrichNodeWithLiveFc", () => {
  it("returns the node unchanged when there is no live status", () => {
    const n = nodeEntry({ fcConnected: true });
    expect(enrichNodeWithLiveFc(n, undefined)).toBe(n);
  });

  it("folds a reachable MSP FC's variant/transport onto the node", () => {
    const enriched = enrichNodeWithLiveFc(
      nodeEntry(),
      status({ fcConnected: false, fcVariant: "betaflight", transportOpen: true }),
    );
    expect(enriched.fcVariant).toBe("betaflight");
    expect(enriched.transportOpen).toBe(true);
    // fcConnected stays false (MSP never sets it) — reachability is derived
    // from the variant + transport downstream.
    expect(enriched.fcConnected).toBe(false);
  });

  it("prefers the live fcConnected over the pair-time value", () => {
    const enriched = enrichNodeWithLiveFc(
      nodeEntry({ fcConnected: false }),
      status({ fcConnected: true, fcFirmware: "ardupilot" }),
    );
    expect(enriched.fcConnected).toBe(true);
    expect(enriched.fcFirmware).toBe("ardupilot");
  });

  it("keeps the pair-time fcConnected when the live status omits it", () => {
    const enriched = enrichNodeWithLiveFc(
      nodeEntry({ fcConnected: true }),
      status({}),
    );
    expect(enriched.fcConnected).toBe(true);
  });
});

describe("mergeFleetNodes", () => {
  it("collapses a node seen on both transports to one row", () => {
    const cloud: PairedDrone = {
      _id: "cloud-id",
      userId: "u",
      deviceId: "dev",
      name: "Cloud name",
      apiKey: "ck",
      pairedAt: 5,
      fcConnected: true,
    };
    const local: LocalNode = {
      deviceId: "dev",
      name: "Local name",
      hostname: "http://192.168.0.5:8080",
      apiKey: "lk",
      profile: "drone",
      pairedAt: 6,
    };
    const merged = mergeFleetNodes([cloud], [local]);
    expect(merged).toHaveLength(1);
    // Local identity wins (apiKey), but the cloud freshness field is preserved.
    expect(merged[0].apiKey).toBe("lk");
    expect(merged[0].fcConnected).toBe(true);
    expect(merged[0].isLocal).toBe(true);
  });
});
