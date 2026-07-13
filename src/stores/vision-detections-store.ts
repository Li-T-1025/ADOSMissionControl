/**
 * @module VisionDetectionsStore
 * @description Per-drone store of the latest vision detection batch the
 * GCS knows about. The video overlay reads the active drone's batch and
 * draws bounding boxes scaled to the video element.
 *
 * A detection batch carries pixel-space boxes in the frame's own
 * resolution (origin top-left). Each batch declares its source frame
 * width/height so the overlay can map frame pixels onto the rendered
 * video rectangle regardless of the element's display size.
 *
 * TRANSPORT (live detections):
 *   The agent publishes detections on the `vision.detection` topic, and
 *   the engine re-broadcasts every per-frame `DetectionBatch` (model_id,
 *   camera_id, frame_id, ts_ms, detections[]) onto a Unix socket the
 *   agent's API process forwards to the browser over a WebSocket. The LAN
 *   client at `@/lib/agent/vision-detections-ws` opens that WebSocket for a
 *   paired drone, maps each batch onto the shape below, and calls
 *   `setBatch()`. A demo/test injector can also call `setBatch()` directly.
 *   The cloud-relay path for a remote drone (a vision/detection MQTT topic
 *   via `ados-cloud`) is a documented follow-up; it feeds the same
 *   `setBatch()`, so adding it stays purely additive.
 *
 * @license GPL-3.0-only
 */

import { create } from "zustand";

/**
 * How long a detection batch stays "fresh" after it was received. Past this
 * age the overlay drops boxes and the perception health surfaces flip a live
 * feed to "stale / offload link lost" (distinct from "no targets"). Shared by
 * the cockpit overlay, the perception-health chip, and the what's-locked chip
 * so all three read the exact same freshness window (Rule 44 — one honest
 * source of truth for feed liveness).
 */
export const DETECTION_STALE_MS = 2000;

/** Pixel-space bounding box (origin top-left), in the frame's own
 * resolution. Mirrors the vision-contract `BoundingBox`. */
export interface DetectionBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Discrete identity-lock state of a track this frame. Mirrors the
 * vision-contract `LockState` (lowercase string on the wire). `locked` = the
 * tracker is confident the identity held; `uncertain` = a weak association
 * (e.g. a box held on prediction through a miss) so the identity is
 * provisional; `lost` = the track could not be re-associated. Carrying it lets
 * the overlay show identity uncertainty instead of a silent swap. */
export type LockState = "locked" | "uncertain" | "lost";

/** One detection from a model. Mirrors the vision-contract `Detection`. */
export interface VisionDetection {
  bbox: DetectionBox;
  classLabel: string;
  confidence: number;
  /** Stable track id across frames (tracking models only). */
  trackId?: number | null;
  /** How confident the tracker is that this detection is the same object as
   * its `trackId` (0..1). Absent when the source does not score association.
   * Distinct from `confidence` (the class/object detection itself). */
  assocConfidence?: number | null;
  /** Discrete identity-lock state this frame. Absent when the source does not
   * report a lock state. */
  lockState?: LockState | null;
  /** Open, self-describing per-detection attributes: the extension point for
   * richer perception beyond the 2D box (mask reference, keypoints, depth,
   * world position) plus model-specific metadata, keyed by name. Absent when
   * the source reports none. A consumer reads only the keys it understands. */
  attributes?: Record<string, unknown> | null;
}

/** A batch of detections for one frame. Carries the source frame
 * dimensions so overlays can scale boxes to the rendered video. Mirrors
 * the vision-contract `DetectionBatch` plus the frame size the boxes are
 * expressed in. */
export interface VisionDetectionBatch {
  modelId: string;
  cameraId: string;
  frameId: number;
  tsMs: number;
  /** Resolution the detection coordinates are expressed in. The overlay
   * scales by (renderedWidth / frameWidth). */
  frameWidth: number;
  frameHeight: number;
  detections: VisionDetection[];
  /** Epoch ms the GCS received the batch. Used to age out stale boxes
   * so an overlay does not pin the last detection forever after the
   * feed stops. */
  receivedAt: number;
}

/** Key one detection STREAM by its model + camera. The engine broadcasts one
 * batch per (model, camera), so a drone running several models — or one model
 * across several cameras — has several concurrent streams. */
export function streamKey(modelId: string, cameraId: string): string {
  return `${modelId}::${cameraId}`;
}

interface VisionDetectionsState {
  /** Latest batch per drone (keyed by drone/device id), across every stream —
   * the simple "what did this drone see most recently" view the cockpit
   * overlay + chip read. For a single-detector drone this is the one stream. */
  batches: Record<string, VisionDetectionBatch>;
  /** Latest batch per drone, split by (model, camera) STREAM, so the vision
   * hub can show every pipeline's output separately instead of the newest one
   * clobbering the rest. Keyed `droneId -> streamKey -> batch`. */
  streams: Record<string, Record<string, VisionDetectionBatch>>;
  /** Replace the latest batch for a drone (and its stream). `receivedAt` is
   * stamped here so callers do not have to. */
  setBatch: (
    droneId: string,
    batch: Omit<VisionDetectionBatch, "receivedAt">,
  ) => void;
  /** Every current stream for a drone (one per model×camera), newest first. */
  streamsForDrone: (droneId: string) => VisionDetectionBatch[];
  /** Drop a drone's batches (on disconnect or feed stop). */
  clearBatch: (droneId: string) => void;
  /** Reset everything. */
  clear: () => void;
}

export const useVisionDetectionsStore = create<VisionDetectionsState>(
  (set, get) => ({
    batches: {},
    streams: {},
    setBatch: (droneId, batch) =>
      set((state) => {
        const stamped: VisionDetectionBatch = { ...batch, receivedAt: Date.now() };
        const key = streamKey(stamped.modelId, stamped.cameraId);
        return {
          // Latest-across-streams (the cockpit's simple view).
          batches: { ...state.batches, [droneId]: stamped },
          // Per-stream (the hub's per-pipeline view) — this batch replaces only
          // its own stream, so a second model no longer overwrites the first.
          streams: {
            ...state.streams,
            [droneId]: { ...(state.streams[droneId] ?? {}), [key]: stamped },
          },
        };
      }),
    streamsForDrone: (droneId) => {
      const byKey = get().streams[droneId];
      if (!byKey) return [];
      return Object.values(byKey).sort((a, b) => b.receivedAt - a.receivedAt);
    },
    clearBatch: (droneId) =>
      set((state) => {
        if (!(droneId in state.batches) && !(droneId in state.streams)) {
          return state;
        }
        const batches = { ...state.batches };
        delete batches[droneId];
        const streams = { ...state.streams };
        delete streams[droneId];
        return { batches, streams };
      }),
    clear: () => set({ batches: {}, streams: {} }),
  }),
);
