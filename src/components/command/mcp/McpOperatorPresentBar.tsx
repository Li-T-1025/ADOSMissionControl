/**
 * @license GPL-3.0-only
 */
"use client";

import { cn } from "@/lib/utils";
import { useMcpStore } from "@/stores/mcp-store";
import { Shield, ShieldOff, Activity } from "lucide-react";
import { useOperatorPresent } from "@/hooks/use-operator-present";

interface McpOperatorPresentBarProps {
  serviceState: "healthy" | "degraded" | "failing" | "offline";
  activeSessions?: number;
  activeSubscriptions?: number;
}

export function McpOperatorPresentBar({
  serviceState,
  activeSessions = 0,
  activeSubscriptions = 0,
}: McpOperatorPresentBarProps) {
  const operatorPresent = useMcpStore((s) => s.operatorPresent);
  const setOperatorPresent = useMcpStore((s) => s.setOperatorPresent);

  // Heartbeat side-effect
  useOperatorPresent();

  const statusColor =
    serviceState === "healthy"
      ? "text-status-success"
      : serviceState === "degraded"
        ? "text-status-warning"
        : "text-status-error";

  return (
    <div className="flex items-center gap-4 px-4 py-2 bg-surface-secondary border-b border-border-primary text-xs">
      {/* Service health */}
      <div className="flex items-center gap-1.5">
        <Activity size={12} className={statusColor} />
        <span className={cn("font-medium capitalize", statusColor)}>{serviceState}</span>
      </div>

      <span className="text-border-primary">|</span>

      {/* Session + subscription counts */}
      <span className="text-text-secondary">
        {activeSessions} session{activeSessions !== 1 ? "s" : ""}
      </span>
      <span className="text-text-secondary">
        {activeSubscriptions} sub{activeSubscriptions !== 1 ? "s" : ""}
      </span>

      <div className="flex-1" />

      {/* Operator-present toggle */}
      <button
        onClick={() => setOperatorPresent(!operatorPresent)}
        className={cn(
          "flex items-center gap-1.5 px-3 py-1 rounded text-xs font-medium transition-colors",
          operatorPresent
            ? "bg-status-success/20 text-status-success border border-status-success/40"
            : "bg-surface-tertiary text-text-secondary border border-border-primary hover:text-text-primary"
        )}
        title={
          operatorPresent
            ? "Operator present — flight_action Tools allowed. Click to disable."
            : "Operator absent — flight_action Tools blocked. Click to enable."
        }
      >
        {operatorPresent ? (
          <Shield size={12} className="text-status-success" />
        ) : (
          <ShieldOff size={12} />
        )}
        {operatorPresent ? "Operator Present" : "Operator Absent"}
      </button>
    </div>
  );
}
