"use client";

/**
 * @module DiscoveredAgentsList
 * @description Grid of LAN-discovered drone agents available for direct
 * pairing without going through the cloud code path.
 * @license GPL-3.0-only
 */

import { useTranslations } from "next-intl";
import { Cpu, Wifi } from "lucide-react";

interface DiscoveredAgent {
  deviceId: string;
  name: string;
  board: string;
  pairingCode: string;
}

export interface DiscoveredAgentsListProps {
  agents: DiscoveredAgent[];
  onSelect?: () => void;
}

export function DiscoveredAgentsList({
  agents,
  onSelect,
}: DiscoveredAgentsListProps) {
  const tc = useTranslations("command");

  if (agents.length === 0) return null;

  return (
    <div className="max-w-2xl mx-auto space-y-3">
      <h2 className="text-xs font-medium text-text-primary flex items-center gap-2">
        <Wifi size={12} className="text-status-success" />
        {tc("discoveredOnYourNetwork")}
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {agents.map((agent) => (
          <button
            key={agent.deviceId}
            onClick={onSelect}
            className="flex items-center gap-3 p-3 bg-bg-secondary border border-border-default rounded hover:border-accent-primary/40 transition-colors text-left"
          >
            <div className="w-8 h-8 rounded bg-accent-primary/10 flex items-center justify-center shrink-0">
              <Cpu size={14} className="text-accent-primary" />
            </div>
            <div>
              <p className="text-xs font-medium text-text-primary">
                {agent.name}
              </p>
              <p className="text-[10px] text-text-tertiary">
                {agent.board} &middot;{" "}
                <span className="font-mono">{agent.pairingCode}</span>
              </p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
