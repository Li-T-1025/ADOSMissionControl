"use client";
import { useTelemetryStore } from "@/stores/telemetry-store";
import { Battery, BatteryLow } from "lucide-react";
import { cn } from "@/lib/utils";

export function BatteryWidget() {
  useTelemetryStore((s) => s._version);
  const battery = useTelemetryStore((s) => s.battery);
  const latest = battery.latest();
  const pct = latest?.remaining ?? null;
  const voltage = latest?.voltage ?? null;
  const hasReal = (voltage ?? 0) >= 1.0;
  const color = pct === null || !hasReal ? "text-text-tertiary" : pct > 50 ? "text-status-success" : pct > 20 ? "text-status-warning" : "text-status-error";
  return (
    <div className="p-3 h-full flex flex-col justify-between">
      <div className="flex items-center gap-2">
        <Battery size={14} className={color} />
        <span className={cn("text-lg font-bold tabular-nums", color)}>
          {pct !== null && hasReal ? `${pct}%` : "--"}
        </span>
      </div>
      {voltage !== null && hasReal && <div className="text-xs text-text-tertiary">{voltage.toFixed(2)}V</div>}
    </div>
  );
}
