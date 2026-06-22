/**
 * The cockpit top band: a thin, read-only superset of the HUD TopBar tailored
 * for the immersive Fly cockpit. It carries the exit affordance, the drone's
 * display name, flight mode, an armed indicator, link/GPS, and a right-hand
 * group of altitude / speed / battery / flight timer.
 *
 * The band itself is pointer-events-none so a click falls through to the video
 * (and to a designation target in a plugin overlay); only the ◀ exit button
 * opts back to pointer-events-auto.
 *
 * @module fly/CockpitTopBar
 * @license GPL-3.0-only
 */

"use client";

import { memo, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { ChevronLeft } from "lucide-react";
import { useDroneStore } from "@/stores/drone-store";
import { useDroneManager } from "@/stores/drone-manager";
import { useDroneMetadataStore } from "@/stores/drone-metadata-store";
import { useHudTopBarData } from "@/hooks/use-hud-topbar-data";

const LOW_BATTERY_PERCENT = 20;

function fmt(n: number | undefined | null, digits = 0): string {
  if (n === undefined || n === null || !Number.isFinite(n)) return "--";
  return n.toFixed(digits);
}

/** mm:ss flight clock, started when the vehicle first arms and reset on disarm. */
function useFlightTimer(armed: boolean): string {
  // Elapsed whole-seconds since arming; null while disarmed. Driven by the 1 Hz
  // interval below — the label is derived in render, so the effect never calls
  // setState synchronously on the disarm reset.
  const [elapsedSec, setElapsedSec] = useState(0);

  useEffect(() => {
    // Only run the clock while armed. On disarm the effect simply tears down the
    // interval (no synchronous setState reset) and the label is derived as
    // "--:--" from the `armed` prop below, so a cascading-render reset is
    // avoided.
    if (!armed) return;
    const startedAt = Date.now();
    const tick = () => setElapsedSec(Math.floor((Date.now() - startedAt) / 1000));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [armed]);

  if (!armed) return "--:--";
  const m = Math.floor(elapsedSec / 60);
  const s = elapsedSec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

interface CockpitTopBarProps {
  /** Invoked by the ◀ exit affordance to leave the cockpit. */
  onExit: () => void;
}

function CockpitTopBarInner({ onExit }: CockpitTopBarProps) {
  const t = useTranslations("cockpit");
  const { radio, vfr, battery, gps } = useHudTopBarData();
  const mode = useDroneStore((s) => s.flightMode);
  const armState = useDroneStore((s) => s.armState);
  const armed = armState === "armed";

  const selectedDroneId = useDroneManager((s) => s.selectedDroneId);
  const displayName = useDroneMetadataStore((s) =>
    selectedDroneId ? s.profiles[selectedDroneId]?.displayName : undefined,
  );
  const name = displayName ?? selectedDroneId ?? t("noDrone");

  const timer = useFlightTimer(armed);

  const rssi = radio ? fmt(radio.rssi, 0) : "--";
  const sats = gps ? fmt(gps.satellites, 0) : "--";
  const alt = vfr ? fmt(vfr.alt, 0) : "--";
  const spd = vfr ? fmt(vfr.groundspeed, 1) : "--";
  const batteryPct = battery?.remaining;
  const bat = battery ? fmt(batteryPct, 0) : "--";
  const batteryLow =
    typeof batteryPct === "number" &&
    Number.isFinite(batteryPct) &&
    batteryPct <= LOW_BATTERY_PERCENT;

  return (
    <div className="absolute top-0 inset-x-0 z-20 h-10 px-2 flex items-center justify-between bg-black/40 backdrop-blur-sm text-xs font-mono uppercase tracking-wide text-white/90 pointer-events-none">
      {/* Left group: exit + identity + mode + armed + link */}
      <div className="flex items-center gap-3 min-w-0">
        <button
          type="button"
          onClick={onExit}
          aria-label={t("exit")}
          title={t("exit")}
          className="pointer-events-auto flex items-center gap-1 px-1.5 py-1 text-white/70 hover:text-white transition-colors"
        >
          <ChevronLeft size={14} />
          <span className="hidden sm:inline">{t("exit")}</span>
        </button>
        <span className="min-w-0 max-w-[10rem] truncate normal-case text-white font-semibold">
          {name}
        </span>
        <span>{t("mode", { mode })}</span>
        <span className="flex items-center gap-1">
          <span
            className={
              armed ? "w-2 h-2 bg-status-warning" : "w-2 h-2 bg-white/30"
            }
            aria-hidden
          />
          {armed ? t("armed") : t("disarmed")}
        </span>
        <span className="hidden md:inline">{t("rssi", { value: rssi })}</span>
        <span className="hidden md:inline">{t("sats", { value: sats })}</span>
      </div>

      {/* Right group: altitude / speed / battery / timer */}
      <div className="flex items-center gap-3">
        <span>{t("alt", { value: alt })}</span>
        <span>{t("spd", { value: spd })}</span>
        <span className={batteryLow ? "text-status-error" : undefined}>
          {t("bat", { value: bat })}
        </span>
        <span>{t("timer", { value: timer })}</span>
      </div>
    </div>
  );
}

export const CockpitTopBar = memo(CockpitTopBarInner);
