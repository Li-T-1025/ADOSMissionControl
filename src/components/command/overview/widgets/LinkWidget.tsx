"use client";
import { useTelemetryStore } from "@/stores/telemetry-store";
import { Radio } from "lucide-react";

export function LinkWidget() {
  useTelemetryStore((s) => s._version);
  const radio = useTelemetryStore((s) => s.radio);
  const latest = radio?.latest?.() ?? null;
  return (
    <div className="p-3 h-full flex flex-col justify-between">
      <div className="flex items-center gap-2">
        <Radio size={14} className="text-accent-secondary" />
        <span className="text-xs text-text-tertiary uppercase tracking-wider">Link</span>
      </div>
      <span className="text-lg font-bold tabular-nums text-text-primary">
        {latest ? `${latest.rssi}` : "--"}
      </span>
    </div>
  );
}
