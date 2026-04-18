"use client";

/**
 * @module TelemetryDashboard
 * @description Live CRSF telemetry dashboard. Starts the TELEM stream
 * on mount, stops it on unmount, and renders link + GPS + battery +
 * attitude + flight-mode tiles with per-tile staleness badges.
 * @license GPL-3.0-only
 */

import { useEffect } from "react";
import { useAdosEdgeStore } from "@/stores/ados-edge-store";
import { useAdosEdgeTelemetryStore } from "@/stores/ados-edge-telemetry-store";

const RAD_TO_DEG = 180 / Math.PI;

function fresh(last: number, windowMs = 3000): boolean {
  return last > 0 && Date.now() - last < windowMs;
}

function StatTile({
  label,
  value,
  unit,
  last,
  extra,
}: {
  label: string;
  value: string;
  unit?: string;
  last: number;
  extra?: string;
}) {
  const isFresh = fresh(last);
  return (
    <div className="rounded-lg border border-border bg-surface-secondary p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-text-muted">
          {label}
        </h3>
        <span className={`text-[10px] ${isFresh ? "text-status-success" : "text-status-warning"}`}>
          {last === 0 ? "no data" : isFresh ? "live" : "stale"}
        </span>
      </div>
      <div className="mt-2 flex items-baseline gap-1">
        <span className="text-2xl font-semibold tabular-nums text-text-primary">{value}</span>
        {unit && <span className="text-sm text-text-muted">{unit}</span>}
      </div>
      {extra && <div className="mt-1 text-xs text-text-muted">{extra}</div>}
    </div>
  );
}

export function TelemetryDashboard() {
  const connected = useAdosEdgeStore((s) => s.state === "connected");
  const link = useAdosEdgeTelemetryStore((s) => s.link);
  const gps = useAdosEdgeTelemetryStore((s) => s.gps);
  const battery = useAdosEdgeTelemetryStore((s) => s.battery);
  const attitude = useAdosEdgeTelemetryStore((s) => s.attitude);
  const mode = useAdosEdgeTelemetryStore((s) => s.mode);
  const lastLinkAt = useAdosEdgeTelemetryStore((s) => s.lastLinkAt);
  const lastGpsAt = useAdosEdgeTelemetryStore((s) => s.lastGpsAt);
  const lastBatteryAt = useAdosEdgeTelemetryStore((s) => s.lastBatteryAt);
  const lastAttitudeAt = useAdosEdgeTelemetryStore((s) => s.lastAttitudeAt);
  const lastModeAt = useAdosEdgeTelemetryStore((s) => s.lastModeAt);
  const streaming = useAdosEdgeTelemetryStore((s) => s.streaming);
  const start = useAdosEdgeTelemetryStore((s) => s.startStream);
  const stop = useAdosEdgeTelemetryStore((s) => s.stopStream);

  useEffect(() => {
    if (!connected) return undefined;
    void start();
    return () => {
      void stop();
    };
  }, [connected, start, stop]);

  if (!connected) {
    return (
      <div className="p-6 text-sm text-text-secondary">
        Connect the transmitter first.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 p-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-text-primary">Telemetry</h2>
        <span className={`text-xs ${streaming ? "text-status-success" : "text-text-muted"}`}>
          {streaming ? "TELEM stream on" : "idle"}
        </span>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatTile
          label="RSSI"
          value={link ? String(link.rssi1) : "--"}
          unit="dBm"
          last={lastLinkAt}
        />
        <StatTile
          label="Link quality"
          value={link ? String(link.lq) : "--"}
          unit="%"
          last={lastLinkAt}
        />
        <StatTile
          label="SNR"
          value={link ? String(link.snr) : "--"}
          unit="dB"
          last={lastLinkAt}
        />

        <StatTile
          label="Battery voltage"
          value={battery ? (battery.voltageDv / 10).toFixed(1) : "--"}
          unit="V"
          last={lastBatteryAt}
          extra={battery ? `${battery.pct}% / ${battery.mah} mAh used` : undefined}
        />
        <StatTile
          label="Battery current"
          value={battery ? (battery.currentDa / 10).toFixed(1) : "--"}
          unit="A"
          last={lastBatteryAt}
        />
        <StatTile
          label="Flight mode"
          value={mode?.name || "--"}
          last={lastModeAt}
        />

        <StatTile
          label="GPS"
          value={gps ? `${(gps.lat / 1e7).toFixed(5)}, ${(gps.lon / 1e7).toFixed(5)}` : "--"}
          last={lastGpsAt}
          extra={gps ? `${gps.sats} sats / ${gps.alt} m` : undefined}
        />
        <StatTile
          label="Pitch / Roll"
          value={
            attitude
              ? `${(attitude.pitch / 1e4 * RAD_TO_DEG).toFixed(1)} / ${(
                  attitude.roll / 1e4 * RAD_TO_DEG
                ).toFixed(1)}`
              : "--"
          }
          unit="deg"
          last={lastAttitudeAt}
        />
        <StatTile
          label="Yaw"
          value={attitude ? (attitude.yaw / 1e4 * RAD_TO_DEG).toFixed(1) : "--"}
          unit="deg"
          last={lastAttitudeAt}
        />
      </div>

      <p className="text-xs text-text-muted">
        Tiles go live as the firmware receives the corresponding CRSF frame
        types from the linked receiver.
      </p>
    </div>
  );
}
