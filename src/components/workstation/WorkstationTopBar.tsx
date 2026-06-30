/**
 * @module components/workstation/WorkstationTopBar
 * @description The workstation's top status band: a thin, read-only summary of
 * the currently selected node — display name, flight mode, armed state, link
 * (connection + RSSI), GPS fix, and battery. It reads the same selection source
 * the {@link DockviewHost} builds its panel context from
 * (`useDroneStore.selectedId` + `connectionState`) plus the live telemetry ring
 * buffers via {@link useHudTopBarData}, so it never asserts a state the stores
 * do not hold. When no node is selected it renders a quiet idle band.
 *
 * @license GPL-3.0-only
 */

"use client";

import { useTranslations } from "next-intl";
import { Plane } from "lucide-react";
import { useDroneStore } from "@/stores/drone-store";
import { useDroneMetadataStore } from "@/stores/drone-metadata-store";
import { useHudTopBarData } from "@/hooks/use-hud-topbar-data";
import { cn } from "@/lib/utils";

const LOW_BATTERY_PERCENT = 20;

/** Format a numeric telemetry value, falling back to "--" when absent. */
function fmt(n: number | undefined | null, digits = 0): string {
  if (n === undefined || n === null || !Number.isFinite(n)) return "--";
  return n.toFixed(digits);
}

/** Map a MAVLink GPS fix_type to its i18n leaf key under workstation.topbar. */
function gpsFixKey(fixType: number | undefined): string {
  switch (fixType) {
    case 2:
      return "fix2d";
    case 3:
      return "fix3d";
    case 4:
      return "fixDgps";
    case 5:
      return "fixRtkFloat";
    case 6:
      return "fixRtk";
    default:
      return "fixNone";
  }
}

/** A label/value pair rendered in the band. */
function Field({ label, value }: { label: string; value: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="text-text-tertiary">{label}</span>
      <span className="font-mono text-text-primary">{value}</span>
    </span>
  );
}

export function WorkstationTopBar(): React.ReactElement {
  const t = useTranslations("workstation.topbar");
  const selectedId = useDroneStore((s) => s.selectedId);
  const connectionState = useDroneStore((s) => s.connectionState);
  const flightMode = useDroneStore((s) => s.flightMode);
  const armState = useDroneStore((s) => s.armState);
  const displayName = useDroneMetadataStore((s) =>
    selectedId ? s.profiles[selectedId]?.displayName : undefined,
  );
  const { radio, battery, gps } = useHudTopBarData();

  const armed = armState === "armed";
  const connected =
    connectionState === "connected" ||
    connectionState === "armed" ||
    connectionState === "in_flight";

  // Idle band: no node selected.
  if (!selectedId) {
    return (
      <div
        role="status"
        aria-label={t("label")}
        className="flex h-9 shrink-0 items-center gap-2 border-b border-border-default bg-bg-secondary px-3 text-xs text-text-tertiary"
      >
        <Plane className="h-3.5 w-3.5" aria-hidden="true" />
        <span className="font-medium">{t("noNode")}</span>
        <span className="hidden text-text-tertiary/70 sm:inline">
          {t("noNodeHint")}
        </span>
      </div>
    );
  }

  const name = displayName ?? selectedId;
  const rssi = radio ? fmt(radio.rssi, 0) : "--";
  const sats = gps?.satellites ?? 0;
  const batteryPct = battery?.remaining;
  const bat = battery ? fmt(batteryPct, 0) : "--";
  const batteryLow =
    typeof batteryPct === "number" &&
    Number.isFinite(batteryPct) &&
    batteryPct <= LOW_BATTERY_PERCENT;

  return (
    <div
      role="status"
      aria-label={t("label")}
      className="flex h-9 shrink-0 items-center justify-between gap-4 border-b border-border-default bg-bg-secondary px-3 text-xs"
    >
      {/* Identity + mode + armed */}
      <div className="flex min-w-0 items-center gap-3">
        <span className="min-w-0 max-w-[14rem] truncate font-semibold text-text-primary">
          {name}
        </span>
        <Field label={t("mode")} value={flightMode} />
        <span className="flex items-center gap-1.5 text-text-secondary">
          <span
            aria-hidden="true"
            className={cn(
              "h-2 w-2 rounded-full",
              armed ? "bg-status-warning" : "bg-text-tertiary/50",
            )}
          />
          {armed ? t("armed") : t("disarmed")}
        </span>
      </div>

      {/* Link / GPS / battery */}
      <div className="flex items-center gap-4">
        <span className="flex items-center gap-1.5 text-text-secondary">
          <span
            aria-hidden="true"
            className={cn(
              "h-2 w-2 rounded-full",
              connected ? "bg-status-success" : "bg-status-error",
            )}
          />
          <span className="text-text-tertiary">{t("link")}</span>
          <span className="font-mono text-text-primary">
            {connected ? t("rssi", { value: rssi }) : t("offline")}
          </span>
        </span>
        <Field
          label={t("gps")}
          value={`${t(gpsFixKey(gps?.fixType))} · ${t("sats", { count: sats })}`}
        />
        <span className="flex items-center gap-1.5">
          <span className="text-text-tertiary">{t("battery")}</span>
          <span
            className={cn(
              "font-mono",
              batteryLow ? "text-status-error" : "text-text-primary",
            )}
          >
            {bat}%
          </span>
        </span>
      </div>
    </div>
  );
}
