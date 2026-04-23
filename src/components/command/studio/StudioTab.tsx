/**
 * @license GPL-3.0-only
 */
"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { ComingSoon } from "@/components/ui/coming-soon";

type StudioSubView = "reconstructions" | "gallery" | "datasets" | "processing" | "compare";

const SUBVIEWS: { id: StudioSubView; label: string }[] = [
  { id: "reconstructions", label: "Reconstructions" },
  { id: "gallery", label: "Gallery" },
  { id: "datasets", label: "Datasets" },
  { id: "processing", label: "Processing" },
  { id: "compare", label: "Compare" },
];

export function StudioTab() {
  const [active, setActive] = useState<StudioSubView>("reconstructions");

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-stretch gap-0 border-b border-border-primary bg-surface-primary px-4">
        {SUBVIEWS.map(({ id, label }) => (
          <button
            key={id}
            onClick={() => setActive(id)}
            className={cn(
              "px-3 py-2 text-xs font-medium transition-colors -mb-px border-b-2",
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
        <ComingSoon label={`Studio ${SUBVIEWS.find((v) => v.id === active)?.label} — survey data required`} />
      </div>
    </div>
  );
}
