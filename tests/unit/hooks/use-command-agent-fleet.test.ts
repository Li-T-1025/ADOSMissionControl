/**
 * Tests for `useCommandAgentFleet`. Focus: the ground-station video guard.
 *
 * A ground station receives its video downlink over the WFB radio, so when
 * the radio link is not connected no video can be flowing. The hook must not
 * report the video state as "live"/"queued" (and must not produce a WHEP URL)
 * for a ground station whose radio link is down, even if a stale videoState
 * arrives from the agent. A drone streams its own camera independently of the
 * WFB radio and must never be gated by this rule.
 */

import { afterEach, describe, expect, it } from "vitest";
import { renderHook } from "@testing-library/react";

import { useCommandAgentFleet } from "@/hooks/use-command-agent-fleet";
import {
  useCommandFleetStore,
  type CommandCloudStatus,
} from "@/stores/command-fleet-store";
import type { PairedDrone } from "@/stores/pairing-store";

const NOW = Date.now();

function makePaired(
  overrides: Partial<PairedDrone> & Pick<PairedDrone, "deviceId">,
): PairedDrone {
  return {
    _id: `id-${overrides.deviceId}`,
    userId: "user-1",
    name: overrides.deviceId,
    apiKey: "key",
    pairedAt: NOW,
    lastSeen: NOW,
    ...overrides,
  };
}

function makeStatus(
  overrides: Partial<CommandCloudStatus> & Pick<CommandCloudStatus, "deviceId">,
): CommandCloudStatus {
  return {
    updatedAt: NOW,
    lastIp: "192.168.1.50",
    videoState: "running",
    videoWhepPort: 8889,
    ...overrides,
  };
}

function seed(rows: CommandCloudStatus[]): void {
  useCommandFleetStore.getState().setCloudStatuses(rows);
}

afterEach(() => {
  useCommandFleetStore.getState().clear();
});

describe("useCommandAgentFleet — ground-station video guard", () => {
  it("does not report video as live when a ground station's radio link is down", () => {
    const drone = makePaired({
      deviceId: "gs-1",
      profile: "ground-station",
      role: "direct",
    });
    seed([
      makeStatus({
        deviceId: "gs-1",
        // Agent (incorrectly) still claims video is running...
        videoState: "running",
        videoWhepUrl: "http://192.168.1.50:8889/main/whep",
        // ...but the WFB receive link is down.
        radio: { state: "disconnected" },
      }),
    ]);

    // The UI has the tile "active" (in the active set). The guard must
    // still refuse to mark the link as streamable.
    const { result } = renderHook(() =>
      useCommandAgentFleet([drone], new Set(["gs-1"]), new Set()),
    );

    const agent = result.current.find((a) => a.identity.deviceId === "gs-1");
    expect(agent).toBeDefined();
    expect(agent!.radio?.state).toBe("disconnected");
    // Video must be neither live nor queued, and no WHEP URL is produced.
    expect(agent!.video.state).not.toBe("live");
    expect(agent!.video.state).not.toBe("queued");
    expect(agent!.video.state).toBe("unavailable");
    expect(agent!.video.whepUrl).toBeNull();
    expect(agent!.video.queued).toBe(false);
  });

  it("reports video as live for a ground station when the radio link is connected", () => {
    const drone = makePaired({
      deviceId: "gs-2",
      profile: "ground-station",
      role: "direct",
    });
    seed([
      makeStatus({
        deviceId: "gs-2",
        videoState: "running",
        videoWhepUrl: "http://192.168.1.51:8889/main/whep",
        radio: { state: "connected" },
      }),
    ]);

    const { result } = renderHook(() =>
      useCommandAgentFleet([drone], new Set(["gs-2"]), new Set()),
    );

    const agent = result.current.find((a) => a.identity.deviceId === "gs-2");
    expect(agent).toBeDefined();
    expect(agent!.radio?.state).toBe("connected");
    expect(agent!.video.state).toBe("live");
    expect(agent!.video.whepUrl).toBe("http://192.168.1.51:8889/main/whep");
  });

  it("leaves a drone profile unaffected by the radio-link gate", () => {
    // A drone streams its own camera over LAN/WebRTC, independent of WFB.
    // Even with no radio block at all, its video must still be live.
    const drone = makePaired({
      deviceId: "drone-1",
      profile: "drone",
    });
    seed([
      makeStatus({
        deviceId: "drone-1",
        videoState: "running",
        videoWhepUrl: "http://192.168.1.60:8889/main/whep",
        radio: null,
      }),
    ]);

    const { result } = renderHook(() =>
      useCommandAgentFleet([drone], new Set(["drone-1"]), new Set()),
    );

    const agent = result.current.find((a) => a.identity.deviceId === "drone-1");
    expect(agent).toBeDefined();
    expect(agent!.video.state).toBe("live");
    expect(agent!.video.whepUrl).toBe("http://192.168.1.60:8889/main/whep");
  });

  it("does not gate a drone even when it carries a disconnected radio block", () => {
    const drone = makePaired({
      deviceId: "drone-2",
      profile: "drone",
    });
    seed([
      makeStatus({
        deviceId: "drone-2",
        videoState: "running",
        videoWhepUrl: "http://192.168.1.61:8889/main/whep",
        radio: { state: "disconnected" },
      }),
    ]);

    const { result } = renderHook(() =>
      useCommandAgentFleet([drone], new Set(["drone-2"]), new Set()),
    );

    const agent = result.current.find((a) => a.identity.deviceId === "drone-2");
    expect(agent).toBeDefined();
    expect(agent!.video.state).toBe("live");
    expect(agent!.video.whepUrl).toBe("http://192.168.1.61:8889/main/whep");
  });
});
