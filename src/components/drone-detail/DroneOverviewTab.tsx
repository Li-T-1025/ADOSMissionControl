"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, Maximize2, Plane } from "lucide-react";
import { useDroneManager } from "@/stores/drone-manager";
import { TelemetryReadout } from "@/components/flight/TelemetryReadout";
import { ActionsPanel } from "@/components/flight/ActionsPanel";
import { CompactInfoCards } from "@/components/flight/CompactInfoCards";
import { OsdOverlay } from "@/components/flight/OsdOverlay";
import { ProximityRadar } from "@/components/flight/ProximityRadar";
import { VideoCanvas } from "@/components/flight/VideoCanvas";
import { VideoOverlayHost } from "@/components/fly/VideoOverlayHost";
import { RecordingControls } from "@/components/shared/RecordingControls";
import { useUiStore } from "@/stores/ui-store";
import { useFlyModeStore } from "@/stores/fly-mode-store";
import type { FleetDrone } from "@/lib/types";

const OverviewHud = dynamic(
  () => import("@/components/flight/OverviewHud").then((m) => m.OverviewHud),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-full bg-[#0a1428] border border-border-default flex items-center justify-center">
        <span className="text-[10px] font-mono text-text-tertiary">Loading HUD...</span>
      </div>
    ),
  }
);

const OverviewMap = dynamic(
  () => import("@/components/flight/OverviewMap").then((m) => m.OverviewMap),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-full bg-[#0a0a0a] border border-border-default flex items-center justify-center">
        <span className="text-[10px] font-mono text-text-tertiary">Loading Map...</span>
      </div>
    ),
  }
);

interface DroneOverviewTabProps {
  drone: FleetDrone;
}

type RightPanel = "map" | "fly";

export function DroneOverviewTab({ drone }: DroneOverviewTabProps) {
  const t = useTranslations("droneDetail");
  const tCockpit = useTranslations("cockpit");
  const router = useRouter();
  const selectedDroneId = useDroneManager((s) => s.selectedDroneId);
  const [rightPanel, setRightPanel] = useState<RightPanel>("map");
  const [telemetryCollapsed, setTelemetryCollapsed] = useState(false);
  const immersiveMode = useUiStore((s) => s.immersiveMode);
  const enterImmersiveMode = useUiStore((s) => s.enterImmersiveMode);
  const flyModeEnabled = useFlyModeStore((s) => s.enabled);

  const openCockpit = () => {
    const id = selectedDroneId ?? drone.id;
    router.push(`/fly?drone=${encodeURIComponent(id)}`);
  };

  return (
    <div className="flex-1 flex overflow-hidden">
      {/* Left column: HUD + Telemetry + Info */}
      {!immersiveMode && !telemetryCollapsed && (
        <div className="w-[22rem] shrink-0 flex flex-col overflow-y-auto border-r border-border-default">
          {/* Compact HUD */}
          <div className="h-60 shrink-0">
            <OverviewHud />
          </div>

          {/* Telemetry readout */}
          <TelemetryReadout />

          {/* Flight actions */}
          <ActionsPanel />

          {/* Drone info cards */}
          <CompactInfoCards drone={drone} />
        </div>
      )}

      {/* Right column: Map / Fly toggle */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        {/* Sub-tab bar */}
        {!immersiveMode && (
          <div className="flex items-center gap-1 px-2 py-1.5 bg-bg-secondary border-b border-border-default shrink-0">
            <button
              onClick={() => setTelemetryCollapsed((c) => !c)}
              className="p-1 text-text-tertiary hover:text-text-primary transition-colors"
              title={telemetryCollapsed ? "Show telemetry panel" : "Hide telemetry panel"}
            >
              {telemetryCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
            </button>
            <button
              onClick={() => setRightPanel("map")}
              className={
                rightPanel === "map"
                  ? "px-3 py-1 text-xs font-mono font-semibold text-text-primary bg-bg-tertiary rounded"
                  : "px-3 py-1 text-xs font-mono text-text-tertiary hover:text-text-secondary transition-colors rounded"
              }
            >
              {t("map")}
            </button>
            <button
              onClick={() => setRightPanel("fly")}
              className={
                rightPanel === "fly"
                  ? "px-3 py-1 text-xs font-mono font-semibold text-text-primary bg-bg-tertiary rounded"
                  : "px-3 py-1 text-xs font-mono text-text-tertiary hover:text-text-secondary transition-colors rounded"
              }
            >
              {t("fly")}
            </button>
            <div className="flex-1" />
            {flyModeEnabled && (
              <button
                onClick={openCockpit}
                className="flex items-center gap-1 px-2 py-1 text-[10px] font-mono text-text-tertiary hover:text-text-primary transition-colors"
                title={tCockpit("enterTitle")}
              >
                <Plane size={12} />
                {tCockpit("enter")}
              </button>
            )}
            <button
              onClick={enterImmersiveMode}
              className="flex items-center gap-1 px-2 py-1 text-[10px] font-mono text-text-tertiary hover:text-text-primary transition-colors"
              title="Enter immersive mode"
            >
              <Maximize2 size={12} />
              {t("immersive")}
            </button>
            <RecordingControls />
          </div>
        )}

        {/* Panel content */}
        <div className="flex-1 min-h-0">
          {rightPanel === "map" && <OverviewMap />}
          {rightPanel === "fly" && (
            <div className="relative h-full">
              <VideoCanvas>
                {(selectedDroneId ?? drone.id) && (
                  <VideoOverlayHost droneId={selectedDroneId ?? drone.id} />
                )}
                <OsdOverlay />
                <ProximityRadar />
              </VideoCanvas>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
