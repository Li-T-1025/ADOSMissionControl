import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useVideoStreams } from "@/hooks/use-video-streams";
import { useVideoStreamsStore } from "@/stores/video-streams-store";
import { useVideoStore } from "@/stores/video-store";
import { useAgentCapabilitiesStore } from "@/stores/agent-capabilities-store";
import { useAgentConnectionStore } from "@/stores/agent-connection-store";
import type { AgentClient } from "@/lib/agent/agent-client/client";
import type { VideoStreamLeg, CameraCapability } from "@/lib/agent/feature-types";

const DRONE = "node:d1";

function leg(id: string, role?: string): VideoStreamLeg {
  return { id, role, codec: "h264", whepUrl: `http://host:8889/${id}/whep` };
}

function camera(name: string, device: string): CameraCapability {
  return { name, device } as CameraCapability;
}

function switchCameraSpy() {
  const spy = vi.fn(async () => {});
  useAgentConnectionStore.setState({
    client: { switchCamera: spy } as unknown as AgentClient,
  });
  return spy;
}

describe("useVideoStreams", () => {
  beforeEach(() => {
    useVideoStreamsStore.getState().clear();
    useAgentCapabilitiesStore.getState().clear();
    useVideoStore.getState().setWhepUrlOverride(null);
    useAgentConnectionStore.setState({ client: null });
  });
  afterEach(cleanup);

  it("[D1] points the override at a non-default concurrent leg, then clears it when the stream list empties", () => {
    switchCameraSpy();
    act(() => {
      useAgentCapabilitiesStore.setState({
        videoStreams: [leg("main", "eo"), leg("ir", "ir")],
      });
    });
    renderHook(() => useVideoStreams(DRONE));

    // Select the second (non-default) leg → the override points at its own URL.
    act(() => {
      useVideoStreamsStore.getState().selectStream(DRONE, 2);
    });
    expect(useVideoStore.getState().whepUrlOverride).toBe(
      "http://host:8889/ir/whep",
    );

    // The node stops advertising streams (streams drop to 0): the override must
    // be cleared so the cascade falls back to the default URL, not a dead leg.
    act(() => {
      useAgentCapabilitiesStore.setState({ videoStreams: [] });
    });
    expect(useVideoStreamsStore.getState().activeStream(DRONE)).toBeNull();
    expect(useVideoStore.getState().whepUrlOverride).toBeNull();
  });

  it("[D1] does not fire switchCamera for a carried-over concurrent id on a concurrent→switchable transition", () => {
    const spy = switchCameraSpy();
    act(() => {
      useAgentCapabilitiesStore.setState({
        videoStreams: [leg("main", "eo"), leg("ir", "ir")],
      });
    });
    renderHook(() => useVideoStreams(DRONE));

    act(() => {
      useVideoStreamsStore.getState().selectStream(DRONE, 2); // "ir"
    });
    expect(useVideoStore.getState().whepUrlOverride).toBe(
      "http://host:8889/ir/whep",
    );

    // The switch mechanism flips to switchable (per-leg legs gone, a camera
    // roster arrives). The carried-over "ir" id is not a switchable device leg,
    // so no switchCamera must fire, and the override must be cleared.
    act(() => {
      useAgentCapabilitiesStore.setState({
        videoStreams: [],
        cameras: [camera("USB Camera", "/dev/video0"), camera("CSI", "/dev/video1")],
      });
    });
    expect(spy).not.toHaveBeenCalled();
    expect(useVideoStore.getState().whepUrlOverride).toBeNull();
    // The active id defaulted to the first switchable device leg.
    expect(useVideoStreamsStore.getState().activeStream(DRONE)?.id).toBe(
      "/dev/video0",
    );
  });
});
