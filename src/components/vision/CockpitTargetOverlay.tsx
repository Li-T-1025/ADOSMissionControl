"use client";

/**
 * @module vision/CockpitTargetOverlay
 * @description The HOST-owned detection / target overlay for the cockpit. It
 * draws the live detection boxes over the letterbox-corrected video rect
 * (reading the shared vision-detections store), lets the operator CLICK a box to
 * select it, highlights the selection, and anchors the target-action popup to
 * it. Unlike a plugin's own `video.overlay` iframe, this is owned by the host,
 * so a single overlay can aggregate actions from every plugin for the clicked
 * target (the popup) and one selection is shared across the app.
 *
 * Boxes are the only interactive elements (`pointer-events-auto`); the wrapper
 * is `pointer-events-none` so the rest of the video pane stays interactive.
 *
 * @license GPL-3.0-only
 */

import { useEffect, useRef, useState } from "react";

import { computeRenderedRect } from "@/components/fly/VideoOverlayHost";
import type { RenderedRect } from "@/lib/plugins/video-overlay-props";
import {
  useVisionDetectionsStore,
  type DetectionBox,
  type VisionDetection,
} from "@/stores/vision-detections-store";
import { useSelectedTargetStore } from "@/stores/selected-target-store";
import { TargetActionPopup } from "./TargetActionPopup";

const STALE_MS = 2000;

/** Border/label color for a box: green locked / amber uncertain / red lost when
 * tracked, else a confidence ramp. */
function boxColor(d: VisionDetection): string {
  if (d.trackId != null && d.lockState) {
    if (d.lockState === "locked") return "var(--status-success, #22c55e)";
    if (d.lockState === "uncertain") return "var(--status-warning, #f59e0b)";
    return "var(--status-error, #ef4444)";
  }
  if (d.confidence >= 0.7) return "var(--accent-primary, #38bdf8)";
  if (d.confidence >= 0.4) return "var(--status-warning, #f59e0b)";
  return "var(--text-tertiary, #9ca3af)";
}

/** Whether a detection is the currently-selected target. */
function isSelected(
  d: VisionDetection,
  selected: { trackId: number | null; bbox: DetectionBox } | null,
): boolean {
  if (!selected) return false;
  if (selected.trackId != null && d.trackId != null)
    return d.trackId === selected.trackId;
  if (selected.trackId == null && d.trackId == null)
    return (
      d.bbox.x === selected.bbox.x &&
      d.bbox.y === selected.bbox.y &&
      d.bbox.width === selected.bbox.width
    );
  return false;
}

export function CockpitTargetOverlay({ droneId }: { droneId: string }) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const batch = useVisionDetectionsStore((s) => s.batches[droneId]);
  const selected = useSelectedTargetStore((s) => s.selected);
  const select = useSelectedTargetStore((s) => s.select);
  const clear = useSelectedTargetStore((s) => s.clear);

  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  const [now, setNow] = useState(() => Date.now());

  // Staleness clock — drop boxes once the feed stops even with no new batch.
  useEffect(() => {
    if (!batch) return;
    const id = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(id);
  }, [batch]);

  // Track the overlay's own size. Boxes are letterbox-mapped from the detection
  // FRAME (batch.frameWidth × frameHeight) into this container, which shares the
  // video's aspect (the frame is downscaled from it) — so the overlay works with
  // or without a live <video> element (e.g. demo, or a not-yet-flowing stream).
  useEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;
    const measure = () => setSize({ w: wrapper.clientWidth, h: wrapper.clientHeight });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(wrapper);
    return () => ro.disconnect();
  }, []);

  const rect: RenderedRect | null =
    size &&
    batch &&
    batch.frameWidth > 0 &&
    batch.frameHeight > 0 &&
    size.w > 0 &&
    size.h > 0
      ? computeRenderedRect(size.w, size.h, batch.frameWidth, batch.frameHeight)
      : null;

  // Clear the selection on drone switch / unmount so B never shows A's popup.
  useEffect(() => {
    return () => clear();
  }, [droneId, clear]);

  // Escape + outside-click dismiss the popup.
  useEffect(() => {
    if (!selected) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopImmediatePropagation();
        clear();
      }
    };
    const onDown = (e: MouseEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && t.closest("[data-target-interactive]")) return;
      clear();
    };
    window.addEventListener("keydown", onKey, true);
    window.addEventListener("mousedown", onDown, true);
    return () => {
      window.removeEventListener("keydown", onKey, true);
      window.removeEventListener("mousedown", onDown, true);
    };
  }, [selected, clear]);

  const fresh =
    batch &&
    now - batch.receivedAt <= STALE_MS &&
    batch.frameWidth > 0 &&
    batch.frameHeight > 0;
  const detections = fresh ? batch.detections : [];

  const place = (bbox: DetectionBox) => {
    if (!rect || !batch) return null;
    const sx = rect.width / batch.frameWidth;
    const sy = rect.height / batch.frameHeight;
    return {
      left: rect.left + bbox.x * sx,
      top: rect.top + bbox.y * sy,
      width: bbox.width * sx,
      height: bbox.height * sy,
    };
  };

  const selectedHere = selected && selected.droneId === droneId ? selected : null;

  return (
    <div
      ref={wrapperRef}
      className="pointer-events-none absolute inset-0 z-[6]"
      data-cockpit-layer="target-overlay"
    >
      {rect &&
        batch &&
        detections.map((d, i) => {
          const p = place(d.bbox);
          if (!p) return null;
          const sel = isSelected(d, selectedHere);
          const color = boxColor(d);
          const label =
            d.trackId != null
              ? `${d.classLabel} #${d.trackId} ${Math.round(d.confidence * 100)}%`
              : `${d.classLabel} ${Math.round(d.confidence * 100)}%`;
          return (
            <button
              key={`${batch.frameId}-${i}`}
              type="button"
              data-target-interactive
              onClick={() =>
                select({
                  droneId,
                  cameraId: batch.cameraId,
                  trackId: d.trackId ?? null,
                  bbox: d.bbox,
                  classLabel: d.classLabel,
                  confidence: d.confidence,
                })
              }
              className="pointer-events-auto absolute cursor-pointer bg-transparent p-0 hover:brightness-125"
              style={{
                left: `${p.left}px`,
                top: `${p.top}px`,
                width: `${p.width}px`,
                height: `${p.height}px`,
                border: `${sel ? 2 : 1}px solid ${color}`,
                boxShadow: sel ? `0 0 0 2px ${color}55` : undefined,
                boxSizing: "border-box",
              }}
              title={label}
            >
              <span
                className="absolute left-0 top-0 -translate-y-full whitespace-nowrap px-1 font-mono text-[10px] leading-tight"
                style={{ background: "rgba(0,0,0,0.7)", color }}
              >
                {label}
              </span>
            </button>
          );
        })}

      {/* The action popup, anchored just under the selected box. */}
      {selectedHere &&
        rect &&
        (() => {
          const p = place(selectedHere.bbox);
          if (!p) return null;
          return (
            <div
              className="absolute z-[7]"
              style={{ left: `${p.left}px`, top: `${p.top + p.height + 4}px` }}
            >
              <TargetActionPopup target={selectedHere} onClose={clear} />
            </div>
          );
        })()}
    </div>
  );
}
