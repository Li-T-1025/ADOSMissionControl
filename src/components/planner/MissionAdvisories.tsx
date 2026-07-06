/**
 * @module MissionAdvisories
 * @description Advisory checks that sit alongside hard mission validation:
 * airport-proximity rings, soft geofence-buffer approach, and FC mission
 * item-count headroom. Advisories never block an upload — they inform the
 * operator before a hard limit is reached. Each row that maps to a waypoint is
 * clickable to select it, matching the ValidationPanel issue rows.
 * @license GPL-3.0-only
 */
"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import { AlertTriangle, XCircle, Info } from "lucide-react";
import type { Waypoint } from "@/lib/types";
import type { FirmwareType } from "@/lib/protocol/types/enums";
import { useGeofenceStore } from "@/stores/geofence-store";
import { useDroneManager } from "@/stores/drone-manager";
import { checkAirportProximity } from "@/lib/airspace/airspace-check";
import {
  checkSoftBuffer,
  DEFAULT_SOFT_BUFFER_M,
  type SoftGeofence,
} from "@/lib/validation/soft-geofence";
import {
  checkItemCount,
  fcFamilyFromFirmware,
} from "@/lib/validation/fc-item-count";

interface MissionAdvisoriesProps {
  waypoints: Waypoint[];
  onSelectWaypoint: (id: string) => void;
}

type AdvisoryLevel = "error" | "warn" | "info";

interface AdvisoryRowData {
  key: string;
  level: AdvisoryLevel;
  message: string;
  /** Index into `waypoints` when the advisory points at a specific waypoint. */
  waypointIndex?: number;
}

/** Human-readable firmware family label for the item-count advisory copy. */
const FIRMWARE_LABEL: Record<string, string> = {
  ardupilot: "ArduPilot",
  px4: "PX4",
  betaflight: "Betaflight",
  inav: "iNav",
};

export function MissionAdvisories({
  waypoints,
  onSelectWaypoint,
}: MissionAdvisoriesProps) {
  const t = useTranslations("planner");

  const enabled = useGeofenceStore((s) => s.enabled);
  const fenceType = useGeofenceStore((s) => s.fenceType);
  const polygonPoints = useGeofenceStore((s) => s.polygonPoints);
  const circleCenter = useGeofenceStore((s) => s.circleCenter);
  const circleRadius = useGeofenceStore((s) => s.circleRadius);

  const getProtocol = useDroneManager((s) => s.getSelectedProtocol);
  const firmware: FirmwareType | undefined = getProtocol()?.getVehicleInfo()
    ?.firmwareType;

  // Pure module checks only — the translation function is intentionally kept
  // out of the memo so its render-to-render identity never re-runs the checks.
  const { airport, soft, itemCount } = useMemo(() => {
    const fence: SoftGeofence = {};
    if (enabled) {
      if (fenceType === "polygon" && polygonPoints.length >= 3) {
        fence.polygonPoints = polygonPoints;
      } else if (fenceType === "circle" && circleCenter) {
        fence.circleCenter = circleCenter;
        fence.circleRadius = circleRadius;
      }
    }
    return {
      airport: checkAirportProximity(waypoints, {}),
      soft: checkSoftBuffer(waypoints, fence, DEFAULT_SOFT_BUFFER_M),
      itemCount: checkItemCount(waypoints, firmware ? { firmware } : {}),
    };
  }, [
    waypoints,
    enabled,
    fenceType,
    polygonPoints,
    circleCenter,
    circleRadius,
    firmware,
  ]);

  const rows: AdvisoryRowData[] = [];

  for (const issue of airport) {
    rows.push({
      key: `air-${issue.airport.icao}-${issue.waypointIndex}`,
      level: issue.level,
      message: issue.message,
      waypointIndex: issue.waypointIndex,
    });
  }

  for (const warning of soft) {
    rows.push({
      key: `soft-${warning.waypointIndex}`,
      level: "warn",
      message: warning.message,
      waypointIndex: warning.waypointIndex,
    });
  }

  // Item-count headroom is always informative: it reports the plan size against
  // the FC storage ceiling even when comfortably under it.
  let itemCountMessage: string;
  if (itemCount.level === "warn") {
    const family = firmware ? fcFamilyFromFirmware(firmware) : null;
    const label = (family && FIRMWARE_LABEL[family]) || "FC";
    itemCountMessage =
      itemCount.count >= itemCount.limit
        ? t("itemCount.warnOverLimit", {
            firmware: label,
            count: itemCount.count,
            limit: itemCount.limit,
          })
        : t("itemCount.warnNearLimit", {
            firmware: label,
            count: itemCount.count,
            limit: itemCount.limit,
          });
  } else {
    itemCountMessage = t("itemCount.advisory", {
      count: itemCount.count,
      limit: itemCount.limit,
    });
  }
  rows.push({
    key: "item-count",
    level: itemCount.level === "warn" ? "warn" : "info",
    message: itemCountMessage,
  });

  if (rows.length === 0) return null;

  return (
    <div className="flex flex-col gap-0.5 border-t border-border-default pt-1.5 mt-0.5">
      <span className="px-1.5 text-[9px] font-mono uppercase tracking-wide text-text-tertiary">
        {t("validation.advisories")}
      </span>
      <div className="flex flex-col gap-0.5 max-h-[120px] overflow-y-auto">
        {rows.map((row) => (
          <AdvisoryRow
            key={row.key}
            row={row}
            onSelect={() => {
              if (row.waypointIndex === undefined) return;
              const id = waypoints[row.waypointIndex]?.id;
              if (id) onSelectWaypoint(id);
            }}
          />
        ))}
      </div>
    </div>
  );
}

// ── Single advisory row ─────────────────────────────────────

function AdvisoryRow({
  row,
  onSelect,
}: {
  row: AdvisoryRowData;
  onSelect: () => void;
}) {
  const clickable = row.waypointIndex !== undefined;
  const textColor =
    row.level === "error"
      ? "text-status-error"
      : row.level === "warn"
        ? "text-status-warning"
        : "text-text-tertiary";

  return (
    <button
      onClick={onSelect}
      className={`flex items-start gap-1.5 px-1.5 py-1 text-left transition-colors hover:bg-bg-tertiary ${
        clickable ? "cursor-pointer" : "cursor-default"
      }`}
    >
      {row.level === "error" ? (
        <XCircle size={10} className="text-status-error shrink-0 mt-0.5" />
      ) : row.level === "warn" ? (
        <AlertTriangle size={10} className="text-status-warning shrink-0 mt-0.5" />
      ) : (
        <Info size={10} className="text-text-tertiary shrink-0 mt-0.5" />
      )}
      <span className={`text-[10px] font-mono ${textColor}`}>{row.message}</span>
    </button>
  );
}
