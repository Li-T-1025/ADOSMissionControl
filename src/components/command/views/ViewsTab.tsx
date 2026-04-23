/**
 * @license GPL-3.0-only
 */
"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { ComingSoon } from "@/components/ui/coming-soon";

type ViewsSubView =
  | "multi-camera"
  | "multi-drone"
  | "compare"
  | "sensor-dashboard"
  | "data-analysis"
  | "parameter-explorer"
  | "heatmaps";

const SUBVIEWS: { id: ViewsSubView; label: string }[] = [
  { id: "multi-camera", label: "Multi-Camera" },
  { id: "multi-drone", label: "Multi-Drone" },
  { id: "compare", label: "Compare" },
  { id: "sensor-dashboard", label: "Sensors" },
  { id: "data-analysis", label: "Analysis" },
  { id: "parameter-explorer", label: "Parameters" },
  { id: "heatmaps", label: "Heatmaps" },
];

export function ViewsTab() {
  const [active, setActive] = useState<ViewsSubView>("multi-camera");

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-stretch gap-0 border-b border-border-primary bg-surface-primary px-4 overflow-x-auto">
        {SUBVIEWS.map(({ id, label }) => (
          <button
            key={id}
            onClick={() => setActive(id)}
            className={cn(
              "px-3 py-2 text-xs font-medium whitespace-nowrap transition-colors -mb-px border-b-2 flex-shrink-0",
              active === id
                ? "text-accent-primary border-accent-primary"
                : "text-text-secondary hover:text-text-primary border-transparent"
            )}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="flex-1 overflow-hidden">
        <ComingSoon label={`${SUBVIEWS.find((v) => v.id === active)?.label} — coming in a future update`} />
      </div>
    </div>
  );
}
