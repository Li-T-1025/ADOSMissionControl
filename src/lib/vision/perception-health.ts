/**
 * @module lib/vision/perception-health
 * @description Pure helpers that turn a vision-detection batch's age + the
 * node's resolved perception tier into an HONEST feed-health readout — the
 * shared logic behind the cockpit perception-health chip and the what's-locked
 * chip's "why did the lock go away" reason.
 *
 * The distinction these encode (Rule 44): a feed that WAS flowing and has now
 * aged past {@link DETECTION_STALE_MS} is STALE / lost — the operator cannot
 * know what the drone sees — which is a different thing from a fresh feed that
 * simply has no detections in view. A dead offload link and a silent local
 * detector are both "stale", but they get different words so the operator knows
 * whether the network dropped or the on-edge model went quiet.
 *
 * @license GPL-3.0-only
 */

import type { AgentCapabilities } from "@/lib/agent/feature-types";
import {
  DETECTION_STALE_MS,
  type VisionDetectionBatch,
} from "@/stores/vision-detections-store";

/** The resolved perception execution tier (where detection runs). */
export type PerceptionTier = NonNullable<AgentCapabilities["perceptionTier"]>;

/**
 * Feed liveness for one drone:
 *  - `idle`  — no batch ever arrived (perception not producing / "no detections
 *              yet"); NEVER conflate this with a lost feed.
 *  - `fresh` — a batch arrived within the stale window.
 *  - `stale` — a batch WAS flowing but has aged past the window (feed / offload
 *              link lost).
 */
export type PerceptionFeedState = "idle" | "fresh" | "stale";

/** Classify a drone's detection feed by the age of its latest batch. */
export function perceptionFeedState(
  batch: VisionDetectionBatch | undefined,
  now: number,
): PerceptionFeedState {
  if (!batch) return "idle";
  return now - batch.receivedAt <= DETECTION_STALE_MS ? "fresh" : "stale";
}

/**
 * The short label for a resolved tier. Returns a neutral `PERCEPTION` when the
 * tier is unknown but a feed is flowing (never fabricates a tier), and `null`
 * when there is no perception context to show at all.
 */
export function tierLabel(
  tier: PerceptionTier | "none" | undefined,
  hasFeed: boolean,
): string | null {
  switch (tier) {
    case "local":
      return "LOCAL";
    case "offload":
      return "OFFLOAD";
    case "hybrid":
      return "HYBRID";
    default:
      return hasFeed ? "PERCEPTION" : null;
  }
}

/**
 * Why a live feed went stale, tailored to where perception runs: an offloaded
 * feed going quiet is an "Offload link lost"; a local (or unknown) feed is a
 * "Perception feed stale". Only meaningful when the feed state is `stale`.
 */
export function staleReason(tier: PerceptionTier | "none" | undefined): string {
  return tier === "offload" ? "Offload link lost" : "Perception feed stale";
}
