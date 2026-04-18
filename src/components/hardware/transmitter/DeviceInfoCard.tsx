"use client";

/**
 * @module DeviceInfoCard
 * @description Read-only device identity panel. Probes `SYSTEM INFO`
 * against the connected radio on mount and renders the result as a
 * grid: firmware, board, MCU, chip id, flash capacity, last reset
 * reason, and uptime. Older firmwares that do not implement SYSTEM INFO
 * surface a short notice and fall back to the cached session info.
 * @license GPL-3.0-only
 */

import { useEffect, useState } from "react";
import { useAdosEdgeStore } from "@/stores/ados-edge-store";
import type { SystemInfo } from "@/lib/ados-edge/edge-link";
import { Button } from "@/components/ui/button";

type Status = "idle" | "loading" | "ready" | "unsupported" | "error";

export function DeviceInfoCard() {
  const connected = useAdosEdgeStore((s) => s.state === "connected");
  const firmware = useAdosEdgeStore((s) => s.firmware);
  const link = useAdosEdgeStore((s) => s.link);

  const [info, setInfo] = useState<SystemInfo | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);

  const refresh = async () => {
    if (!link) return;
    setStatus("loading");
    setError(null);
    try {
      const next = await link.systemInfo();
      setInfo(next);
      setStatus("ready");
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (/unknown command/i.test(message)) {
        setStatus("unsupported");
      } else {
        setStatus("error");
        setError(message);
      }
    }
  };

  useEffect(() => {
    if (connected && link) void refresh();
    else {
      setInfo(null);
      setStatus("idle");
      setError(null);
    }
  }, [connected, link]);

  if (!connected) {
    return (
      <div className="rounded-lg border border-border-default bg-bg-secondary p-6">
        <h3 className="text-sm font-semibold text-text-primary">Device info</h3>
        <p className="mt-2 text-sm text-text-secondary">Connect the transmitter to read device info.</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border-default bg-bg-secondary p-6">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-text-primary">Device info</h3>
        <Button variant="ghost" size="sm" onClick={() => void refresh()} disabled={status === "loading"}>
          {status === "loading" ? "Reading..." : "Refresh"}
        </Button>
      </div>

      {status === "unsupported" && (
        <p className="mt-3 text-xs text-status-warning">
          This firmware build does not implement `SYSTEM INFO`. Upgrade to v0.0.21 or
          later to see chip id, flash capacity, and last reset reason.
        </p>
      )}

      {status === "error" && error && (
        <p className="mt-3 text-xs text-status-error">{error}</p>
      )}

      <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-3 text-xs md:grid-cols-3">
        <InfoRow
          label="Firmware"
          value={info?.firmware ?? firmware?.firmware ?? "--"}
          mono
        />
        <InfoRow
          label="Board"
          value={info?.board ?? firmware?.board ?? "unknown"}
        />
        <InfoRow
          label="MCU"
          value={info?.mcu ?? firmware?.mcu ?? "unknown"}
          mono
        />
        <InfoRow
          label="Chip ID"
          value={info?.chipId ? compactChipId(info.chipId) : firmware?.chipId ?? "(unknown)"}
          mono
        />
        <InfoRow
          label="Flash"
          value={info?.flashKb ? `${info.flashKb} KB` : "(unknown)"}
        />
        <InfoRow
          label="Last reset"
          value={info?.resetReason ? info.resetReason.toUpperCase() : "(unknown)"}
          mono
        />
        <InfoRow
          label="Uptime"
          value={info?.uptimeMs !== undefined ? formatUptime(info.uptimeMs) : "(unknown)"}
          mono
          className="col-span-2 md:col-span-3"
        />
      </dl>
    </div>
  );
}

/* ─────────────── sub-components ─────────────── */

function InfoRow({
  label,
  value,
  mono,
  className,
}: {
  label: string;
  value: string;
  mono?: boolean;
  className?: string;
}) {
  return (
    <div className={className}>
      <dt className="text-text-muted">{label}</dt>
      <dd className={mono ? "mt-0.5 font-mono text-text-primary break-all" : "mt-0.5 text-text-primary"}>
        {value}
      </dd>
    </div>
  );
}

/* ─────────────── helpers ─────────────── */

function compactChipId(id: string): string {
  if (id.length <= 16) return id;
  return `${id.slice(0, 8)}...${id.slice(-8)}`;
}

function formatUptime(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}
