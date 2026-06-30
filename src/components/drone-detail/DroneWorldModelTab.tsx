"use client";

/**
 * @module DroneWorldModelTab
 * @description The post-flight Atlas "World Model" tab: a session selector + a
 * viewer switcher (Rerun / Splat / Cloud) over the world a captured session
 * reconstructed on the compute node. Sourced LOCAL-FIRST (Rule 39): the artifact
 * comes from the paired compute / workstation node directly over the LAN
 * (`useDroneWorldModel`), correlated by `session_id`. The Convex `cmd_atlasJobs`
 * path is the cloud fallback when no compute node is paired locally or its job
 * API is unreachable. Mounted behind the Atlas flag; shows the no-reconstruction
 * empty state — or "pair a compute node" guidance — until a finished session
 * exists.
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
import { useDroneWorldModel } from "@/hooks/use-drone-world-model";
import { useAuthStore } from "@/stores/auth-store";
import { cmdAtlasJobsApi } from "@/lib/community-api-drones";
import type { Doc } from "../../../convex/_generated/dataModel";

type AtlasJob = Doc<"cmd_atlasJobs">;

/** A short, human-ish label for a cloud-fallback session. */
function cloudSessionLabel(job: AtlasJob): string {
  const id = job.sessionId ?? job._id;
  return `${job.kind} · ${id.slice(0, 8)} · ${job.status}`;
}

export function DroneWorldModelTab({ droneId }: { droneId?: string }) {
  const t = useTranslations("atlas");
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  // Selection is tracked per source (a local sessionId vs a cloud job id); only
  // one source renders at a time.
  const [localSession, setLocalSession] = useState<string>("");
  const [cloudJobId, setCloudJobId] = useState<string>("");
  // A manual viewer choice keyed to the selection it was made for; when the
  // selection changes the override drops and the viewer follows its hint.
  const [override, setOverride] = useState<{
    key: string;
    viewer: AtlasViewer;
  } | null>(null);

  // Local-first primary: the artifact off the paired compute node (newest
  // completed reconstruction for the selected — or latest — session).
  const local = useDroneWorldModel({
    sessionId: localSession || null,
    computeNodeId: null,
  });

  // Cloud fallback: the reactive cmd_atlasJobs list (resolved by capturing
  // device). Skips in demo / no-convex / no-deviceId.
  const cloudJobs = useConvexSkipQuery(cmdAtlasJobsApi.listForDevice, {
    args: { deviceId: droneId ?? "" },
    enabled: Boolean(droneId),
  }) as AtlasJob[] | undefined;

  // Use the local path whenever a compute node is serving (ready or building);
  // fall to cloud when local-first is inactive or the node is unreachable.
  const useLocal = local.status === "ready" || local.status === "building";

  // Resolve a unified view model from the active source.
  let artifactUrl: string | null;
  let hint: AtlasViewer | null;
  let sessionOptions: SelectOption[];
  let selectedValue: string;
  let onSelect: (v: string) => void;
  // Which empty state to show when there is no artifact.
  let emptyKind: "building" | "pair-node" | "none";

  if (useLocal) {
    artifactUrl = local.artifactUrl;
    hint = local.viewerHint;
    sessionOptions = local.sessions.map((s) => ({
      value: s.sessionId,
      label: s.sessionId.slice(0, 12),
    }));
    selectedValue =
      local.sessions.find((s) => s.sessionId === localSession)?.sessionId ??
      local.sessions[0]?.sessionId ??
      "";
    onSelect = setLocalSession;
    emptyKind = "building";
  } else {
    const list = cloudJobs ?? [];
    const latestDone = list.find(
      (j) => j.status === "done" && Boolean(j.outputUrl),
    );
    const selectedJob =
      list.find((j) => j._id === cloudJobId) ?? latestDone ?? null;
    artifactUrl =
      selectedJob && selectedJob.status === "done"
        ? selectedJob.outputUrl ?? null
        : null;
    hint = selectedJob ? viewerHintOf(selectedJob.metadata) : null;
    sessionOptions = list.map((j) => ({
      value: j._id,
      label: cloudSessionLabel(j),
    }));
    selectedValue = selectedJob?._id ?? "";
    onSelect = setCloudJobId;
    // A real drone, signed out, with no compute node paired → guide the operator
    // to pair one; otherwise the generic "no reconstruction yet" empty.
    emptyKind =
      Boolean(droneId) && !isAuthenticated && !local.hasComputeNode
        ? "pair-node"
        : "none";
  }

  const viewer =
    override && override.key === selectedValue
      ? override.viewer
      : hint ?? DEFAULT_ATLAS_VIEWER;

  const emptyMessage =
    emptyKind === "building"
      ? t("liveWorldBuilding")
      : emptyKind === "pair-node"
        ? t("worldModelNoNode")
        : t("worldModelEmpty");

  return (
    <div className="flex flex-col h-full">
      {/* Parameters bar: the session selector + the viewer switcher */}
      <div className="flex items-center gap-2 p-3 border-b border-border-default">
        <Boxes className="w-4 h-4 text-text-tertiary" />
        <span className="text-sm font-medium text-text-primary mr-2">
          World Model
        </span>
        {sessionOptions.length > 0 && (
          <Select
            options={sessionOptions}
            value={selectedValue}
            onChange={onSelect}
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
              onClick={() => setOverride({ key: selectedValue, viewer: v.id })}
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
                {emptyMessage}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
