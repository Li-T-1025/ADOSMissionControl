/**
 * @module StudioTab
 * @description Studio sub-tab for survey reconstruction outputs.
 * @license GPL-3.0-only
 */
"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { Box, Image, Database, Cpu, SplitSquareHorizontal } from "lucide-react";

type StudioSubView = "reconstructions" | "gallery" | "datasets" | "processing" | "compare";

const SUBVIEWS: { id: StudioSubView; label: string; icon: typeof Box; description: string }[] = [
  { id: "reconstructions", label: "Reconstructions", icon: Box, description: "Potree point clouds, gsplat Gaussian splats, and GLTF mesh viewers for survey outputs." },
  { id: "gallery", label: "Gallery", icon: Image, description: "Captured frames grid, filterable by flight, class, and tag." },
  { id: "datasets", label: "Datasets", icon: Database, description: "Packaged survey datasets in ODM-compatible, COLMAP, nerfstudio, and generic formats." },
  { id: "processing", label: "Processing", icon: Cpu, description: "Trigger WebODM post-processing jobs and monitor progress." },
  { id: "compare", label: "Compare", icon: SplitSquareHorizontal, description: "Two reconstructions side-by-side with a synchronized orbit camera." },
];

function DeferredPanel({ label, description, Icon }: { label: string; description: string; Icon: typeof Box }) {
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
      <p className="text-xs text-text-tertiary mt-2">
        Needs WebODM or similar photogrammetry pipeline to produce reconstruction output first.
      </p>
    </div>
  );
}

export function StudioTab() {
  const [active, setActive] = useState<StudioSubView>("reconstructions");
  const activeView = SUBVIEWS.find((v) => v.id === active)!;

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-stretch gap-0 border-b border-border-primary bg-surface-primary px-4">
        {SUBVIEWS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActive(id)}
            className={cn(
              "flex items-center gap-1.5 px-3 py-2 text-xs font-medium transition-colors -mb-px border-b-2",
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
