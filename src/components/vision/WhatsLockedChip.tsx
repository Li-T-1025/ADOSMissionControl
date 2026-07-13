"use client";

/**
 * @module vision/WhatsLockedChip
 * @description The "what's locked" chip — a faithful port of the reference
 * artifact's `.lockchip` (icon tile · who/state · range). The single, shared,
 * honest readout of the operator-designated target: class + track id, its LIVE
 * lock state (read from the detection stream by track id, not a stale copy),
 * and confidence. Shown only while a target is selected on this drone. Styling
 * is the artifact's (`.ados-cockpit .lockchip`).
 * @license GPL-3.0-only
 */

import { Crosshair } from "lucide-react";

import {
  useVisionDetectionsStore,
  type LockState,
} from "@/stores/vision-detections-store";
import { useSelectedTargetStore } from "@/stores/selected-target-store";

/** Human label for a live lock state. */
function lockLabel(state: LockState | null): string {
  switch (state) {
    case "locked":
      return "Locked";
    case "uncertain":
      return "Uncertain";
    case "lost":
      return "Lost";
    default:
      return "Selected";
  }
}

export function WhatsLockedChip({ droneId }: { droneId: string }) {
  const selected = useSelectedTargetStore((s) => s.selected);
  const batch = useVisionDetectionsStore((s) => s.batches[droneId]);

  const here = selected && selected.droneId === droneId ? selected : null;
  if (!here) return null;

  const live =
    here.trackId != null && batch
      ? batch.detections.find((d) => d.trackId === here.trackId)
      : undefined;
  const label = lockLabel(live?.lockState ?? null);
  const confidence = live?.confidence ?? here.confidence;
  const who =
    here.trackId != null
      ? `${here.classLabel} · trk ${here.trackId}`
      : here.classLabel;

  return (
    <div
      className="lockchip"
      style={{ left: "50%", top: 48, transform: "translateX(-50%)" }}
      data-cockpit-widget="whats-locked"
    >
      <div className="ic">
        <Crosshair size={14} aria-hidden="true" />
      </div>
      <div className="who">
        <b>{who}</b>
        <span>{label}</span>
      </div>
      <div className="rng">
        {Math.round(confidence * 100)}%<small>conf</small>
      </div>
    </div>
  );
}
