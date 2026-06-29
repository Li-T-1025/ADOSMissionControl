"use client";

/**
 * @module DroneWorldModelTab
 * @description The post-flight Atlas "World Model" tab: a viewer switcher
 * (Rerun / gsplat, with Cesium-geo + Potree to follow) over the world a captured
 * session reconstructed on the compute node. Mounted behind the Atlas flag. The
 * session list rides `cmd_atlasJobs` (a Convex regen lands it); until then the
 * switcher is live and the viewport shows the no-reconstruction state.
 * @license GPL-3.0-only
 */

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Boxes } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  ATLAS_VIEWERS,
  DEFAULT_ATLAS_VIEWER,
  type AtlasViewer,
} from "@/components/atlas/viewer-types";
import { WorldModelViewport } from "@/components/atlas/WorldModelViewport";

export function DroneWorldModelTab() {
  const t = useTranslations("atlas");
  const [viewer, setViewer] = useState<AtlasViewer>(DEFAULT_ATLAS_VIEWER);
  // The post-flight artifact rides the cmd_atlasJobs session list (a Convex
  // regen lands the table); until then there is no reconstruction to render.
  const artifactUrl: string | null = null;

  return (
    <div className="flex flex-col h-full">
      {/* Parameters bar: the viewer switcher */}
      <div className="flex items-center gap-2 p-3 border-b border-border-default">
        <Boxes className="w-4 h-4 text-text-tertiary" />
        <span className="text-sm font-medium text-text-primary mr-2">
          World Model
        </span>
        <div className="flex items-center gap-1" role="group" aria-label="Viewer">
          {ATLAS_VIEWERS.map((v) => (
            <button
              key={v.id}
              type="button"
              aria-pressed={viewer === v.id}
              onClick={() => setViewer(v.id)}
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
