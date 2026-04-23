/**
 * @license GPL-3.0-only
 */
"use client";

import { useState } from "react";
import { useMcpStore } from "@/stores/mcp-store";
import { McpOperatorPresentBar } from "./McpOperatorPresentBar";
import { PairAndTokensView } from "./PairAndTokensView";
import { McpAuditView } from "./McpAuditView";
import { McpConsole } from "./McpConsole";
import { ComingSoon } from "@/components/ui/coming-soon";
import { cn } from "@/lib/utils";

type McpSubPanel = "tokens" | "audit" | "resources" | "tools" | "replay" | "console";

const PANELS: { id: McpSubPanel; label: string }[] = [
  { id: "tokens", label: "Pair & Tokens" },
  { id: "audit", label: "Audit" },
  { id: "resources", label: "Resources" },
  { id: "tools", label: "Tools" },
  { id: "replay", label: "Replay" },
  { id: "console", label: "Console" },
];

export function McpTab() {
  const [activePanel, setActivePanel] = useState<McpSubPanel>("tokens");
  const serviceState = useMcpStore((s) => s.serviceState);
  const sessions = useMcpStore((s) => s.sessions);

  return (
    <div className="flex flex-col h-full">
      {/* Persistent header bar with operator-present toggle */}
      <McpOperatorPresentBar
        serviceState={serviceState}
        activeSessions={sessions.length}
        activeSubscriptions={sessions.reduce((acc, s) => acc + s.activeSubscriptions, 0)}
      />

      {/* Sub-panel selector */}
      <div className="flex items-stretch gap-0 border-b border-border-primary bg-surface-primary px-4">
        {PANELS.map(({ id, label }) => (
          <button
            key={id}
            onClick={() => setActivePanel(id)}
            className={cn(
              "px-3 py-2 text-xs font-medium transition-colors -mb-px border-b-2",
              activePanel === id
                ? "text-accent-primary border-accent-primary"
                : "text-text-secondary hover:text-text-primary border-transparent"
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Panel content */}
      <div className="flex-1 overflow-y-auto">
        {activePanel === "tokens" && <PairAndTokensView />}
        {activePanel === "audit" && <McpAuditView />}
        {activePanel === "resources" && <ComingSoon label="Resources browser — coming in a future update" />}
        {activePanel === "tools" && <ComingSoon label="Tools tester — coming in a future update" />}
        {activePanel === "replay" && <ComingSoon label="Session replay — coming in a future update" />}
        {activePanel === "console" && <McpConsole />}
      </div>
    </div>
  );
}
