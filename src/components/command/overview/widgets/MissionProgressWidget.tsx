"use client";
import { useMissionStore } from "@/stores/mission-store";

export function MissionProgressWidget() {
  const waypoints = useMissionStore((s) => s.waypoints);
  const total = waypoints?.length ?? 0;
  return (
    <div className="p-3 h-full flex flex-col justify-between">
      <span className="text-xs text-text-tertiary uppercase tracking-wider">Mission</span>
      <div className="text-sm font-bold text-text-primary">
        {total > 0 ? total + " waypoints" : "No mission"}
      </div>
    </div>
  );
}
