"use client";

import { Compass, Radio, Navigation } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTelemetryStore } from "@/stores/telemetry-store";
import { useTelemetryFreshness } from "@/hooks/use-telemetry-freshness";

interface FlightDataCardProps {
  className?: string;
}

const FIX_LABELS: Record<number, { label: string; color: string }> = {
  0: { label: "No Fix", color: "text-status-error" },
  1: { label: "No Fix", color: "text-status-error" },
  2: { label: "2D Fix", color: "text-status-warning" },
  3: { label: "3D Fix", color: "text-status-success" },
  4: { label: "DGPS", color: "text-status-success" },
  5: { label: "RTK Float", color: "text-accent-primary" },
  6: { label: "RTK Fix", color: "text-accent-primary" },
};

function normalizeHeading(deg: number) {
  return ((deg % 360) + 360) % 360;
}

export function FlightDataCard({ className }: FlightDataCardProps) {
  useTelemetryStore((s) => s._version);
  const attitude = useTelemetryStore((s) => s.attitude);
  const position = useTelemetryStore((s) => s.position);
  const gps = useTelemetryStore((s) => s.gps);
  const radio = useTelemetryStore((s) => s.radio);
  const freshness = useTelemetryFreshness();

  const att = attitude.latest();
  const pos = position.latest();
  const gpsData = gps.latest();
  const radioData = radio.latest();

  // The ring buffers keep their last sample when the link dies, so a stale
  // value would otherwise render as live (0deg roll, etc.). Gate the
  // attitude/heading readouts on channel freshness: once a channel goes
  // "lost"/"none" (no sample within the freshness window) blank it to the
  // placeholder rather than show the frozen last value.
  const isChannelLive = (level: string) =>
    level === "fresh" || level === "stale";
  const attLive = isChannelLive(freshness.getFreshness("attitude"));
  const posLive = isChannelLive(freshness.getFreshness("position"));
  const headingLive = attLive || posLive;
  // We have buffered attitude data but it has gone stale — the link is silent.
  const attStale = att !== undefined && !attLive;

  const fix = FIX_LABELS[gpsData?.fixType ?? 0] ?? FIX_LABELS[0];
  // Gate GPS-derived fields on a real fix. Without a fix
  // the FC reports HDOP ~655, lat/lon 0.0, MSL 0.0, heading 360 — all
  // garbage that pollutes the bench dashboard.
  const hasFix = (gpsData?.fixType ?? 0) >= 2;
  // Gate the GPS readouts on BOTH a real fix AND channel freshness: a silent
  // link keeps the last buffered fix, which would otherwise render frozen
  // lat/lon/MSL/sats as if live (the same stale-as-live class blanked above for
  // attitude). gps-derived fields use gps freshness; pos-derived use position.
  const gpsLive = isChannelLive(freshness.getFreshness("gps"));
  const gpsShow = hasFix && gpsLive;
  const posShow = hasFix && posLive;
  // Attitude/heading in the telemetry store are ALREADY in degrees (the
  // ingest handler converts MAVLink radians once). Format them directly —
  // re-applying a rad->deg conversion here yielded the ~57x garbage.
  const heading = pos?.heading ?? (att ? normalizeHeading(att.yaw) : undefined);

  const fmtDeg = (v: number | undefined) =>
    v !== undefined ? v.toFixed(1) : "--.-";
  const fmtHdg = (v: number | undefined) =>
    v !== undefined ? v.toFixed(0).padStart(3, "0") : "---";

  return (
    <div
      className={cn(
        "border border-border-default rounded-lg bg-bg-secondary p-3",
        className
      )}
    >
      {/* Header */}
      <div className="flex items-center gap-1.5 mb-2">
        <Compass className="w-3.5 h-3.5 text-text-tertiary" />
        <span className="text-xs font-medium text-text-secondary">
          Flight Data
        </span>
        {attStale && (
          <span className="ml-auto text-[10px] font-medium text-status-warning">
            link silent
          </span>
        )}
      </div>

      {/* Attitude section */}
      <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-[11px]">
        <div className="flex justify-between">
          <span className="text-text-tertiary">Roll</span>
          <span className="font-mono text-text-primary">
            {fmtDeg(attLive ? att?.roll : undefined)}&deg;
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-text-tertiary">Pitch</span>
          <span className="font-mono text-text-primary">
            {fmtDeg(attLive ? att?.pitch : undefined)}&deg;
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-text-tertiary">Yaw</span>
          <span className="font-mono text-text-primary">
            {fmtDeg(attLive ? att?.yaw : undefined)}&deg;
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-text-tertiary">Hdg</span>
          <span className="font-mono text-text-primary">
            {fmtHdg(headingLive ? heading : undefined)}&deg;
          </span>
        </div>
      </div>

      {/* GPS section */}
      <div className="border-t border-border-default mt-2 pt-2">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-1">
            <Navigation className="w-3 h-3 text-text-tertiary" />
            <span className="text-[10px] font-medium text-text-secondary">
              GPS
            </span>
          </div>
          <span
            className={cn(
              "text-[10px] font-mono font-medium",
              gpsLive ? fix.color : "text-text-tertiary"
            )}
          >
            {gpsLive ? fix.label : "--"}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-[11px]">
          <div className="flex justify-between">
            <span className="text-text-tertiary">Sats</span>
            <span className="font-mono text-text-primary">
              {gpsLive ? (gpsData?.satellites ?? "--") : "--"}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-text-tertiary">HDOP</span>
            <span className="font-mono text-text-primary">
              {gpsShow ? gpsData!.hdop.toFixed(1) : "--.-"}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-text-tertiary">Lat</span>
            <span className="font-mono text-text-primary">
              {gpsShow ? gpsData!.lat.toFixed(6) : "---.------"}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-text-tertiary">Lon</span>
            <span className="font-mono text-text-primary">
              {gpsShow ? gpsData!.lon.toFixed(6) : "---.------"}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-text-tertiary">MSL</span>
            <span className="font-mono text-text-primary">
              {gpsShow ? `${gpsData!.alt.toFixed(1)}m` : "--.-m"}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-text-tertiary">Rel</span>
            <span className="font-mono text-text-primary">
              {posShow && pos ? `${pos.relativeAlt.toFixed(1)}m` : "--.-m"}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-text-tertiary">Hdg</span>
            <span className="font-mono text-text-primary">
              {posShow && pos ? `${pos.heading.toFixed(0)}\u00B0` : "--\u00B0"}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-text-tertiary">GS</span>
            <span className="font-mono text-text-primary">
              {posShow && pos ? `${pos.groundSpeed.toFixed(1)} m/s` : "-- m/s"}
            </span>
          </div>
        </div>
      </div>

      {/* Radio section */}
      <div className="border-t border-border-default mt-2 pt-2">
        <div className="flex items-center gap-1 mb-1">
          <Radio className="w-3 h-3 text-text-tertiary" />
          <span className="text-[10px] font-medium text-text-secondary">
            Radio
          </span>
        </div>

        <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-[11px]">
          <div className="flex justify-between">
            <span className="text-text-tertiary">RSSI</span>
            <span className="font-mono text-text-primary">
              {radioData ? `${radioData.rssi} dBm` : "-- dBm"}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-text-tertiary">Remote</span>
            <span className="font-mono text-text-primary">
              {radioData ? `${radioData.remrssi} dBm` : "-- dBm"}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-text-tertiary">TX</span>
            <span className="font-mono text-text-primary">
              {radioData ? `${radioData.txbuf}%` : "--%"}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-text-tertiary">RX Err</span>
            <span className="font-mono text-text-primary">
              {radioData ? `${radioData.rxerrors}` : "--"}
            </span>
          </div>
        </div>
      </div>

      {/* No data fallback */}
      {!att && !gpsData && !radioData && (
        <div className="text-[10px] text-text-tertiary text-center mt-2">
          Waiting for telemetry...
        </div>
      )}
    </div>
  );
}
