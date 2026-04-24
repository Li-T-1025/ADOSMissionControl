/**
 * @module ControlTab
 * @description Unified Control sub-tab that absorbs Smart Modes,
 * Features, Scripts, and text commands into a single operational surface.
 * @license GPL-3.0-only
 */
"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { cn } from "@/lib/utils";
import { TerminalSquare, Sparkles, Zap, ListChecks } from "lucide-react";

const SmartModesTab = dynamic(() => import("../SmartModesTab").then((m) => ({ default: m.SmartModesTab })), { ssr: false });
const FeaturesTab = dynamic(() => import("../FeaturesTab").then((m) => ({ default: m.FeaturesTab })), { ssr: false });
const ScriptsTab = dynamic(() => import("../ScriptsTab").then((m) => ({ default: m.ScriptsTab })), { ssr: false });
const McpConsole = dynamic(() => import("../mcp/McpConsole").then((m) => ({ default: m.McpConsole })), { ssr: false });

type ControlPanel = "smart-modes" | "features" | "scripts" | "command";

const PANELS: { id: ControlPanel; label: string; icon: typeof Zap }[] = [
  { id: "smart-modes", label: "Smart Modes", icon: Zap },
  { id: "features", label: "Features", icon: Sparkles },
  { id: "scripts", label: "Scripts", icon: ListChecks },
  { id: "command", label: "Command", icon: TerminalSquare },
];

export function ControlTab() {
  const [active, setActive] = useState<ControlPanel>("smart-modes");

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-stretch gap-0 border-b border-border-primary bg-surface-primary px-4">
        {PANELS.map(({ id, label, icon: Icon }) => (
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
            <Icon size={12} />
            {label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-hidden">
        {active === "smart-modes" && <SmartModesTab />}
        {active === "features" && <FeaturesTab />}
        {active === "scripts" && <ScriptsTab />}
        {active === "command" && <McpConsole />}
      </div>
    </div>
  );
}
