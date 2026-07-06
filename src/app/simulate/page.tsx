"use client";

/**
 * @module SimulatePage
 * @description Dedicated simulation page. A NON-DESTRUCTIVE, read-only view of
 * whatever is currently in the shared mission store: if waypoints exist it
 * renders the 3D CesiumJS simulation of them (regardless of whether a saved plan
 * is active), and if the mission is empty it shows a calm empty state that links
 * back to the Plan tab. This page never edits or clears the shared mission — only
 * the playback state (simulation-store) is reset on unmount.
 * @license GPL-3.0-only
 */

import { useState, useEffect, useMemo } from "react";
import { useTranslations } from "next-intl";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { ChevronLeft, AlertTriangle, X, Waypoints } from "lucide-react";
import { useMissionStore } from "@/stores/mission-store";
import { usePlannerStore } from "@/stores/planner-store";
import { useSimulationStore } from "@/stores/simulation-store";
import { useSimulationKeyboard } from "@/hooks/use-simulation-keyboard";
import { useValidationOptions } from "@/hooks/use-validation-options";
import { validateMission } from "@/lib/validation/mission-validator";
import { SimulateLeftPanel } from "@/components/simulation/SimulateLeftPanel";

const SimulationViewer = dynamic(
  () =>
    import("@/components/simulation/SimulationViewer").then((m) => m.SimulationViewer),
  { ssr: false }
);
const SimulationPanel = dynamic(
  () =>
    import("@/components/simulation/SimulationPanel").then((m) => m.SimulationPanel),
  { ssr: false }
);

export default function SimulatePage() {
  const waypoints = useMissionStore((s) => s.waypoints);
  const defaultSpeed = usePlannerStore((s) => s.defaultSpeed);
  const validationOptions = useValidationOptions();
  const tSim = useTranslations("simulate");
  const [panelCollapsed, setPanelCollapsed] = useState(false);
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const router = useRouter();

  useSimulationKeyboard(true);

  const hasMission = waypoints.length > 0;

  // Validate mission (shared options builder — matches the Plan panel exactly)
  const validation = useMemo(() => {
    if (waypoints.length === 0) return null;
    return validateMission(waypoints, validationOptions);
  }, [waypoints, validationOptions]);

  // Reset banner when waypoints change
  useEffect(() => {
    setBannerDismissed(false);
  }, [waypoints]);

  // Reset simulation PLAYBACK state on unmount (navigating away). This only
  // touches the simulation-store (playhead / speed / running flag); it never
  // clears the shared mission, so switching between Plan and Simulate is safe
  // even for an unsaved, still-being-edited mission.
  useEffect(() => {
    return () => { useSimulationStore.getState().reset(); };
  }, []);

  return (
    <div className="relative flex-1 flex h-full overflow-hidden">
      {/* Left panel — always available so a saved plan can be loaded into the view */}
      <SimulateLeftPanel />

      {hasMission ? (
        <>
          {/* Validation warning banner */}
          {validation && !bannerDismissed && (validation.errors.length > 0 || validation.warnings.length > 0) && (
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-30 max-w-md">
              <div
                className={`flex items-center gap-2 px-4 py-2 rounded-lg border backdrop-blur-md text-xs font-mono ${
                  validation.errors.length > 0
                    ? "bg-red-500/15 border-red-500/30 text-red-400"
                    : "bg-yellow-500/15 border-yellow-500/30 text-yellow-400"
                }`}
              >
                <AlertTriangle size={14} className="shrink-0" />
                <span className="flex-1">
                  {validation.errors.length > 0
                    ? tSim("missionHasErrors", { count: validation.errors.length })
                    : tSim("missionHasWarnings", { count: validation.warnings.length })}
                </span>
                <button
                  onClick={() => router.push("/plan")}
                  className="text-accent-primary hover:text-accent-primary/80 whitespace-nowrap cursor-pointer"
                >
                  {tSim("editPlan")}
                </button>
                <button
                  onClick={() => setBannerDismissed(true)}
                  className="text-text-tertiary hover:text-text-primary cursor-pointer"
                >
                  <X size={12} />
                </button>
              </div>
            </div>
          )}

          {/* 3D Viewer */}
          <SimulationViewer waypoints={waypoints} defaultSpeed={defaultSpeed} />

          {/* Right panel */}
          {!panelCollapsed && (
            <SimulationPanel
              waypoints={waypoints}
              onClose={() => setPanelCollapsed(true)}
            />
          )}

          {/* Collapsed panel toggle */}
          {panelCollapsed && (
            <button
              onClick={() => setPanelCollapsed(false)}
              className="w-8 shrink-0 flex items-center justify-center border-l border-border-default bg-bg-secondary hover:bg-bg-tertiary cursor-pointer"
            >
              <ChevronLeft size={14} className="text-text-tertiary" />
            </button>
          )}
        </>
      ) : (
        <SimulateEmptyState onPlan={() => router.push("/plan")} />
      )}
    </div>
  );
}

/**
 * Calm, read-only empty state shown when the shared mission has no waypoints.
 * It is purely informational — it never mutates any store — and points the
 * operator back to the Plan tab to build a mission first.
 */
function SimulateEmptyState({ onPlan }: { onPlan: () => void }) {
  const tSim = useTranslations("simulate");
  return (
    <div className="flex-1 flex items-center justify-center h-full bg-bg-primary">
      <div className="flex flex-col items-center text-center max-w-sm px-6">
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full border border-border-default bg-bg-secondary">
          <Waypoints size={26} className="text-text-tertiary" />
        </div>
        <p className="text-base font-semibold text-text-primary mb-1.5">
          {tSim("emptyTitle")}
        </p>
        <p className="text-sm text-text-tertiary mb-5 leading-relaxed">
          {tSim("emptyBody")}
        </p>
        <button
          onClick={onPlan}
          className="inline-flex items-center gap-1.5 rounded-md border border-border-default bg-bg-secondary px-4 py-2 text-sm font-medium text-accent-primary hover:bg-bg-tertiary transition-colors cursor-pointer"
        >
          {tSim("emptyAction")}
        </button>
      </div>
    </div>
  );
}
