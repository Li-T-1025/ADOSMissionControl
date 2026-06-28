/**
 * @license GPL-3.0-only
 *
 * Unit tests for buildAtlasPatch: the fan-out that maps the heartbeat's generic
 * `pluginState.atlas` slice (the Atlas plugin's own opaque telemetry) into the
 * atlas store's live slice. The slice shape is the Atlas plugin's contract; the
 * core convex schema never sees it. Covers the no-slice no-op, full + sparse
 * mapping (merge over current), and defensive coercion.
 */

import { describe, it, expect } from "vitest";
import { buildAtlasPatch } from "../atlas";
import { EMPTY_ATLAS_LIVE } from "@/stores/atlas-store";

const current = { live: { ...EMPTY_ATLAS_LIVE } };

/** Wrap an atlas slice in the generic pluginState envelope. */
function hb(atlas: Record<string, unknown>): Record<string, unknown> {
  return { pluginState: { atlas } };
}

describe("buildAtlasPatch", () => {
  it("returns null when there is no atlas slice", () => {
    expect(buildAtlasPatch({}, current, 1)).toBeNull();
    expect(buildAtlasPatch({ pluginState: {} }, current, 1)).toBeNull();
    expect(buildAtlasPatch({ pluginState: { other: { x: 1 } } }, current, 1)).toBeNull();
    // A present-but-empty atlas slice carries nothing to merge.
    expect(buildAtlasPatch(hb({}), current, 1)).toBeNull();
  });

  it("maps the atlas slice's capture + reconstruction fields", () => {
    const patch = buildAtlasPatch(
      hb({
        state: "capturing",
        sessionId: "sess-1",
        gaussianCount: 240000,
        keyframesIngested: 142,
        ingestRateHz: 9.5,
        cameraCount: 6,
        vioHealth: "good",
        trainingStepsPerSec: 50.2,
        computeNodeId: "rtx-box",
        lastKfAt: 1700,
        bearer: "direct-lan",
      }),
      current,
      999,
    );
    expect(patch).not.toBeNull();
    expect(patch!.live).toMatchObject({
      state: "capturing",
      sessionId: "sess-1",
      gaussianCount: 240000,
      keyframesIngested: 142,
      ingestRateHz: 9.5,
      cameraCount: 6,
      vioHealth: "good",
      trainingStepsPerSec: 50.2,
      computeNodeId: "rtx-box",
      lastKfAt: 1700,
      bearer: "direct-lan",
      updatedAt: 999,
    });
  });

  it("maps the drone-side capture-quality fields (cameras + VIO health)", () => {
    const patch = buildAtlasPatch(
      hb({ state: "capturing", cameraCount: 1, vioHealth: "degraded" }),
      current,
      3,
    );
    expect(patch!.live.cameraCount).toBe(1);
    expect(patch!.live.vioHealth).toBe("degraded");
  });

  it("maps the relay transport fields", () => {
    const patch = buildAtlasPatch(
      hb({
        state: "capturing",
        bearer: "wfb-relay",
        relayGroundAgentId: "gs-01",
        relayDecimation: 4,
      }),
      current,
      5,
    );
    expect(patch!.live.bearer).toBe("wfb-relay");
    expect(patch!.live.relayGroundAgentId).toBe("gs-01");
    expect(patch!.live.relayDecimation).toBe(4);
  });

  it("merges a sparse slice over the current slice", () => {
    const prior = {
      live: {
        ...EMPTY_ATLAS_LIVE,
        state: "capturing",
        sessionId: "sess-1",
        keyframesIngested: 100,
        computeNodeId: "rtx-box",
      },
    };
    // Only the keyframe count changes; everything else is preserved.
    const patch = buildAtlasPatch(hb({ keyframesIngested: 110 }), prior, 7);
    expect(patch!.live).toMatchObject({
      state: "capturing",
      sessionId: "sess-1",
      keyframesIngested: 110,
      computeNodeId: "rtx-box",
      updatedAt: 7,
    });
  });

  it("ignores non-finite numerics (treated as absent)", () => {
    const patch = buildAtlasPatch(
      hb({ state: "capturing", ingestRateHz: Number.NaN }),
      current,
      1,
    );
    expect(patch!.live.state).toBe("capturing");
    expect(patch!.live.ingestRateHz).toBeNull();
  });
});
