/**
 * @module PlannerRightPanel
 * @description Right side panel for the mission planner page containing all collapsible sections.
 * @license GPL-3.0-only
 */
"use client";

import { useCallback, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { ChevronRight, Plus } from "lucide-react";
import { useValidationOptions } from "@/hooks/use-validation-options";
import { validateMission } from "@/lib/validation/mission-validator";
import { MissionEditor } from "@/components/planner/MissionEditor";
import { WaypointList } from "@/components/planner/WaypointList";
import { GeofenceEditor } from "@/components/planner/GeofenceEditor";
import { DefaultsSection } from "@/components/planner/DefaultsSection";
import { RallyPointEditor } from "@/components/planner/RallyPointEditor";
import { ValidationPanel } from "@/components/planner/ValidationPanel";
import { TerrainProfileChart } from "@/components/planner/TerrainProfileChart";
import { TransformPanel } from "@/components/planner/TransformPanel";
import { PatternEditor } from "@/components/planner/PatternEditor";
import { BatchEditor } from "@/components/planner/BatchEditor";
import { MissionActions } from "@/components/planner/MissionActions";
import { SunTimesCard } from "@/components/planner/SunTimesCard";
import { PreflightChecklist } from "@/components/planner/PreflightChecklist";
import { EnergyCard } from "@/components/planner/EnergyCard";
import { CollapsibleSection } from "@/components/ui/collapsible-section";
import { PanelBand } from "@/components/ui/panel-group";
import { usePlannerStore } from "@/stores/planner-store";
import { useGeofenceStore } from "@/stores/geofence-store";
import { useMissionStore } from "@/stores/mission-store";
import { randomId } from "@/lib/utils";
import type { Waypoint } from "@/lib/types";
import type { usePlanner } from "./use-planner";

interface PlannerRightPanelProps {
  p: ReturnType<typeof usePlanner>;
  showGeofence: boolean;
  showRally: boolean;
  hasDrone: boolean;
  patternOpen: boolean;
  validationOpen: boolean;
  terrainOpen: boolean;
  togglePattern: () => void;
  toggleValidation: () => void;
  toggleTerrain: () => void;
}

export function PlannerRightPanel({
  p, showGeofence, showRally, hasDrone,
  patternOpen, validationOpen, terrainOpen,
  togglePattern, toggleValidation, toggleTerrain,
}: PlannerRightPanelProps) {
  const t = useTranslations("planner");
  const tGeo = useTranslations("geofence");
  const tRally = useTranslations("rally");
  const tTerrain = useTranslations("terrain");
  const tTransform = useTranslations("transform");
  const tValidation = useTranslations("validation");
  const selectedWaypointIds = usePlannerStore((s) => s.selectedWaypointIds);
  const clearMultiSelection = usePlannerStore((s) => s.clearMultiSelection);
  const mapCenter = usePlannerStore((s) => s.mapCenter);
  const geofenceEnabled = useGeofenceStore((s) => s.enabled);

  // Lat/lon for the sun-times card: prefer the first waypoint, else the map
  // center once it has been positioned away from the null island (0,0). Null
  // when neither is available, so the card renders nothing rather than 0,0.
  const sunCoords = useMemo<{ lat: number; lon: number } | null>(() => {
    const first = p.waypoints[0];
    if (first) return { lat: first.lat, lon: first.lon };
    if (mapCenter && (mapCenter[0] !== 0 || mapCenter[1] !== 0)) {
      return { lat: mapCenter[0], lon: mapCenter[1] };
    }
    return null;
  }, [p.waypoints, mapCenter]);

  // Block upload while the mission has hard errors (out-of-fence, below terrain,
  // bad jump target, etc.) so an invalid mission can't be pushed to the FC.
  const validationOptions = useValidationOptions();
  const uploadErrorCount = useMemo(
    () => (p.waypoints.length > 0 ? validateMission(p.waypoints, validationOptions).errors.length : 0),
    [p.waypoints, validationOptions],
  );

  // Insert a waypoint between waypoint index-1 and index. Position is the midpoint
  // of its two neighbours, altitude their average, and it inherits the preceding
  // waypoint's frame + speed. When inserting past the last row (no following
  // waypoint) the new point is nudged off the previous one.
  const handleInsertAt = useCallback((index: number) => {
    const wps = useMissionStore.getState().waypoints;
    const before = wps[index - 1];
    if (!before) return;
    const after = wps[index];
    const newWp: Waypoint = {
      id: randomId(),
      lat: after ? (before.lat + after.lat) / 2 : before.lat + 0.0005,
      lon: after ? (before.lon + after.lon) / 2 : before.lon + 0.0005,
      alt: after ? (before.alt + after.alt) / 2 : before.alt,
      speed: before.speed,
      frame: before.frame,
      command: "WAYPOINT",
    };
    useMissionStore.getState().insertWaypoint(newWp, index);
  }, []);

  const activePlanName = p.activePlanId ? p.missionName || t("untitledMission") : null;

  return (
    <div className="w-[320px] shrink-0 flex flex-col border-l border-border-default bg-bg-secondary">
      <div className="flex items-center justify-between px-3 py-2 border-b border-border-default">
        <div className="flex items-center gap-1.5 min-w-0">
          {p.isDirty && <span className="w-1.5 h-1.5 rounded-full bg-status-warning shrink-0" title={t("unsavedChanges")} />}
          <h2 className="text-sm font-display font-semibold text-text-primary truncate">{activePlanName || t("missionPlanner")}</h2>
        </div>
        <button onClick={p.togglePanel} className="text-text-tertiary hover:text-text-primary cursor-pointer"><ChevronRight size={14} /></button>
      </div>

      <div className="flex-1 overflow-y-auto">
        <PanelBand title={t("bands.setup")}>
          <CollapsibleSection title={t("missionSetup")} defaultOpen={true}>
            <MissionEditor drones={p.drones} missionName={p.missionName} selectedDroneId={p.selectedDroneId}
              onNameChange={p.setMissionName} onDroneChange={p.setSelectedDroneId} />
          </CollapsibleSection>
          <CollapsibleSection title={t("defaults")}>
            <DefaultsSection defaultAlt={p.defaultAlt} defaultSpeed={p.defaultSpeed} defaultAcceptRadius={p.defaultAcceptRadius} defaultFrame={p.defaultFrame}
              onAltChange={(v) => p.setDefaults({ defaultAlt: v })} onSpeedChange={(v) => p.setDefaults({ defaultSpeed: v })}
              onRadiusChange={(v) => p.setDefaults({ defaultAcceptRadius: v })} onFrameChange={(v) => p.setDefaults({ defaultFrame: v })} />
          </CollapsibleSection>
        </PanelBand>
        <PanelBand title={t("bands.build")}>
          <CollapsibleSection title={t("flightPatterns")} open={patternOpen} onToggle={togglePattern}>
            <PatternEditor onApply={p.handlePatternApply} />
          </CollapsibleSection>
          <CollapsibleSection title={t("waypoints")} defaultOpen={true} count={p.waypoints.length}
            trailing={<button onClick={p.handleAddManualWaypoint} className="text-text-tertiary hover:text-accent-primary cursor-pointer"><Plus size={14} /></button>}>
            <WaypointList waypoints={p.waypoints} selectedId={p.selectedWaypointId} expandedId={p.expandedWaypointId}
              onSelect={p.handleWaypointClick} onExpand={p.setExpandedWaypoint} onUpdate={p.updateWaypoint}
              onRemove={p.removeWaypoint} onReorder={p.reorderWaypoints} onInsertAt={handleInsertAt} />
          </CollapsibleSection>
          {selectedWaypointIds.length >= 2 && (
            <CollapsibleSection title={t("batchEdit")} defaultOpen={true}>
              <BatchEditor selectedIds={selectedWaypointIds} onClearSelection={clearMultiSelection} />
            </CollapsibleSection>
          )}
          {showGeofence && (
            <CollapsibleSection title={tGeo("title")} trailing={<span className="text-[10px] font-mono text-text-tertiary">{geofenceEnabled ? t("on") : t("off")}</span>}>
              <GeofenceEditor onDrawOnMap={(fenceDrawType) => usePlannerStore.getState().setMode({ kind: "draw", shape: fenceDrawType === "polygon" ? "polygon" : "circle", drawingFor: "geofence" })} />
            </CollapsibleSection>
          )}
          {showRally && (
            <CollapsibleSection title={tRally("title")} count={p.rallyPoints.length}>
              <RallyPointEditor />
            </CollapsibleSection>
          )}
          <CollapsibleSection title={tTransform("title")}><TransformPanel /></CollapsibleSection>
        </PanelBand>
        <PanelBand title={t("bands.review")}>
          <CollapsibleSection title={tTerrain("title")} open={terrainOpen} onToggle={toggleTerrain}>
            <TerrainProfileChart waypoints={p.waypoints} />
          </CollapsibleSection>
          <CollapsibleSection title={tValidation("title")} open={validationOpen} onToggle={toggleValidation}>
            <ValidationPanel waypoints={p.waypoints}
              onSelectWaypoint={(id) => { p.setSelectedWaypoint(id); p.setExpandedWaypoint(id); }} />
          </CollapsibleSection>
          {sunCoords && (
            <CollapsibleSection title={t("sunTimes")}>
              <SunTimesCard lat={sunCoords.lat} lon={sunCoords.lon} />
            </CollapsibleSection>
          )}
          <CollapsibleSection title={t("energy.title")}>
            <EnergyCard waypoints={p.waypoints} cruiseSpeedMps={p.defaultSpeed} />
          </CollapsibleSection>
          <CollapsibleSection title={t("checklist.title")}>
            <PreflightChecklist />
          </CollapsibleSection>
        </PanelBand>
      </div>

      <MissionActions hasWaypoints={p.waypoints.length > 0} hasDrone={hasDrone} validationErrors={uploadErrorCount} uploadState={p.uploadState} downloadState={p.downloadState}
        isDirty={p.isDirty} onSave={p.handleSave} onUpload={p.handleUpload} onDownloadFromDrone={p.handleDownloadFromDrone}
        onExportWaypoints={p.handleExportWaypoints} onExportPlan={p.handleExportPlan} onExportKML={p.handleExportKML} onExportCSV={p.handleExportCSV}
        onExportKMZ={p.handleExportKMZ} onExportNative={p.handleExportNative}
        onSaveAs={p.handleSaveAs} onReverseWaypoints={p.handleReverseWaypoints} onDiscard={p.handleClearAll} />
    </div>
  );
}
