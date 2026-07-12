"use client";

/**
 * @module vision/WhatsLockedChip
 * @description The "what's locked" chip — the single, shared, honest readout of
 * the operator-designated target. Every target-following mode (Follow-Me, gimbal
 * aim, a future ActiveTrack) obeys the ONE engine-owned lock; this chip surfaces
 * it so the operator always knows what is designated, its class + track id, its
 * LIVE lock state (locked / uncertain / lost, read from the detection stream by
 * track id — not a stale copy), and confidence. Shown only while a target is
 * selected on this drone. Registered as a built-in cockpit widget, so it lives
 * in the cockpit widget registry alongside any plugin widget.
 *
 * @license GPL-3.0-only
 */

import { Crosshair } from "lucide-react";

import {
  useVisionDetectionsStore,
  type LockState,
} from "@/stores/vision-detections-store";
import { useSelectedTargetStore } from "@/stores/selected-target-store";

/** Color + label for a live lock state (matches the host overlay's box colors). */
function lockStyle(state: LockState | null): { color: string; label: string } {
  switch (state) {
    case "locked":
      return { color: "var(--status-success, #22c55e)", label: "Locked" };
    case "uncertain":
      return { color: "var(--status-warning, #f59e0b)", label: "Uncertain" };
    case "lost":
      return { color: "var(--status-error, #ef4444)", label: "Lost" };
    default:
      return { color: "var(--accent-primary, #38bdf8)", label: "Selected" };
  }
}

export function WhatsLockedChip({ droneId }: { droneId: string }) {
  const selected = useSelectedTargetStore((s) => s.selected);
  const batch = useVisionDetectionsStore((s) => s.batches[droneId]);

  const here = selected && selected.droneId === droneId ? selected : null;
  if (!here) return null;

  // The LIVE lock state for the designated track, read from the current batch by
  // track id (never a stale field on the selection). Absent when untracked or
  // the feed has no matching detection this frame.
  const live =
    here.trackId != null && batch
      ? batch.detections.find((d) => d.trackId === here.trackId)
      : undefined;
  const lock = lockStyle(live?.lockState ?? null);
  const confidence = live?.confidence ?? here.confidence;

  return (
    <div
      className="pointer-events-none absolute left-1/2 top-12 z-20 -translate-x-1/2"
      data-cockpit-widget="whats-locked"
    >
      <div
        className="flex items-center gap-2.5 rounded-lg border bg-black/60 px-3 py-1.5 backdrop-blur-sm"
        style={{ borderColor: `${lock.color}88` }}
      >
        <Crosshair size={16} style={{ color: lock.color }} aria-hidden="true" />
        <div className="font-mono leading-tight">
          <div className="text-[12px] text-white">
            {here.classLabel}
            {here.trackId != null ? ` · trk ${here.trackId}` : ""}
          </div>
          <div
            className="text-[9.5px] uppercase tracking-wider"
            style={{ color: lock.color }}
          >
            {lock.label}
          </div>
        </div>
        <div className="border-l border-white/15 pl-2.5 text-right font-mono">
          <div className="text-[12px] tabular-nums text-white">
            {Math.round(confidence * 100)}%
          </div>
          <div className="text-[8.5px] uppercase tracking-wide text-text-tertiary">
            conf
          </div>
        </div>
      </div>
    </div>
  );
}
