/**
 * @license GPL-3.0-only
 *
 * Unit tests for buildAtlasPatch: the drone-heartbeat fan-out that maps the
 * `atlas*` capture-telemetry fields into the atlas store's live slice. Covers
 * the no-atlas-fields no-op, full + sparse mapping (merge over current), and
 * defensive coercion.
 */

import { describe, it, expect } from "vitest";
import { buildAtlasPatch } from "../atlas";
import { EMPTY_ATLAS_LIVE } from "@/stores/atlas-store";

const current = { live: { ...EMPTY_ATLAS_LIVE } };

describe("buildAtlasPatch", () => {
  it("returns null when the heartbeat carries no atlas fields", () => {
    expect(buildAtlasPatch({ profile: "drone" }, current, 1)).toBeNull();
    expect(buildAtlasPatch({}, current, 1)).toBeNull();
  });

  it("maps the live capture fields", () => {
    const patch = buildAtlasPatch(
      {
        atlasState: "active",
        atlasSessionId: "sess-1",
        splatGaussianCount: 240000,
        keyframesIngested: 142,
        ingestRateHz: 9.5,
        trainingStepsPerSec: 50.2,
        atlasComputeNodeId: "rtx-box",
        lastKfAt: 1700,
        atlasBearer: "direct-lan",
      },
      current,
      999,
    );
    expect(patch).not.toBeNull();
    expect(patch!.live).toMatchObject({
      state: "active",
      sessionId: "sess-1",
      gaussianCount: 240000,
      keyframesIngested: 142,
      ingestRateHz: 9.5,
      trainingStepsPerSec: 50.2,
      computeNodeId: "rtx-box",
      lastKfAt: 1700,
      bearer: "direct-lan",
      updatedAt: 999,
    });
  });

  it("maps the relay bearer fields", () => {
    const patch = buildAtlasPatch(
      {
        atlasState: "capturing",
        atlasBearer: "wfb-relay",
        atlasRelayGroundAgentId: "gs-01",
        atlasRelayDecimation: 4,
      },
      current,
      5,
    );
    expect(patch!.live.bearer).toBe("wfb-relay");
    expect(patch!.live.relayGroundAgentId).toBe("gs-01");
    expect(patch!.live.relayDecimation).toBe(4);
  });

  it("merges a sparse heartbeat over the current slice", () => {
    const prior = {
      live: {
        ...EMPTY_ATLAS_LIVE,
        state: "active",
        sessionId: "sess-1",
        keyframesIngested: 100,
        computeNodeId: "rtx-box",
      },
    };
    // Only the keyframe count changes; everything else is preserved.
    const patch = buildAtlasPatch({ keyframesIngested: 110 }, prior, 7);
    expect(patch!.live).toMatchObject({
      state: "active",
      sessionId: "sess-1",
      keyframesIngested: 110,
      computeNodeId: "rtx-box",
      updatedAt: 7,
    });
  });

  it("ignores non-finite numerics (treated as absent)", () => {
    const patch = buildAtlasPatch(
      { atlasState: "active", ingestRateHz: Number.NaN },
      current,
      1,
    );
    expect(patch!.live.state).toBe("active");
    expect(patch!.live.ingestRateHz).toBeNull();
  });
});
