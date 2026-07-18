"use client";

/**
 * @module fly/CockpitPipInset
 * @description The cockpit picture-in-picture inset: a small draggable corner
 * window over the main video showing a SECOND stream (e.g. thermal over EO)
 * while the main view stays on the active stream. Shown only when a PiP stream
 * is set (the operator toggles it with `P` or a tab affordance). Overlays follow
 * the MAIN active stream, not this inset.
 *
 * The inset uses an isolated WHEP player (`usePipVideo`) so the second live feed
 * never disturbs the main singleton session. In demo mode there is no live
 * WebRTC, so it renders the synthetic per-stream canvas instead.
 *
 * @license GPL-3.0-only
 */

import { useRef, useState } from "react";
import { X } from "lucide-react";
import { useTranslations } from "next-intl";

import { isDemoMode } from "@/lib/utils";
import { usePipVideo } from "@/hooks/use-pip-video";
import {
  ROLE_LABEL_KEY,
  useVideoStreamsStore,
} from "@/stores/video-streams-store";
import { CockpitDemoStream } from "@/components/fly/CockpitDemoStream";

interface CockpitPipInsetProps {
  droneId: string;
}

export function CockpitPipInset({ droneId }: CockpitPipInsetProps) {
  const t = useTranslations("cockpitStreams");
  const pipId = useVideoStreamsStore((s) => s.pipStreamIdByDrone[droneId]);
  const streams = useVideoStreamsStore((s) => s.streamsByDrone[droneId]);
  const setPip = useVideoStreamsStore((s) => s.setPip);

  const videoRef = useRef<HTMLVideoElement>(null);
  // Drag position (px from the container's top-left). Null → the default
  // bottom-right corner via CSS.
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const dragRef = useRef<{ ox: number; oy: number } | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  const pip = (streams ?? []).find((s) => s.id === pipId) ?? null;
  const whepUrl =
    pip?.kind === "concurrent" ? (pip.address?.whepUrl ?? null) : null;
  // Only drive the isolated player for a real concurrent leg (demo uses canvas).
  usePipVideo(isDemoMode() ? null : whepUrl, videoRef);

  if (!pip) return null;

  const label = pip.role && ROLE_LABEL_KEY[pip.role] ? t(ROLE_LABEL_KEY[pip.role]) : pip.label;

  const onPointerDown = (e: React.PointerEvent) => {
    const el = rootRef.current;
    const parent = el?.offsetParent as HTMLElement | null;
    if (!el || !parent) return;
    const rect = el.getBoundingClientRect();
    const prect = parent.getBoundingClientRect();
    // Switch to explicit px positioning from wherever the inset currently sits.
    setPos({ x: rect.left - prect.left, y: rect.top - prect.top });
    dragRef.current = { ox: e.clientX - rect.left, oy: e.clientY - rect.top };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const drag = dragRef.current;
    const parent = rootRef.current?.offsetParent as HTMLElement | null;
    if (!drag || !parent) return;
    const prect = parent.getBoundingClientRect();
    const w = rootRef.current?.offsetWidth ?? 0;
    const h = rootRef.current?.offsetHeight ?? 0;
    const x = Math.min(
      Math.max(0, e.clientX - prect.left - drag.ox),
      prect.width - w,
    );
    const y = Math.min(
      Math.max(0, e.clientY - prect.top - drag.oy),
      prect.height - h,
    );
    setPos({ x, y });
  };
  const onPointerUp = (e: React.PointerEvent) => {
    dragRef.current = null;
    (e.target as HTMLElement).releasePointerCapture(e.pointerId);
  };

  const style: React.CSSProperties = pos
    ? { left: `${pos.x}px`, top: `${pos.y}px`, right: "auto", bottom: "auto" }
    : {};

  return (
    <div
      ref={rootRef}
      className="pipinset panel pointer-events-auto"
      style={style}
      data-cockpit-layer="pip"
    >
      <div
        className="piphead"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
      >
        <span className="lbl">{label}</span>
        <button
          type="button"
          className="pipclose"
          aria-label={t("pipHide")}
          title={t("pipHide")}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={() => setPip(droneId, null)}
        >
          <X size={12} aria-hidden="true" />
        </button>
      </div>
      <div className="pipbody">
        {isDemoMode() ? (
          <CockpitDemoStream droneId={droneId} streamId={pip.id} />
        ) : (
          <video
            ref={videoRef}
            autoPlay
            muted
            playsInline
            className="absolute inset-0 h-full w-full object-cover"
          />
        )}
      </div>
    </div>
  );
}
