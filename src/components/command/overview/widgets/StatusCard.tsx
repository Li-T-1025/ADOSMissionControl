"use client";
import { useAgentConnectionStore } from "@/stores/agent-connection-store";
import { useAgentSystemStore } from "@/stores/agent-system-store";
import { useFreshness } from "@/lib/agent/freshness";
import { Wifi, WifiOff } from "lucide-react";
import { cn } from "@/lib/utils";

export function StatusCard() {
  const connected = useAgentConnectionStore((s) => s.connected);
  const status = useAgentSystemStore((s) => s.status);
  const freshness = useFreshness();
  const isLive = connected && freshness.state === "live";
  return (
    <div className="p-3 h-full flex flex-col justify-between">
      <div className="flex items-center gap-2">
        {isLive ? <Wifi size={14} className="text-status-success" /> : <WifiOff size={14} className="text-status-error" />}
        <span className={cn("text-xs font-medium", isLive ? "text-status-success" : "text-status-error")}>
          {isLive ? "Connected" : connected ? "Stale" : "Offline"}
        </span>
      </div>
      {status && (
        <div className="text-xs text-text-secondary mt-1">
          <div>{status.board?.name ?? "Unknown board"}</div>
          <div className="text-text-tertiary">{String(status.version ?? "?")}</div>
        </div>
      )}
    </div>
  );
}
