"use client";

/**
 * @module DroneLiveWorldTab
 * @description The during-flight Atlas "Live World" view: the drone-side
 * monitor of a world-model capture session (capture stats, the building splat,
 * the paired reconstructor, and the active transport bearer). Reads the live
 * `atlas*` heartbeat fields off the focused-drone atlas store; renders an
 * "awaiting capture" state when the drone reports no session. Mounted behind the
 * Atlas flag. The post-flight World Model viewer (the gsplat / Potree / Cesium
 * switcher) ships with the visualization deps.
 * @license GPL-3.0-only
 */

import { useEffect, useState } from "react";
import { Activity, Boxes, Clock, Radio } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAtlasStore } from "@/stores/atlas-store";

// The Atlas capture fields ride the drone cloud heartbeat (~seconds cadence),
// not the 10 Hz telemetry stream, so the staleness budget is heartbeat-scaled.
const STALE_MS = 15000;

function num(v: number | null): string {
  return v === null ? "—" : String(v);
}

function rate(v: number | null): string {
  return v === null ? "—" : v.toFixed(1);
}

/** "12s ago" / "3m ago" from an epoch-ms timestamp, or null when absent. */
function ago(tsMs: number | null, nowMs: number): string | null {
  if (tsMs === null) return null;
  const s = Math.max(0, Math.round((nowMs - tsMs) / 1000));
  return s < 60 ? `${s}s ago` : `${Math.round(s / 60)}m ago`;
}

/** A 1 Hz re-render tick so the age-derived staleness recomputes live. */
function useNowTick(): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  return now;
}

// The agent's CaptureState vocabulary (idle/capturing/paused/finalizing/bagged),
// plus a few forward-looking states a richer producer may emit.
const STATE_TONE: Record<string, string> = {
  capturing: "text-status-success",
  active: "text-status-success",
  finalizing: "text-accent-primary",
  ready: "text-accent-primary",
  paused: "text-status-warning",
  bagged: "text-text-tertiary",
  ended: "text-text-tertiary",
  idle: "text-text-tertiary",
  error: "text-status-error",
};

const VIO_TONE: Record<string, string> = {
  good: "text-status-success",
  degraded: "text-status-warning",
  lost: "text-status-error",
};

const BEARER_LABEL: Record<string, string> = {
  "direct-lan": "Direct LAN",
  "wfb-relay": "WFB relay",
  cloud: "Cloud relay",
};

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded bg-white/[0.02] px-2 py-1.5 text-center">
      <div className="text-sm font-mono text-text-primary tabular-nums">{value}</div>
      <div className="text-[9px] uppercase tracking-wide text-text-tertiary">
        {label}
      </div>
    </div>
  );
}

function Card({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: typeof Activity;
  children: React.ReactNode;
}) {
  return (
    <div className="border border-border-default rounded-lg p-4 space-y-3">
      <div className="flex items-center gap-1.5">
        <Icon className="w-3.5 h-3.5 text-text-tertiary" />
        <span className="text-xs font-medium text-text-secondary">{title}</span>
      </div>
      {children}
    </div>
  );
}

export function DroneLiveWorldTab() {
  const live = useAtlasStore((s) => s.live);
  const now = useNowTick();

  if (live.state === null) {
    return (
      <div className="p-4">
        <div className="border border-border-default rounded-lg p-6 text-center">
          <Boxes className="w-5 h-5 text-text-tertiary mx-auto mb-2" />
          <p className="text-[11px] text-text-tertiary">
            Awaiting Atlas capture. This drone is not reporting a world-model
            session.
          </p>
        </div>
      </div>
    );
  }

  // Rule 44: never render a frozen heartbeat as live. When the heartbeat has
  // gone quiet past the budget, badge it stale and dim the rates rather than
  // showing the last "capturing" snapshot with a live-looking green badge.
  const heartbeatAge = live.updatedAt === null ? null : now - live.updatedAt;
  const isStale = heartbeatAge === null || heartbeatAge > STALE_MS;
  const stateTone = isStale
    ? "text-status-warning"
    : STATE_TONE[live.state] ?? "text-text-secondary";
  const kfAgo = ago(live.lastKfAt, now);

  return (
    <div className="p-4 space-y-4">
      {/* Session header */}
      <div className="flex items-center justify-between border border-border-default rounded-lg p-3">
        <div className="flex items-center gap-2">
          <Boxes className="w-4 h-4 text-text-tertiary" />
          <span className="text-sm font-medium text-text-primary">Live World</span>
          <span
            className={cn(
              "text-[10px] font-medium px-1.5 py-0.5 rounded bg-white/[0.04]",
              stateTone,
            )}
          >
            {isStale ? "stale" : live.state}
          </span>
          {isStale && (
            <span className="flex items-center gap-1 text-[10px] text-status-warning">
              <Clock className="w-3 h-3" />
              {ago(live.updatedAt, now) ?? "no heartbeat"}
            </span>
          )}
        </div>
        <span
          className="text-[10px] font-mono text-text-tertiary truncate max-w-[40%]"
          title={live.sessionId ?? undefined}
        >
          {live.sessionId ?? "no session"}
        </span>
      </div>

      <div
        className={cn(
          "grid grid-cols-1 xl:grid-cols-2 gap-4 transition-opacity",
          isStale && "opacity-50",
        )}
      >
        <Card title="Capture" icon={Activity}>
          <div className="grid grid-cols-2 gap-2">
            <Stat label="Keyframes" value={num(live.keyframesIngested)} />
            <Stat label="Ingest Hz" value={rate(live.ingestRateHz)} />
            <Stat label="Cameras" value={num(live.cameraCount)} />
            <Stat label="Gaussians" value={num(live.gaussianCount)} />
            <Stat label="Steps/s" value={rate(live.trainingStepsPerSec)} />
          </div>
          {live.vioHealth !== null && (
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-text-tertiary">VIO tracking</span>
              <span
                className={cn(
                  "font-medium",
                  VIO_TONE[live.vioHealth] ?? "text-text-secondary",
                )}
              >
                {live.vioHealth}
              </span>
            </div>
          )}
        </Card>

        <Card title="Stream" icon={Radio}>
          <div className="space-y-1.5 text-[11px]">
            <div className="flex items-center justify-between">
              <span className="text-text-tertiary">Compute node</span>
              <span
                className="font-mono text-text-secondary truncate max-w-[60%]"
                title={live.computeNodeId ?? undefined}
              >
                {live.computeNodeId ?? "—"}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-text-tertiary">Bearer</span>
              <span className="font-mono text-text-secondary">
                {live.bearer ? BEARER_LABEL[live.bearer] ?? live.bearer : "—"}
              </span>
            </div>
            {live.bearer === "wfb-relay" && (
              <div className="flex items-center justify-between">
                <span className="text-text-tertiary">Relay decimation</span>
                <span className="font-mono text-text-secondary tabular-nums">
                  {num(live.relayDecimation)}
                </span>
              </div>
            )}
            <div className="flex items-center justify-between">
              <span className="text-text-tertiary">Last keyframe</span>
              <span className="font-mono text-text-secondary tabular-nums">
                {kfAgo ?? "—"}
              </span>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
