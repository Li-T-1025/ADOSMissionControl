/**
 * @module workstation/panels/plan
 * @description Built-in workstation panels for the `plan` workspace. Each panel
 * wraps an existing routed-page surface from `/plan` (and `/simulate`) and
 * drives it from the shared mission/planner Zustand stores instead of
 * page-level prop drilling, so the same component renders identically inside a
 * Dockview panel.
 *
 * Store-driven wiring (no fake/no-op handlers):
 *  - `plan-altitude` + `plan-simulate` need only store data + store actions, so
 *    they read the mission/planner stores directly.
 *  - `plan-map` needs the planner's composed map handlers (place/drag/right-click
 *    orchestrate several stores plus context-menu state). It builds them from the
 *    side-effect-free `usePlannerState()` + `usePlannerActions()` pair — the same
 *    composition the page uses, minus the IO session effects — so this panel adds
 *    no autosave/dirty duplication.
 *  - `plan-library` is the single owner of the planner IO session (`usePlanner()`),
 *    which provides the real save / download-from-drone / plan-loaded handlers and
 *    runs the autosave + dirty-detection effects exactly once for the workspace.
 *
 * The panels are additive: the routed `/plan` and `/simulate` pages are
 * untouched and keep their own `usePlanner()` instance.
 *
 * @license GPL-3.0-only
 */

"use client";

import { useCallback, useState } from "react";
import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import { MapToolbar } from "@/components/planner/MapToolbar";
import { MapContextMenu } from "@/components/planner/MapContextMenu";
import { OverlayPanel } from "@/components/planner/OverlayPanel";
import { DownloadAreaPanel } from "@/components/planner/DownloadAreaPanel";
import { MissionStatsBar } from "@/components/planner/MissionStatsBar";
import { FlightPlanLibrary } from "@/components/library/FlightPlanLibrary";
import { UnsavedChangesDialog } from "@/components/library/UnsavedChangesDialog";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useMissionStore } from "@/stores/mission-store";
import { usePlannerStore } from "@/stores/planner-store";
import { useDroneManager } from "@/stores/drone-manager";
import { usePlannerState } from "@/app/plan/use-planner-state";
import { usePlannerActions } from "@/app/plan/use-planner-actions";
import { usePlanner } from "@/app/plan/use-planner";
import type { WorkstationPanel } from "../types";

// Leaflet + Cesium surfaces are browser-only; mirror the pages' `ssr: false`
// dynamic import so the panel module never tries to render them on the server.
const PlannerMap = dynamic(
  () => import("@/components/planner/PlannerMap").then((m) => m.PlannerMap),
  { ssr: false },
);
const AltitudeProfile = dynamic(
  () => import("@/components/planner/AltitudeProfile").then((m) => m.AltitudeProfile),
  { ssr: false },
);
const SimulationViewer = dynamic(
  () => import("@/components/simulation/SimulationViewer").then((m) => m.SimulationViewer),
  { ssr: false },
);

/**
 * The interactive planner map plus its immediate interaction chrome (tool dock,
 * right-click menu, offline-tile/overlay panels, mission stats, clear-confirm).
 * Handlers come from the side-effect-free `usePlannerState()` + `usePlannerActions()`
 * pair so this panel carries no IO/autosave session of its own. The altitude
 * profile is deliberately NOT rendered here — it is the separate `plan-altitude`
 * panel.
 */
function PlanMapPanel() {
  const t = useTranslations("planner");
  const state = usePlannerState();
  const actions = usePlannerActions({
    waypoints: state.waypoints,
    activePlanId: state.activePlanId,
    isDirty: state.isDirty,
    activeTool: state.activeTool,
    defaultAlt: state.defaultAlt,
    defaultSpeed: state.defaultSpeed,
    selectedDroneId: state.selectedDroneId,
    missionName: state.missionName,
    contextMenu: state.contextMenu,
    addWaypoint: state.addWaypoint,
    removeWaypoint: state.removeWaypoint,
    insertWaypoint: state.insertWaypoint,
    clearMission: state.clearMission,
    setWaypoints: state.setWaypoints,
    downloadMission: state.downloadMission,
    uploadMission: state.uploadMission,
    addRallyPoint: state.addRallyPoint,
    setContextMenu: state.setContextMenu,
    setSelectedWaypoint: state.setSelectedWaypoint,
    setExpandedWaypoint: state.setExpandedWaypoint,
    setShowClearConfirm: state.setShowClearConfirm,
    setShowDownloadConfirm: state.setShowDownloadConfirm,
    setMissionName: state.setMissionName,
    setSelectedDroneId: state.setSelectedDroneId,
    toast: state.toast,
  });

  const hasActivePlan = !!state.activePlanId;
  const mapBounds = usePlannerStore((s) => s.mapBounds);
  const mapZoom = usePlannerStore((s) => s.mapZoom);

  // The overlay and offline-download panels dock at the same spot, so they are
  // mutually exclusive — opening one closes the other (same as the page).
  const [overlayPanelOpen, setOverlayPanelOpen] = useState(false);
  const [downloadPanelOpen, setDownloadPanelOpen] = useState(false);
  const toggleOverlayPanel = useCallback(() => {
    setOverlayPanelOpen((v) => !v);
    setDownloadPanelOpen(false);
  }, []);
  const toggleDownloadPanel = useCallback(() => {
    setDownloadPanelOpen((v) => !v);
    setOverlayPanelOpen(false);
  }, []);

  return (
    <div className="relative w-full h-full min-w-0 overflow-hidden">
      <PlannerMap
        waypoints={state.waypoints}
        activeTool={state.activeTool}
        selectedWaypointId={state.selectedWaypointId}
        hasActivePlan={hasActivePlan}
        rallyPoints={state.rallyPoints}
        onMapClick={actions.handleMapClick}
        onMapRightClick={actions.handleMapRightClick}
        onWaypointClick={actions.handleWaypointClick}
        onWaypointDragEnd={actions.handleWaypointDragEnd}
        onWaypointRightClick={actions.handleWaypointRightClick}
        onDrawingComplete={actions.handleDrawingComplete}
      />
      {hasActivePlan && (
        <MapToolbar
          activeTool={state.activeTool}
          onToolChange={state.setActiveTool}
          canUndo={state.canUndo}
          canRedo={state.canRedo}
          onUndo={state.undo}
          onRedo={state.redo}
          onClearAll={actions.handleClearAll}
          onToggleOverlays={toggleOverlayPanel}
          overlayPanelOpen={overlayPanelOpen}
          onToggleDownload={toggleDownloadPanel}
          downloadPanelOpen={downloadPanelOpen}
        />
      )}
      {hasActivePlan && overlayPanelOpen && <OverlayPanel onClose={() => setOverlayPanelOpen(false)} />}
      {hasActivePlan && downloadPanelOpen && (
        <DownloadAreaPanel
          bounds={mapBounds ?? { north: 13.0, south: 12.9, east: 77.7, west: 77.5 }}
          currentZoom={mapZoom}
          currentProvider="dark"
          onClose={() => setDownloadPanelOpen(false)}
        />
      )}
      {hasActivePlan && <MissionStatsBar waypoints={state.waypoints} defaultSpeed={state.defaultSpeed} />}
      {state.contextMenu && (
        <MapContextMenu
          x={state.contextMenu.x}
          y={state.contextMenu.y}
          items={state.contextMenu.items}
          onSelect={actions.handleContextAction}
          onClose={() => state.setContextMenu(null)}
        />
      )}
      <ConfirmDialog
        open={state.showClearConfirm}
        onConfirm={actions.confirmClear}
        onCancel={() => state.setShowClearConfirm(false)}
        title={t("discardChanges")}
        message={t("discardChangesBody")}
        confirmLabel={t("discard")}
        variant="danger"
      />
    </div>
  );
}

/**
 * The flight-plan library (browse / create / import / select / save). Owns the
 * single planner IO session for the workspace via `usePlanner()`, so the real
 * save / rename / download-from-drone handlers are wired and the autosave +
 * dirty-detection effects run exactly once. The download-from-drone confirm
 * dialog is rendered here because that flow lives on the IO owner.
 */
function PlanLibraryPanel() {
  const p = usePlanner();
  const hasDrone = useDroneManager((s) => s.drones.size > 0);
  const isDownloading = p.downloadState === "downloading";

  return (
    <div className="flex h-full w-full">
      <FlightPlanLibrary
        context="plan"
        onPlanLoaded={p.handlePlanLoaded}
        onSave={p.handleSave}
        onPlanRenamed={p.handlePlanRenamed}
        onDownloadFromDrone={p.handleDownloadFromDrone}
        isDownloading={isDownloading}
        hasDrone={hasDrone}
      />
      <UnsavedChangesDialog
        open={p.showDownloadConfirm}
        onSaveAndSwitch={p.handleSaveAndDownload}
        onDiscardAndSwitch={p.handleDiscardAndDownload}
        onCancel={p.handleCancelDownload}
      />
    </div>
  );
}

/**
 * The collapsible altitude-vs-distance chart. Reads waypoints + selection from
 * the stores; selecting a dot selects + expands that waypoint. Renders nothing
 * until the mission has waypoints (the component's own empty guard).
 */
function PlanAltitudePanel() {
  const waypoints = useMissionStore((s) => s.waypoints);
  const collapsed = usePlannerStore((s) => s.altProfileCollapsed);
  const toggleAltProfile = usePlannerStore((s) => s.toggleAltProfile);
  const selectedWaypointId = usePlannerStore((s) => s.selectedWaypointId);
  const setSelectedWaypoint = usePlannerStore((s) => s.setSelectedWaypoint);
  const setExpandedWaypoint = usePlannerStore((s) => s.setExpandedWaypoint);
  const onSelectWaypoint = useCallback(
    (id: string) => {
      setSelectedWaypoint(id);
      setExpandedWaypoint(id);
    },
    [setSelectedWaypoint, setExpandedWaypoint],
  );

  return (
    <div className="relative w-full h-full">
      <AltitudeProfile
        waypoints={waypoints}
        collapsed={collapsed}
        onToggle={toggleAltProfile}
        selectedWaypointId={selectedWaypointId}
        onSelectWaypoint={onSelectWaypoint}
      />
    </div>
  );
}

/**
 * The CesiumJS 3D simulation viewer. Reads waypoints + cruise speed from the
 * shared stores (same source the `/simulate` page uses).
 */
function PlanSimulatePanel() {
  const waypoints = useMissionStore((s) => s.waypoints);
  const defaultSpeed = usePlannerStore((s) => s.defaultSpeed);

  return (
    <div className="relative flex w-full h-full min-w-0">
      <SimulationViewer waypoints={waypoints} defaultSpeed={defaultSpeed} />
    </div>
  );
}

/** Built-in panels for the `plan` workspace. */
export const planPanels: WorkstationPanel[] = [
  { id: "plan-map", workspace: "plan", title: "Map", order: 0, component: PlanMapPanel },
  { id: "plan-library", workspace: "plan", title: "Flight Plans", order: 1, component: PlanLibraryPanel },
  { id: "plan-altitude", workspace: "plan", title: "Altitude Profile", order: 2, component: PlanAltitudePanel },
  { id: "plan-simulate", workspace: "plan", title: "Simulation", order: 3, component: PlanSimulatePanel },
];
