"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { useDroneManager } from "@/stores/drone-manager";
import { useFleetStore } from "@/stores/fleet-store";
import { useUiStore } from "@/stores/ui-store";
import { useLogActivityStore } from "@/stores/log-activity-store";
import { DroneListPanel } from "@/components/dashboard/DroneListPanel";
import { DashboardOverview } from "@/components/dashboard/DashboardOverview";
import { DroneDetailPanel } from "@/components/dashboard/DroneDetailPanel";
import { DroneLogsPanel } from "@/components/drone-detail/DroneLogsPanel";
import { EmptyFleetState } from "@/components/dashboard/EmptyFleetState";

export default function DashboardPage() {
  const t = useTranslations("dashboard");
  const selectedDroneId = useDroneManager((s) => s.selectedDroneId);
  const selectDrone = useDroneManager((s) => s.selectDrone);
  const drones = useFleetStore((s) => s.drones);
  const immersiveMode = useUiStore((s) => s.immersiveMode);
  const exitImmersiveMode = useUiStore((s) => s.exitImmersiveMode);
  const [panelCollapsed, setPanelCollapsed] = useState(false);
  // Flight Logs panel starts closed; the operator opens it when wanted.
  const [logsCollapsed, setLogsCollapsed] = useState(true);

  // "Updates available" indicator on the collapsed Flight Logs rail.
  const logCount = useLogActivityStore(
    (s) => s.counts[selectedDroneId ?? ""] ?? 0,
  );
  const [lastSeenLogCount, setLastSeenLogCount] = useState(0);
  const hasNewLogs = logsCollapsed && logCount > lastSeenLogCount;
  // While the panel is open the operator sees everything, so keep "seen" in
  // step; once collapsed it freezes and new messages light the indicator.
  useEffect(() => {
    if (!logsCollapsed) setLastSeenLogCount(logCount);
  }, [logsCollapsed, logCount]);
  // Switching drones resets the baseline so the previous drone's logs don't
  // carry an indicator onto the next one.
  useEffect(() => {
    setLastSeenLogCount(
      useLogActivityStore.getState().counts[selectedDroneId ?? ""] ?? 0,
    );
  }, [selectedDroneId]);

  function expandLogs() {
    setLastSeenLogCount(logCount);
    setLogsCollapsed(false);
  }

  useEffect(() => {
    setPanelCollapsed(selectedDroneId !== null);
  }, [selectedDroneId]);

  // Exit immersive mode if drone is deselected
  useEffect(() => {
    if (immersiveMode && selectedDroneId === null) {
      exitImmersiveMode();
    }
  }, [selectedDroneId, immersiveMode, exitImmersiveMode]);

  if (drones.length === 0) {
    return <EmptyFleetState />;
  }

  return (
    <div className="flex-1 flex h-full overflow-hidden">
      {!immersiveMode && (
        <DroneListPanel collapsed={panelCollapsed} onToggleCollapse={() => setPanelCollapsed((p) => !p)} />
      )}
      {selectedDroneId ? (
        <>
          <DroneDetailPanel droneId={selectedDroneId} onClose={() => selectDrone(null)} />
          {!immersiveMode && logsCollapsed && (
            <div className="w-10 shrink-0 flex flex-col h-full border-l border-border-default bg-bg-secondary">
              <button
                onClick={expandLogs}
                className="relative flex flex-col items-center gap-1 px-1 py-2 border-b border-border-default hover:bg-bg-tertiary transition-colors cursor-pointer group"
                title={hasNewLogs ? t("newLogs") : t("expandLogs")}
                aria-label={hasNewLogs ? t("newLogs") : t("expandLogs")}
              >
                <span
                  className={cn(
                    "text-[9px] font-semibold uppercase tracking-wider transition-colors",
                    hasNewLogs
                      ? "text-accent-primary"
                      : "text-text-tertiary group-hover:text-text-secondary",
                  )}
                >
                  {t("logs")}
                </span>
                <ChevronLeft
                  size={12}
                  className={cn(
                    "transition-colors",
                    hasNewLogs
                      ? "text-accent-primary"
                      : "text-text-tertiary group-hover:text-text-secondary",
                  )}
                />
                {hasNewLogs && (
                  <span
                    className="absolute top-1.5 right-1.5 flex h-2 w-2"
                    aria-hidden="true"
                  >
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent-primary opacity-75" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-accent-primary" />
                  </span>
                )}
              </button>
            </div>
          )}
          {!immersiveMode && (
            <div className={`w-[384px] shrink-0 flex flex-col h-full border-l border-border-default bg-bg-secondary ${logsCollapsed ? "hidden" : ""}`}>
              <div className="flex items-center gap-2 px-3 py-2 border-b border-border-default flex-shrink-0">
                <button
                  onClick={() => setLogsCollapsed(true)}
                  className="p-1 text-text-tertiary hover:text-text-primary transition-colors"
                  title={t("collapseLogs")}
                >
                  <ChevronRight size={14} />
                </button>
                <span className="text-xs font-semibold uppercase tracking-wider text-text-secondary">
                  {t("flightLogs")}
                </span>
              </div>
              <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
                <DroneLogsPanel droneId={selectedDroneId} />
              </div>
            </div>
          )}
        </>
      ) : (
        <DashboardOverview />
      )}
    </div>
  );
}
