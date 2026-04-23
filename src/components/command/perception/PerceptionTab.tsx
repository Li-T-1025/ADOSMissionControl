/**
 * @module PerceptionTab
 * @description Command > Perception sub-tab.
 * Shows live video + HUD, vision behaviors panel, and
 * a 3D Live Surroundings pane (occupancy grid + depth cloud + entity billboards).
 * @license GPL-3.0-only
 */
"use client";

import { useState } from "react";
import { useAgentConnectionStore } from "@/stores/agent-connection-store";
import { cn } from "@/lib/utils";
import { LiveSurroundings } from "./LiveSurroundings";
import { VisionModelManager } from "./VisionModelManager";
import { ComingSoon } from "@/components/ui/coming-soon";
import { Eye, Box, Cpu } from "lucide-react";

type Panel = "video" | "surroundings" | "models";

const PANELS: { id: Panel; label: string; icon: typeof Eye }[] = [
  { id: "video", label: "Video & HUD", icon: Eye },
  { id: "surroundings", label: "Surroundings", icon: Box },
  { id: "models", label: "Models", icon: Cpu },
];

export function PerceptionTab() {
  const [activePanel, setActivePanel] = useState<Panel>("surroundings");
  const agentUrl = useAgentConnectionStore((s) => s.agentUrl);

  return (
    <div className="flex flex-col h-full">
      {/* Panel selector */}
      <div className="flex items-stretch gap-0 border-b border-border-primary bg-surface-primary px-4">
        {PANELS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActivePanel(id)}
            className={cn(
              "flex items-center gap-1.5 px-3 py-2 text-xs font-medium transition-colors -mb-px border-b-2",
              activePanel === id
                ? "text-accent-primary border-accent-primary"
                : "text-text-secondary hover:text-text-primary border-transparent"
            )}
          >
            <Icon size={12} />
            {label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {activePanel === "video" && (
          <ComingSoon label="Video & HUD — SmartModes content moving here" />
        )}
        {activePanel === "surroundings" && <LiveSurroundings agentUrl={agentUrl} />}
        {activePanel === "models" && <VisionModelManager agentUrl={agentUrl} />}
      </div>
    </div>
  );
}
