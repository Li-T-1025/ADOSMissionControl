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
import { Loader2, RefreshCw, X } from "lucide-react";
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
  const { status: pipStatus, retry: pipRetry } = usePipVideo(
    isDemoMode() ? null : whepUrl,
    videoRef,
  );

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

  // Keyboard move: arrow keys nudge the inset (shift = larger step), clamped to
  // the container so it can never be pushed off-screen. Mirrors the drag clamp.
  const nudge = (dx: number, dy: number) => {
    const el = rootRef.current;
    const parent = el?.offsetParent as HTMLElement | null;
    if (!el || !parent) return;
    const rect = el.getBoundingClientRect();
    const prect = parent.getBoundingClientRect();
    const curX = pos ? pos.x : rect.left - prect.left;
    const curY = pos ? pos.y : rect.top - prect.top;
    const x = Math.min(
      Math.max(0, curX + dx),
      Math.max(0, prect.width - el.offsetWidth),
    );
    const y = Math.min(
      Math.max(0, curY + dy),
      Math.max(0, prect.height - el.offsetHeight),
    );
    setPos({ x, y });
  };
  const onHandleKeyDown = (e: React.KeyboardEvent) => {
    const step = e.shiftKey ? 40 : 12;
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      nudge(-step, 0);
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      nudge(step, 0);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      nudge(0, -step);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      nudge(0, step);
    }
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
        {/* The label doubles as the keyboard-movable handle (arrow keys nudge
            the inset); the drag pointer handlers stay on the whole header. */}
        <span
          className="lbl"
          role="button"
          tabIndex={0}
          aria-label={t("pipMove")}
          onKeyDown={onHandleKeyDown}
        >
          {label}
        </span>
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
          <>
            <video
              ref={videoRef}
              autoPlay
              muted
              playsInline
              className="absolute inset-0 h-full w-full object-cover"
            />
            {/* A failed / connecting inset shows its state instead of a silent
                black rectangle (mirrors the main VideoCanvas placeholder). */}
            {pipStatus !== "live" && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-bg-primary/70">
                {pipStatus === "error" ? (
                  <>
                    <span className="text-[9px] font-mono uppercase tracking-wider text-status-error">
                      {t("pipNoSignal")}
                    </span>
                    <button
                      type="button"
                      onClick={pipRetry}
                      aria-label={t("pipRetry")}
                      className="flex items-center gap-1 border border-border-default px-1.5 py-0.5 text-[9px] font-mono text-text-secondary transition-colors hover:border-accent-primary hover:text-accent-primary"
                    >
                      <RefreshCw size={9} aria-hidden="true" />
                      {t("pipRetry")}
                    </button>
                  </>
                ) : (
                  <Loader2
                    size={16}
                    className="animate-spin text-text-tertiary"
                    aria-label={t("pipConnecting")}
                  />
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
