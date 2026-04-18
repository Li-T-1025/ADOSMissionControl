"use client";

/**
 * @module TelemetryDashboard
 * @description Live CRSF telemetry dashboard. Starts the TELEM stream
 * on mount, stops it on unmount, and renders link stats plus a
 * freshness indicator so pilots can see when the feed has stalled.
 * @license GPL-3.0-only
 */

import { useEffect } from "react";
import { useAdosEdgeStore } from "@/stores/ados-edge-store";
import { useAdosEdgeTelemetryStore } from "@/stores/ados-edge-telemetry-store";

function StatTile({ label, value, unit }: { label: string; value: string; unit?: string }) {
  return (
    <div className="rounded-lg border border-border bg-surface-secondary p-4">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-text-muted">
        {label}
      </h3>
      <div className="mt-2 flex items-baseline gap-1">
        <span className="text-2xl font-semibold text-text-primary tabular-nums">{value}</span>
        {unit && <span className="text-sm text-text-muted">{unit}</span>}
      </div>
    </div>
  );
}

export function TelemetryDashboard() {
  const connected = useAdosEdgeStore((s) => s.state === "connected");
  const link = useAdosEdgeTelemetryStore((s) => s.link);
  const streaming = useAdosEdgeTelemetryStore((s) => s.streaming);
  const lastFrameAt = useAdosEdgeTelemetryStore((s) => s.lastFrameAt);
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

  const stale = streaming && lastFrameAt > 0 && Date.now() - lastFrameAt > 2000;
  const statusText = !streaming
    ? "idle"
    : lastFrameAt === 0
      ? "waiting for first frame"
      : stale
        ? "stale"
        : "streaming";
  const statusClass = stale
    ? "text-status-warning"
    : streaming && lastFrameAt > 0
      ? "text-status-success"
      : "text-text-muted";

  return (
    <div className="flex flex-col gap-4 p-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-text-primary">Telemetry</h2>
        <span className={`text-xs ${statusClass}`}>{statusText}</span>
      </div>

      {link ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <StatTile label="RSSI" value={String(link.rssi1)} unit="dBm" />
          <StatTile label="Link quality" value={String(link.lq)} unit="%" />
          <StatTile label="SNR" value={String(link.snr)} unit="dB" />
        </div>
      ) : (
        <div className="rounded-lg border border-border bg-surface-secondary p-6 text-sm text-text-secondary">
          No telemetry yet. The device forwards CRSF link stats once an
          ELRS link is up.
        </div>
      )}

      <p className="text-xs text-text-muted">
        GPS, battery, attitude, and flight-mode tiles light up as the
        firmware starts emitting those frame types over the CDC TELEM
        stream.
      </p>
    </div>
  );
}
