"use client";
import { useTelemetryStore } from "@/stores/telemetry-store";
import { MapPin } from "lucide-react";
import { cn } from "@/lib/utils";

export function GpsWidget() {
  useTelemetryStore((s) => s._version);
  const gps = useTelemetryStore((s) => s.gps);
  const latest = gps.latest();
  const sats = latest?.satellites ?? 0;
  const fix = latest?.fixType ?? 0;
  const color = fix >= 3 ? "text-status-success" : fix >= 2 ? "text-status-warning" : "text-text-tertiary";
  return (
    <div className="p-3 h-full flex flex-col justify-between">
      <div className="flex items-center gap-2">
        <MapPin size={14} className={color} />
        <span className={cn("text-lg font-bold tabular-nums", color)}>{latest ? sats : "--"}</span>
        <span className="text-xs text-text-tertiary">sats</span>
      </div>
      <div className="text-xs text-text-tertiary">
        {fix >= 3 ? "3D fix" : fix >= 2 ? "2D fix" : "No fix"}
      </div>
    </div>
  );
}
