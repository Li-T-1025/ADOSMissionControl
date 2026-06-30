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

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Activity, Boxes, Clock, Radio } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  ATLAS_VIEWERS,
  DEFAULT_ATLAS_VIEWER,
  viewerHintOf,
  type AtlasViewer,
} from "@/components/atlas/viewer-types";
import { WorldModelViewport } from "@/components/atlas/WorldModelViewport";
import { useConvexSkipQuery } from "@/hooks/use-convex-skip-query";
import { cmdAtlasJobsApi } from "@/lib/community-api-drones";
import { useAtlasStore } from "@/stores/atlas-store";
import { useAtlasLocalState } from "@/hooks/use-atlas-local-state";
import type { Doc } from "../../../convex/_generated/dataModel";

type AtlasJob = Doc<"cmd_atlasJobs">;

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

export function DroneLiveWorldTab({ droneId }: { droneId?: string }) {
  const t = useTranslations("atlas");
  const live = useAtlasStore((s) => s.live);
  const now = useNowTick();
  // Local-first: poll this drone's agent for its Atlas state when LAN-paired
  // (signed out), feeding the same store the cloud heartbeat path feeds.
  useAtlasLocalState(droneId);

  // The reconstructions ride the SAME source as the post-flight World Model tab:
  // the reactive `cmd_atlasJobs` list resolved through the capturing device.
  // Because it is reactive, each periodic reconstruct the compute node lands
  // updates this list automatically, so the latest-artifact selection refreshes
  // live as cycles complete. Skips in demo / no-convex / no-deviceId.
  const jobs = useConvexSkipQuery(cmdAtlasJobsApi.listForDevice, {
    args: { deviceId: droneId ?? "" },
    enabled: Boolean(droneId),
  }) as AtlasJob[] | undefined;

  // A manual viewer choice, keyed to the session it was made for; when the
  // active session changes the override drops and the viewer follows its hint.
  const [override, setOverride] = useState<{
    sessionKey: string;
    viewer: AtlasViewer;
  } | null>(null);

  // The newest completed reconstruction for the ACTIVE session. Memoized on the
  // reconstruction list + the session id only — NOT on the ~1 Hz telemetry tick
  // that also re-renders this component — so the resolved artifact URL is the
  // same string across ticks and the viewer never remounts; it recomputes only
  // when a genuinely newer reconstruction lands (the list is reactive) or the
  // session changes. The list is returned newest-first and is scoped to the
  // active session; before the drone reports a session id, it falls back to the
  // newest completed world for this device.
  const { artifactUrl, viewerHint } = useMemo<{
    artifactUrl: string | null;
    viewerHint: AtlasViewer | null;
  }>(() => {
    const list = jobs ?? [];
    const scoped = live.sessionId
      ? list.filter((j) => j.sessionId === live.sessionId)
      : list;
    const done = scoped.find(
      (j) => j.status === "done" && Boolean(j.outputUrl),
    );
    return {
      artifactUrl: done?.outputUrl ?? null,
      viewerHint: done ? viewerHintOf(done.metadata) : null,
    };
  }, [jobs, live.sessionId]);

  if (live.state === null) {
    return (
      <div className="p-4">
        <div className="border border-border-default rounded-lg p-6 text-center">
          <Boxes className="w-5 h-5 text-text-tertiary mx-auto mb-2" />
          <p className="text-[11px] text-text-tertiary">{t("liveWorldEmpty")}</p>
        </div>
      </div>
    );
  }

  // ── Live world (active session only) ────────────────────────────────────────
  const sessionKey = live.sessionId ?? "";
  const viewer =
    override && override.sessionKey === sessionKey
      ? override.viewer
      : viewerHint ?? DEFAULT_ATLAS_VIEWER;

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

      {/* Live world model: the newest completed reconstruction for the active
          session, refreshing in place as periodic reconstruct cycles land. */}
      <div className="border border-border-default rounded-lg overflow-hidden">
        <div className="flex items-center gap-2 px-3 py-2 border-b border-border-default">
          <Boxes className="w-3.5 h-3.5 text-text-tertiary" />
          <span className="text-xs font-medium text-text-secondary">
            World model
          </span>
          {artifactUrl && (
            <div
              className="flex items-center gap-1 ml-auto"
              role="group"
              aria-label="Viewer"
            >
              {ATLAS_VIEWERS.map((vw) => (
                <button
                  key={vw.id}
                  type="button"
                  aria-pressed={viewer === vw.id}
                  onClick={() => setOverride({ sessionKey, viewer: vw.id })}
                  className={cn(
                    "text-[11px] px-2 py-1 rounded transition-colors",
                    viewer === vw.id
                      ? "bg-accent-primary/20 text-accent-primary"
                      : "text-text-tertiary hover:text-text-secondary",
                  )}
                >
                  {vw.label}
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="relative h-[420px]">
          {artifactUrl ? (
            <WorldModelViewport viewer={viewer} artifactUrl={artifactUrl} />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center p-6">
              <div className="text-center">
                <Boxes className="w-5 h-5 text-text-tertiary mx-auto mb-2 animate-pulse" />
                <p className="text-[11px] text-text-tertiary max-w-xs">
                  {t("liveWorldBuilding")}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
