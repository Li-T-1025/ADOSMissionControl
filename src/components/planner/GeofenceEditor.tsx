/**
 * @module GeofenceEditor
 * @description Geofence configuration panel. Binds directly to geofence-store
 * for enable/type/altitude/action so the drawn boundary, validation, simulation,
 * and FC upload all read the same source of truth.
 * Supports circle/polygon fence types with upload/download to FC.
 * @license GPL-3.0-only
 */
"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import { Toggle } from "@/components/ui/toggle";
import { Select } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useGeofenceStore } from "@/stores/geofence-store";
import type { FenceType, BreachAction } from "@/stores/geofence-store";
import { Upload, Download, Pentagon, Circle } from "lucide-react";
import { cn } from "@/lib/utils";

interface GeofenceEditorProps {
  /** Enter a draw tool for the given fence shape. */
  onDrawOnMap?: (type: "polygon" | "circle") => void;
}

export function GeofenceEditor({ onDrawOnMap }: GeofenceEditorProps) {
  const t = useTranslations("geofence");

  const enabled = useGeofenceStore((s) => s.enabled);
  const fenceType = useGeofenceStore((s) => s.fenceType);
  const maxAltitude = useGeofenceStore((s) => s.maxAltitude);
  const breachAction = useGeofenceStore((s) => s.breachAction);
  const setEnabled = useGeofenceStore((s) => s.setEnabled);
  const setFenceType = useGeofenceStore((s) => s.setFenceType);
  const setMaxAltitude = useGeofenceStore((s) => s.setMaxAltitude);
  const setBreachAction = useGeofenceStore((s) => s.setBreachAction);
  const uploadFence = useGeofenceStore((s) => s.uploadFence);
  const downloadFence = useGeofenceStore((s) => s.downloadFence);
  const uploadState = useGeofenceStore((s) => s.uploadState);
  const polygonPoints = useGeofenceStore((s) => s.polygonPoints);
  const circleCenter = useGeofenceStore((s) => s.circleCenter);

  const GEOFENCE_TYPE_OPTIONS = useMemo(() => [
    { value: "circle", label: t("circle") },
    { value: "polygon", label: t("polygon") },
  ], [t]);

  const GEOFENCE_ACTION_OPTIONS = useMemo(() => [
    { value: "RTL", label: t("rtlOrLand") },
    { value: "LAND", label: t("land") },
    { value: "REPORT", label: t("report") },
  ], [t]);

  const hasFenceGeometry =
    fenceType === "polygon" ? polygonPoints.length >= 3 : circleCenter !== null;

  return (
    <div className="flex flex-col gap-3 px-3 py-2">
      <div className="flex items-center justify-between">
        <Toggle label={t("enableGeofence")} checked={enabled} onChange={setEnabled} />
        <Badge variant={enabled ? "success" : "neutral"} size="sm">
          {enabled ? t("active") : t("off")}
        </Badge>
      </div>

      {enabled && (
        <>
          <Select
            label={t("type")}
            options={GEOFENCE_TYPE_OPTIONS}
            value={fenceType}
            onChange={(v) => setFenceType(v as FenceType)}
          />
          <Input
            label={t("maxAltitude")}
            type="number"
            unit="m"
            value={String(maxAltitude)}
            onChange={(e) => {
              const v = parseFloat(e.target.value);
              setMaxAltitude(Number.isFinite(v) ? v : 0);
            }}
            placeholder="120"
          />
          <Select
            label={t("fenceAction")}
            options={GEOFENCE_ACTION_OPTIONS}
            value={breachAction}
            onChange={(v) => setBreachAction(v as BreachAction)}
          />

          {/* Draw on Map button */}
          {onDrawOnMap && (
            <button
              onClick={() => onDrawOnMap(fenceType === "polygon" ? "polygon" : "circle")}
              className="flex items-center justify-center gap-2 py-1.5 text-xs font-mono
                text-accent-primary border border-accent-primary/30 hover:bg-accent-primary/10
                transition-colors cursor-pointer"
            >
              {fenceType === "polygon" ? <Pentagon size={12} /> : <Circle size={12} />}
              {t("drawOnMap")}
            </button>
          )}

          {/* Fence geometry status */}
          <div className="text-[10px] font-mono text-text-tertiary">
            {fenceType === "polygon" && polygonPoints.length > 0 && (
              <span>{t("fencePointsDefined", { count: polygonPoints.length })}</span>
            )}
            {fenceType === "circle" && circleCenter && (
              <span>{t("circleFenceSet")}</span>
            )}
            {!hasFenceGeometry && (
              <span>{t("noFenceBoundary")}</span>
            )}
          </div>

          {/* Upload / Download buttons */}
          <div className="flex gap-2">
            <button
              onClick={() => uploadFence()}
              disabled={!hasFenceGeometry}
              className={cn(
                "flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-mono transition-colors cursor-pointer",
                "border border-border-default",
                hasFenceGeometry
                  ? "text-text-primary hover:bg-bg-tertiary"
                  : "text-text-tertiary opacity-50 cursor-not-allowed"
              )}
            >
              <Upload size={12} />
              {uploadState === "uploading" ? t("uploading") : t("uploadFence")}
            </button>
            <button
              onClick={() => downloadFence()}
              className="flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-mono
                text-text-primary border border-border-default hover:bg-bg-tertiary transition-colors cursor-pointer"
            >
              <Download size={12} />
              {t("download")}
            </button>
          </div>

          {uploadState === "uploaded" && (
            <div className="text-[10px] font-mono text-status-success">{t("fenceUploaded")}</div>
          )}
          {uploadState === "error" && (
            <div className="text-[10px] font-mono text-status-error">{t("uploadFailed")}</div>
          )}
        </>
      )}
    </div>
  );
}
