"use client";
import { useTelemetryStore } from "@/stores/telemetry-store";

export function AltitudeWidget() {
  useTelemetryStore((s) => s._version);
  const pos = useTelemetryStore((s) => s.position);
  const latest = pos.latest();
  const alt = latest?.relativeAlt ?? null;
  return (
    <div className="p-3 h-full flex flex-col justify-between">
      <span className="text-xs text-text-tertiary uppercase tracking-wider">Altitude</span>
      <span className="text-xl font-bold tabular-nums text-text-primary">
        {alt !== null ? `${alt.toFixed(1)}m` : "--"}
      </span>
    </div>
  );
}
