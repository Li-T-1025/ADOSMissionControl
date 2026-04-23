"use client";
import { useTelemetryStore } from "@/stores/telemetry-store";

export function SpeedWidget() {
  useTelemetryStore((s) => s._version);
  const pos = useTelemetryStore((s) => s.position);
  const latest = pos.latest();
  const speed = latest?.groundSpeed ?? null;
  return (
    <div className="p-3 h-full flex flex-col justify-between">
      <span className="text-xs text-text-tertiary uppercase tracking-wider">Speed</span>
      <span className="text-xl font-bold tabular-nums text-text-primary">
        {speed !== null ? `${speed.toFixed(1)} m/s` : "--"}
      </span>
    </div>
  );
}
