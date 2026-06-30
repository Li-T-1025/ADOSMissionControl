"use client";

/**
 * @module DroneWorldModelTab
 * @description The post-flight Atlas "World Model" tab: a session selector + a
 * viewer switcher (Rerun / Splat / Cloud) over the world a captured session
 * reconstructed on the compute node. The session list rides `cmd_atlasJobs`
 * (resolved by the capturing device id); the selected — or latest finished —
 * session's signed artifact URL feeds the viewport, and the viewer defaults
 * from the session's `viewerHint`. Mounted behind the Atlas flag; shows the
 * no-reconstruction empty state until a finished session exists.
 * @license GPL-3.0-only
 */

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Boxes } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  ATLAS_VIEWERS,
  DEFAULT_ATLAS_VIEWER,
  viewerHintOf,
  type AtlasViewer,
} from "@/components/atlas/viewer-types";
import { WorldModelViewport } from "@/components/atlas/WorldModelViewport";
import { Select, type SelectOption } from "@/components/ui/select";
import { useConvexSkipQuery } from "@/hooks/use-convex-skip-query";
import { cmdAtlasJobsApi } from "@/lib/community-api-drones";
import type { Doc } from "../../../convex/_generated/dataModel";

type AtlasJob = Doc<"cmd_atlasJobs">;

/** A short, human-ish session label. */
function sessionLabel(job: AtlasJob): string {
  const id = job.sessionId ?? job._id;
  return `${job.kind} · ${id.slice(0, 8)} · ${job.status}`;
}

export function DroneWorldModelTab({ droneId }: { droneId?: string }) {
  const t = useTranslations("atlas");
  const [selectedJobId, setSelectedJobId] = useState<string>("");
  // A manual viewer choice keyed to the session it was made for; when the
  // session changes the override drops and the viewer follows its hint.
  const [override, setOverride] = useState<{
    jobId: string;
    viewer: AtlasViewer;
  } | null>(null);

  // Sessions ride cmd_atlasJobs (ownership resolves through the capturing
  // device). Skips in demo / no-convex / no-deviceId via the skip guard.
  const jobs = useConvexSkipQuery(cmdAtlasJobsApi.listForDevice, {
    args: { deviceId: droneId ?? "" },
    enabled: Boolean(droneId),
  }) as AtlasJob[] | undefined;

  const sessions = jobs ?? [];
  // The newest finished session with a fetchable artifact is the default.
  const latestDone = sessions.find(
    (j) => j.status === "done" && Boolean(j.outputUrl),
  );
  const selected =
    sessions.find((j) => j._id === selectedJobId) ?? latestDone ?? null;
  const artifactUrl =
    selected && selected.status === "done" ? selected.outputUrl ?? null : null;

  // The viewer follows the selected session's hint unless the operator
  // overrode it for that same session.
  const selectedId = selected?._id ?? "";
  const hint = selected ? viewerHintOf(selected.metadata) : null;
  const viewer =
    override && override.jobId === selectedId
      ? override.viewer
      : hint ?? DEFAULT_ATLAS_VIEWER;

  const sessionOptions: SelectOption[] = sessions.map((j) => ({
    value: j._id,
    label: sessionLabel(j),
  }));

  return (
    <div className="flex flex-col h-full">
      {/* Parameters bar: the session selector + the viewer switcher */}
      <div className="flex items-center gap-2 p-3 border-b border-border-default">
        <Boxes className="w-4 h-4 text-text-tertiary" />
        <span className="text-sm font-medium text-text-primary mr-2">
          World Model
        </span>
        {sessions.length > 0 && (
          <Select
            options={sessionOptions}
            value={selected?._id ?? ""}
            onChange={setSelectedJobId}
            placeholder={t("worldModelSelectSession")}
            className="w-64"
          />
        )}
        <div
          className="flex items-center gap-1 ml-auto"
          role="group"
          aria-label="Viewer"
        >
          {ATLAS_VIEWERS.map((v) => (
            <button
              key={v.id}
              type="button"
              aria-pressed={viewer === v.id}
              onClick={() => setOverride({ jobId: selectedId, viewer: v.id })}
              className={cn(
                "text-[11px] px-2 py-1 rounded transition-colors",
                viewer === v.id
                  ? "bg-accent-primary/20 text-accent-primary"
                  : "text-text-tertiary hover:text-text-secondary",
              )}
            >
              {v.label}
            </button>
          ))}
        </div>
      </div>

      {/* Viewport */}
      <div className="flex-1 relative min-h-[320px]">
        {artifactUrl ? (
          <WorldModelViewport viewer={viewer} artifactUrl={artifactUrl} />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center p-6">
            <div className="text-center">
              <Boxes className="w-5 h-5 text-text-tertiary mx-auto mb-2" />
              <p className="text-[11px] text-text-tertiary max-w-xs">
                {t("worldModelEmpty")}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
