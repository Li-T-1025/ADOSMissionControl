/**
 * An optional cockpit readout card showing heading / altitude / ground speed /
 * vertical speed / distance-to-home / GPS fix / link state. The instrument HUD
 * canvas already paints altitude/speed/heading, so this card is OFF by default
 * (a cockpit preset opts it in for operators who want a numeric strip).
 *
 * Read-only: it is pointer-events-none and never intercepts a click.
 *
 * @module fly/TelemetryStrip
 * @license GPL-3.0-only
 */

"use client";

import { useTranslations } from "next-intl";
import { useTelemetryStore } from "@/stores/telemetry-store";
import { useTrailStore } from "@/stores/trail-store";
import { haversineDistance } from "@/lib/drawing/geo-utils";

function fmt(n: number | undefined | null, digits = 0): string {
  if (n === undefined || n === null || !Number.isFinite(n)) return "--";
  return n.toFixed(digits);
}

interface ReadoutRowProps {
  label: string;
  value: string;
}

function ReadoutRow({ label, value }: ReadoutRowProps) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-white/50">{label}</span>
      <span className="tabular-nums text-white/90">{value}</span>
    </div>
  );
}

export function TelemetryStrip() {
  const t = useTranslations("cockpit");

  // Re-render on telemetry pushes via the freshness version; ring-buffer refs
  // are stable so a single subscription keeps the card live.
  useTelemetryStore((s) => s._version);
  useTrailStore((s) => s._version);

  const tState = useTelemetryStore.getState();
  const vfr = tState.vfr.latest();
  const pos = tState.position.latest();
  const gps = tState.gps.latest();
  const radio = tState.radio.latest();

  const trail = useTrailStore.getState()._ring.toArray();
  const home = trail.length > 0 ? trail[0] : null;
  const homeDist =
    home && pos && pos.lat !== 0 && pos.lon !== 0
      ? haversineDistance(home.lat, home.lon, pos.lat, pos.lon)
      : null;

  const heading = pos?.heading ?? vfr?.heading;
  const alt = pos?.alt ?? vfr?.alt;
  const speed = vfr?.groundspeed ?? pos?.groundSpeed;
  const vspd = vfr?.climb ?? pos?.climbRate;
  const fix = gps?.fixType ?? 0;
  const sats = gps?.satellites;
  const link = radio ? fmt(radio.rssi, 0) : "--";

  const gpsLabel =
    fix >= 3
      ? t("strip.gps3d", { sats: fmt(sats, 0) })
      : fix >= 2
        ? t("strip.gps2d", { sats: fmt(sats, 0) })
        : t("strip.gpsNoFix");

  return (
    <div className="absolute bottom-20 left-3 z-20 pointer-events-none w-44 px-3 py-2 bg-black/40 backdrop-blur-sm border border-white/10 text-[11px] font-mono uppercase tracking-wide space-y-0.5">
      <ReadoutRow label={t("strip.hdg")} value={`${fmt(heading, 0)}°`} />
      <ReadoutRow label={t("strip.alt")} value={`${fmt(alt, 0)} m`} />
      <ReadoutRow label={t("strip.spd")} value={`${fmt(speed, 1)} m/s`} />
      <ReadoutRow label={t("strip.vspd")} value={`${fmt(vspd, 1)} m/s`} />
      <ReadoutRow
        label={t("strip.home")}
        value={homeDist === null ? "--" : `${fmt(homeDist, 0)} m`}
      />
      <ReadoutRow label={t("strip.gps")} value={gpsLabel} />
      <ReadoutRow label={t("strip.link")} value={link} />
    </div>
  );
}
