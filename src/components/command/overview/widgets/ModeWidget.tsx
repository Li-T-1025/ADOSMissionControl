"use client";
import { useDroneStore } from "@/stores/drone-store";

export function ModeWidget() {
  const mode = useDroneStore((s) => s.flightMode);
  return (
    <div className="p-3 h-full flex flex-col justify-between">
      <span className="text-xs text-text-tertiary uppercase tracking-wider">Mode</span>
      <span className="text-sm font-bold text-accent-primary">{mode ?? "--"}</span>
    </div>
  );
}
