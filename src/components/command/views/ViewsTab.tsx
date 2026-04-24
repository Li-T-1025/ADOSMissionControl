/**
 * @module ViewsTab
 * @description Multi-visualization surface with 7 sub-views.
 * @license GPL-3.0-only
 */
"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import {
  Monitor, Grid3x3, SplitSquareHorizontal, Activity,
  BarChart3, Settings, Map,
} from "lucide-react";

type ViewsSubView =
  | "multi-camera"
  | "multi-drone"
  | "compare"
  | "sensor-dashboard"
  | "data-analysis"
  | "parameter-explorer"
  | "heatmaps";

const SUBVIEWS: { id: ViewsSubView; label: string; icon: typeof Monitor; description: string }[] = [
  { id: "multi-camera", label: "Multi-Camera", icon: Grid3x3, description: "Up to 4 video feeds in a grid, one camera per tile." },
  { id: "multi-drone", label: "Multi-Drone", icon: Monitor, description: "Tiled per-drone HUD for small fleets." },
  { id: "compare", label: "Compare", icon: SplitSquareHorizontal, description: "Two-pane side-by-side comparison of flights or drones." },
  { id: "sensor-dashboard", label: "Sensors", icon: Activity, description: "Raw sensor history: IMU, baro, rangefinder, flow." },
  { id: "data-analysis", label: "Analysis", icon: BarChart3, description: "FFT spectrum, PID response curves, motor output." },
  { id: "parameter-explorer", label: "Parameters", icon: Settings, description: "Sortable FC parameters with diff-vs-default." },
  { id: "heatmaps", label: "Heatmaps", icon: Map, description: "Entity density, coverage, signal strength." },
];

function DeferredPanel({ label, description, Icon }: { label: string; description: string; Icon: typeof Monitor }) {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-3 p-8 text-center">
      <div className="opacity-30">
        <Icon size={40} />
      </div>
      <h3 className="text-base font-medium text-text-primary">{label}</h3>
      <p className="text-sm text-text-secondary max-w-md">{description}</p>
      <span className="text-xs px-2 py-0.5 rounded bg-accent-primary/10 text-accent-primary border border-accent-primary/20">
        Planned for a future update
      </span>
    </div>
  );
}

export function ViewsTab() {
  const [active, setActive] = useState<ViewsSubView>("multi-camera");
  const activeView = SUBVIEWS.find((v) => v.id === active)!;

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-stretch gap-0 border-b border-border-primary bg-surface-primary px-4 overflow-x-auto">
        {SUBVIEWS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActive(id)}
            className={cn(
              "flex items-center gap-1.5 px-3 py-2 text-xs font-medium whitespace-nowrap transition-colors -mb-px border-b-2 flex-shrink-0",
              active === id
                ? "text-accent-primary border-accent-primary"
                : "text-text-secondary hover:text-text-primary border-transparent"
            )}
          >
            <Icon size={11} />
            {label}
          </button>
        ))}
      </div>
      <div className="flex-1 overflow-hidden">
        <DeferredPanel label={activeView.label} description={activeView.description} Icon={activeView.icon} />
      </div>
    </div>
  );
}
