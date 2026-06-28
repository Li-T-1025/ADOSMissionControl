/**
 * @module command/bridges/status-mapper/atlas
 * @description Builds the per-slice patch the bridge applies to the atlas store
 * from a drone heartbeat's `atlas*` capture-telemetry fields (the during-flight
 * Live World state). Returns null when the heartbeat carries no atlas fields.
 * Pure.
 * @license GPL-3.0-only
 */

import type { AtlasLiveState } from "@/stores/atlas-store";

export interface AtlasFanOutCurrent {
  live: AtlasLiveState;
}

function asNumber(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

function asString(v: unknown): string | null {
  return typeof v === "string" && v.length > 0 ? v : null;
}

/**
 * Build the patch the bridge applies to `useAtlasStore` from a drone heartbeat.
 * Returns `null` when the heartbeat carries no `atlas*` fields (a non-capturing
 * drone), so a sparse heartbeat preserves the last-known values and we avoid a
 * no-op setState.
 */
export function buildAtlasPatch(
  cloudStatus: Record<string, unknown>,
  current: AtlasFanOutCurrent,
  nowMs: number,
): { live: AtlasLiveState } | null {
  const state = asString(cloudStatus.atlasState);
  const sessionId = asString(cloudStatus.atlasSessionId);
  const gaussianCount = asNumber(cloudStatus.splatGaussianCount);
  const keyframesIngested = asNumber(cloudStatus.keyframesIngested);
  const ingestRateHz = asNumber(cloudStatus.ingestRateHz);
  const trainingStepsPerSec = asNumber(cloudStatus.trainingStepsPerSec);
  const computeNodeId = asString(cloudStatus.atlasComputeNodeId);
  const lastKfAt = asNumber(cloudStatus.lastKfAt);
  const bearer = asString(cloudStatus.atlasBearer);
  const relayGroundAgentId = asString(cloudStatus.atlasRelayGroundAgentId);
  const relayDecimation = asNumber(cloudStatus.atlasRelayDecimation);

  // Nothing atlas-shaped in this heartbeat — leave the slice untouched.
  if (
    state === null &&
    sessionId === null &&
    gaussianCount === null &&
    keyframesIngested === null &&
    ingestRateHz === null &&
    trainingStepsPerSec === null &&
    computeNodeId === null &&
    lastKfAt === null &&
    bearer === null &&
    relayGroundAgentId === null &&
    relayDecimation === null
  ) {
    return null;
  }

  // Merge over the current slice so a sparse heartbeat preserves last-known
  // values for fields it omitted.
  const live: AtlasLiveState = {
    state: state ?? current.live.state,
    sessionId: sessionId ?? current.live.sessionId,
    gaussianCount: gaussianCount ?? current.live.gaussianCount,
    keyframesIngested: keyframesIngested ?? current.live.keyframesIngested,
    ingestRateHz: ingestRateHz ?? current.live.ingestRateHz,
    trainingStepsPerSec: trainingStepsPerSec ?? current.live.trainingStepsPerSec,
    computeNodeId: computeNodeId ?? current.live.computeNodeId,
    lastKfAt: lastKfAt ?? current.live.lastKfAt,
    bearer: bearer ?? current.live.bearer,
    relayGroundAgentId: relayGroundAgentId ?? current.live.relayGroundAgentId,
    relayDecimation: relayDecimation ?? current.live.relayDecimation,
    updatedAt: nowMs,
  };

  return { live };
}
