/**
 * @module hooks/use-video-streams
 * @description Populates the per-drone {@link useVideoStreamsStore} from the
 * node's advertised cameras and applies the selection side effect, so the
 * cockpit stream switcher (top-left `1..N` tabs) works on any multi-camera node.
 *
 * Two sources, one descriptor list (population priority):
 *   1. Per-leg video `access_urls` ({@link StreamDescriptor} `kind:"concurrent"`)
 *      — the agent exposes N addressable WHEP paths (added in the agent-core
 *      multi-path pipeline). Selecting one re-points the video cascade at that
 *      leg's WHEP URL for an instant flip. (Wired here; the advertisement lands
 *      with the agent-core work.)
 *   2. Else the capability roster `CameraCapability[]` where more than one camera
 *      is present (`kind:"switchable"`) — one encoder, N cameras. Selecting one
 *      calls the agent's `switchCamera` (the encoder restarts, ~3s) with an
 *      optimistic "switching…" state (the LcdCameraSwitch pattern).
 *
 * The switcher UI is identical for both because the store hides which mechanism
 * applies. The side effect is applied reactively to the active-stream id so
 * every entry point (a tab click, a `1..N` digit, a cycle key, a gamepad
 * bumper) just mutates the pure store and this hook reacts — deduped against the
 * last-applied id, and NOT fired for the initial default selection (the primary
 * camera is already the streaming one / the default WHEP).
 *
 * @license GPL-3.0-only
 */

"use client";

import { useEffect, useRef } from "react";

import { useAgentCapabilitiesStore } from "@/stores/agent-capabilities-store";
import { useAgentConnectionStore } from "@/stores/agent-connection-store";
import { useVideoStore } from "@/stores/video-store";
import {
  useVideoStreamsStore,
  type StreamDescriptor,
  type StreamRole,
} from "@/stores/video-streams-store";
import type { CameraCapability } from "@/lib/agent/feature-types";

/** How long the optimistic "switching…" state holds while a `switchable`
 * encoder restarts before showing the new feed. Mirrors LcdCameraSwitch's
 * `RESTART_INDICATOR_MS`. */
export const STREAM_RESTART_MS = 3000;

/** Best-effort role from a capability-roster camera (which carries no explicit
 * role), for a nicer tab label. Unknown → undefined (the tab shows the name). */
function inferRole(cam: CameraCapability): StreamRole | undefined {
  const n = cam.name.toLowerCase();
  if (n.includes("thermal") || n.includes("ir") || n.includes("infrared")) {
    return "ir";
  }
  if (n.includes("wide")) return "eo_wide";
  if (n.includes("zoom") || n.includes("eo")) return "eo";
  return undefined;
}

/** Build `switchable` descriptors from the capability roster (order preserved;
 * every camera switches the encoder's `primary` slot to its device). */
function camerasToDescriptors(cameras: CameraCapability[]): StreamDescriptor[] {
  return cameras.map((cam, i) => ({
    id: cam.device || cam.name || `camera-${i}`,
    index: i + 1,
    label: cam.name,
    role: inferRole(cam),
    kind: "switchable" as const,
    cameraRole: "primary" as const,
    devicePath: cam.device,
  }));
}

/**
 * Wire the video streams store for a drone: populate it from the node's cameras
 * and apply the selection side effect. Call once from the cockpit (it renders
 * nothing). The tabs + hotkeys read the store and call its plain
 * `selectStream` / `cycleStream`; this hook performs the resulting transport
 * change.
 */
export function useVideoStreams(droneId: string): void {
  // Single-focus stores (the currently-selected drone), same as the cockpit's
  // video-store / capabilities-store usage.
  const cameras = useAgentCapabilitiesStore((s) => s.cameras);
  const videoStreams = useAgentCapabilitiesStore((s) => s.videoStreams);
  const client = useAgentConnectionStore((s) => s.client);
  const activeId = useVideoStreamsStore(
    (s) => s.activeStreamIdByDrone[droneId] ?? null,
  );

  // Population, in priority: the agent's host-resolved per-leg WHEP streams
  // (`concurrent` — an instant client-side flip), else the capability roster
  // (`switchable` — a single-encoder switchCamera restart).
  useEffect(() => {
    if (!droneId) return;
    const descriptors: StreamDescriptor[] =
      videoStreams.length > 0
        ? videoStreams.map((leg, i) => ({
            id: leg.id,
            index: i + 1,
            label: leg.role ?? leg.id,
            role: leg.role,
            kind: "concurrent" as const,
            address: {
              whepPath: `${leg.id}/whep`,
              whepUrl: leg.whepUrl,
              codec: leg.codec as "h264" | "h265" | undefined,
            },
          }))
        : camerasToDescriptors(cameras);
    useVideoStreamsStore.getState().setStreams(droneId, descriptors);
  }, [droneId, cameras, videoStreams]);

  // Re-arm the "first selection is the default" guard when the drone changes.
  const appliedRef = useRef<string | null>(null);
  useEffect(() => {
    appliedRef.current = null;
  }, [droneId]);

  // Selection side effect: react to the active-stream id, deduped, skipping the
  // initial default (the primary is already live).
  useEffect(() => {
    if (!droneId || activeId == null) return;
    if (appliedRef.current === activeId) return;
    const first = appliedRef.current === null;
    appliedRef.current = activeId;
    if (first) return;

    const streams = useVideoStreamsStore.getState().streamsByDrone[droneId] ?? [];
    const target = streams.find((s) => s.id === activeId);
    if (!target) return;

    if (target.kind === "switchable" && target.devicePath && client) {
      // Optimistic restart: the active tab already lit up (the store changed);
      // hold a "switching…" shimmer for the encoder restart, then clear it.
      useVideoStreamsStore.getState().setSwitching(droneId, true);
      Promise.resolve(
        client.switchCamera(target.cameraRole ?? "primary", target.devicePath),
      )
        .catch(() => {
          // Leave the population effect to reconcile the roster on the next poll.
        })
        .finally(() => {
          window.setTimeout(() => {
            useVideoStreamsStore.getState().setSwitching(droneId, false);
          }, STREAM_RESTART_MS);
        });
    } else if (target.kind === "concurrent" && target.address?.whepUrl) {
      // Instant client-side flip: point the cascade at this leg's WHEP URL via
      // the switcher override (which the status poller never touches, so the
      // selection survives polls), then force a re-offer (WHEP cannot
      // renegotiate in place). Selecting the FIRST/default leg clears the
      // override so video falls back to the poller-owned default URL.
      const v = useVideoStore.getState();
      const isDefaultLeg = target.index === 1;
      v.setWhepUrlOverride(isDefaultLeg ? null : target.address.whepUrl);
      v.signalVideoStall();
    }
  }, [droneId, activeId, client]);
}
