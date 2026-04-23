/**
 * @license GPL-3.0-only
 */
"use client";

import { useWorldModelStore } from "@/stores/world-model-store";
import { RefreshCw, Cloud, CloudOff } from "lucide-react";
import { cn } from "@/lib/utils";

interface FlightListProps {
  apiBase: string;
  authHeaders: () => Record<string, string>;
}

export function FlightList({ apiBase, authHeaders }: FlightListProps) {
  const flights = useWorldModelStore((s) => s.flights);
  const selectFlight = useWorldModelStore((s) => s.selectFlight);
  const selectedFlightId = useWorldModelStore((s) => s.selectedFlightId);

  const formatDuration = (startTs: string, endTs: string | null) => {
    if (!endTs) return "In progress";
    const diff = (new Date(endTs).getTime() - new Date(startTs).getTime()) / 1000;
    if (diff < 60) return `${Math.round(diff)}s`;
    return `${Math.round(diff / 60)}min`;
  };

  const formatDist = (m: number) => {
    if (m < 1000) return `${Math.round(m)}m`;
    return `${(m / 1000).toFixed(1)}km`;
  };

  if (flights.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-2 text-text-tertiary">
        <p className="text-sm">No flights in World Model yet</p>
        <p className="text-xs opacity-60">
          Enable World Model on the drone to start recording observations
        </p>
      </div>
    );
  }

  return (
    <div className="divide-y divide-border-primary/30">
      {flights.map((f) => (
        <button
          key={f.id}
          onClick={() => selectFlight(f.id === selectedFlightId ? null : f.id)}
          className={cn(
            "w-full text-left px-4 py-3 hover:bg-surface-secondary/50 transition-colors",
            f.id === selectedFlightId && "bg-surface-secondary border-l-2 border-accent-primary"
          )}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {f.syncedAt ? (
                <Cloud size={12} className="text-status-success" />
              ) : (
                <CloudOff size={12} className="text-text-tertiary" />
              )}
              <span className="text-sm font-medium text-text-primary">
                {new Date(f.startTs).toLocaleDateString()} {new Date(f.startTs).toLocaleTimeString()}
              </span>
            </div>
            <span className="text-xs text-text-tertiary">
              {formatDuration(f.startTs, f.endTs)}
            </span>
          </div>
          <div className="flex items-center gap-4 mt-1 text-xs text-text-secondary">
            <span>{f.observationCount} obs</span>
            <span>{f.entityCount} entities</span>
            <span>{f.frameCount} frames</span>
            {f.distanceM > 0 && <span>{formatDist(f.distanceM)}</span>}
            {f.maxAltM > 0 && <span>{Math.round(f.maxAltM)}m max alt</span>}
          </div>
        </button>
      ))}
    </div>
  );
}
