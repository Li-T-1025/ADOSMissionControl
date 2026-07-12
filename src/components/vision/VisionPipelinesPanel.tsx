"use client";

/**
 * @module vision/VisionPipelinesPanel
 * @description The vision hub's "pipelines running now" panel: one row per
 * active detection stream (model × camera) on the drone, so an operator sees
 * every perception pipeline running simultaneously with its live state — the
 * central-hub visibility the single-active-model summary never gave. Derived
 * from the live detection streams (`useVisionPipelines`); a stream that stops
 * publishing flips to a "stalled" state rather than lingering.
 *
 * @license GPL-3.0-only
 */

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import { Activity, Layers, Moon } from "lucide-react";

import {
  useVisionPipelines,
  type VisionPipeline,
} from "@/hooks/use-vision-pipelines";
import { useVisionEngineModels } from "@/hooks/use-vision-engine-models";
import type { EngineModel } from "@/lib/agent/vision-client";

function ageLabel(ms: number): string {
  if (ms < 1000) return "now";
  const s = Math.round(ms / 1000);
  return s < 60 ? `${s}s ago` : `${Math.round(s / 60)}m ago`;
}

function PipelineRow({ p }: { p: VisionPipeline }) {
  const color = p.active
    ? "var(--status-success, #22c55e)"
    : "var(--status-warning, #f59e0b)";
  return (
    <div
      className="flex items-center gap-3 rounded border border-border-default bg-bg-primary px-3 py-2"
      data-testid="vision-pipeline-row"
      data-active={p.active}
    >
      <span
        className="h-2 w-2 flex-none rounded-full"
        style={{ background: color }}
        aria-hidden="true"
      />
      <div className="min-w-0 flex-1">
        <div className="truncate font-mono text-xs text-text-primary">
          {p.modelId}
        </div>
        <div className="font-mono text-[10px] text-text-tertiary">
          {p.cameraId}
        </div>
      </div>
      <div className="text-right font-mono">
        <div className="text-xs tabular-nums text-text-primary">
          {p.detectionCount}
          {p.lockedCount > 0 ? (
            <span style={{ color: "var(--status-success, #22c55e)" }}>
              {" "}
              ·{p.lockedCount}🔒
            </span>
          ) : null}
        </div>
        <div className="text-[10px] uppercase tracking-wide text-text-tertiary">
          {ageLabel(p.ageMs)}
        </div>
      </div>
    </div>
  );
}

/** A model the engine has loaded but that is publishing nothing right now
 * (registered, no live stream) — shown so the operator sees the whole model
 * set, not only what happens to be producing detections this instant. */
function IdleModelRow({ m }: { m: EngineModel }) {
  return (
    <div
      className="flex items-center gap-3 rounded border border-border-default bg-bg-primary/60 px-3 py-2"
      data-testid="vision-idle-model-row"
      data-model-id={m.id}
    >
      <Moon
        size={12}
        className="flex-none text-text-tertiary"
        aria-hidden="true"
      />
      <div className="min-w-0 flex-1">
        <div className="truncate font-mono text-xs text-text-secondary">
          {m.id}
        </div>
        <div className="font-mono text-[10px] text-text-tertiary">
          {[m.kind, m.execution].filter(Boolean).join(" · ")}
        </div>
      </div>
      <span className="text-[10px] uppercase tracking-wide text-text-tertiary">
        {m.backendLoaded ? "loaded" : "registered"}
      </span>
    </div>
  );
}

export function VisionPipelinesPanel({ droneId }: { droneId: string }) {
  const t = useTranslations("vision");
  const pipelines = useVisionPipelines(droneId);
  const engineModels = useVisionEngineModels();
  const runningCount = pipelines.filter((p) => p.active).length;

  // A model is "idle" when the engine holds it but no live stream carries it.
  const idleModels = useMemo(() => {
    const streaming = new Set(pipelines.map((p) => p.modelId));
    return engineModels.filter((m) => !streaming.has(m.id));
  }, [engineModels, pipelines]);

  const isEmpty = pipelines.length === 0 && idleModels.length === 0;

  return (
    <section className="rounded border border-border-default bg-bg-secondary p-3">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="flex items-center gap-1.5 text-xs uppercase tracking-wide text-text-secondary">
          <Layers size={13} aria-hidden="true" />
          {t("pipelines")}
        </h3>
        <span className="flex items-center gap-1 font-mono text-[10px] text-text-tertiary">
          <Activity size={11} aria-hidden="true" />
          {t("pipelinesRunning", { count: runningCount })}
        </span>
      </div>
      {isEmpty ? (
        <p className="py-4 text-center text-[11px] text-text-tertiary">
          {t("noPipelines")}
        </p>
      ) : (
        <div className="flex flex-col gap-1.5">
          {pipelines.map((p) => (
            <PipelineRow key={p.key} p={p} />
          ))}
          {idleModels.map((m) => (
            <IdleModelRow key={`idle:${m.id}`} m={m} />
          ))}
        </div>
      )}
    </section>
  );
}
