"use client";

/**
 * @module FcLinkCard
 * @description The flight-controller link summary tile for the drone Overview
 * FC band. A non-agent sibling of `AgentStatusCard`: it reads the direct
 * MAVLink stream (arm / prearm / flight mode / heartbeat rate / transport)
 * rather than an agent heartbeat, so it renders for a bare flight controller
 * on day one. Unknown fields read as grey placeholders (never a fake 0/green).
 * @license GPL-3.0-only
 */

import { Cpu } from "lucide-react";
import { cn } from "@/lib/utils";
import { StatusDot, type StatusLevel } from "@/components/ui/status-dot";
import { useDroneStore } from "@/stores/drone-store";
import { useDroneManager } from "@/stores/drone-manager";
import { usePrearmBufferStore } from "@/stores/prearm-buffer-store";
import { useHeartbeatRate } from "@/hooks/use-heartbeat-rate";
import type { Transport } from "@/lib/protocol/types/transport";

const TRANSPORT_LABEL: Record<Transport["type"], string> = {
  webserial: "USB serial", // i18n
  websocket: "WebSocket", // i18n
  tcp: "TCP", // i18n
  "udp-proxy": "UDP", // i18n
  "mqtt-mavlink": "Cloud relay", // i18n
  ble: "Bluetooth", // i18n
};

/** Stable empty reference for the prearm-lines fallback — returning a fresh `[]`
 * from the store selector breaks useSyncExternalStore snapshot caching and loops. */
const EMPTY_LINES: string[] = [];

function Stat({
  label,
  value,
  level,
}: {
  label: string;
  value: string;
  level?: StatusLevel;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-text-tertiary">
        {label}
        {level && <StatusDot status={level} size="xs" />}
      </span>
      <span className="truncate font-mono text-sm font-semibold tabular-nums text-text-primary">
        {value}
      </span>
    </div>
  );
}

interface FcLinkCardProps {
  className?: string;
}

export function FcLinkCard({ className }: FcLinkCardProps) {
  const connectionState = useDroneStore((s) => s.connectionState);
  const flightMode = useDroneStore((s) => s.flightMode);
  const armState = useDroneStore((s) => s.armState);
  const selectedId = useDroneStore((s) => s.selectedId);

  // Select the stable buffers map (immutably replaced on update), then derive
  // the lines outside the selector so no fresh array is returned per render.
  const prearmBuffers = usePrearmBufferStore((s) => s.buffers);
  const prearmLines = selectedId
    ? (prearmBuffers[selectedId] ?? EMPTY_LINES)
    : EMPTY_LINES;

  const transportType = useDroneManager((s) => {
    const id = s.selectedDroneId;
    return id ? (s.drones.get(id)?.transport.type ?? null) : null;
  });

  const { hz, stale } = useHeartbeatRate();

  const connected = connectionState !== "disconnected";
  const armed = armState === "armed";
  const prearmBlocked = !armed && prearmLines.length > 0;

  const armLevel: StatusLevel = !connected
    ? "offline"
    : armed
      ? "good"
      : prearmBlocked
        ? "warning"
        : "idle";
  const armLabel = !connected
    ? "—"
    : armed
      ? "Armed" // i18n
      : prearmBlocked
        ? "Prearm blocked" // i18n
        : "Disarmed"; // i18n

  const hbLevel: StatusLevel = !connected
    ? "offline"
    : stale
      ? "serious"
      : hz != null
        ? "good"
        : "idle";
  const hbValue =
    connected && hz != null ? `${hz.toFixed(1)} Hz` : connected ? "—" : "—";

  const linkValue = transportType ? TRANSPORT_LABEL[transportType] : "—";
  const linkLevel: StatusLevel = connected ? "good" : "offline";

  return (
    <div
      className={cn(
        "flex h-full flex-col rounded-lg border border-border-default bg-bg-secondary p-4",
        className,
      )}
    >
      <div className="mb-3 flex items-center gap-1.5">
        <Cpu className="h-3.5 w-3.5 text-text-tertiary" />
        {/* i18n */}
        <span className="text-xs font-medium text-text-secondary">
          Flight Controller
        </span>
        <StatusDot
          status={connected ? "good" : "offline"}
          size="xs"
          className="ml-auto"
        />
      </div>

      <div className="grid grid-cols-2 gap-x-3 gap-y-3">
        {/* i18n */}
        <Stat label="Mode" value={connected ? flightMode : "—"} />
        <Stat label="State" value={armLabel} level={armLevel} />
        <Stat label="Heartbeat" value={hbValue} level={hbLevel} />
        <Stat label="Link" value={linkValue} level={linkLevel} />
      </div>

      {prearmBlocked && (
        <p className="mt-3 truncate text-[10px] text-status-warning">
          {prearmLines[prearmLines.length - 1]}
        </p>
      )}
    </div>
  );
}
