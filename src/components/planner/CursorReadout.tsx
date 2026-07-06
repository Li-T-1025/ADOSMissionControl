/**
 * @module CursorReadout
 * @description Small bottom-right map overlay showing the live cursor lat/lon and
 * a debounced terrain-elevation lookup as the operator moves the mouse over the
 * planner map. It listens for the {@link CURSOR_MOVE_EVENT} CustomEvent dispatched
 * by the in-map cursor tracker (kept self-contained via a DOM event so no shared
 * store field is needed for a value that changes on every mouse move). The
 * elevation fetch is debounced (~400ms), aborted on a fresh move, and skipped in
 * demo mode (the readout shows "—" there so no fabricated terrain value appears).
 * @license GPL-3.0-only
 */
"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { getElevation } from "@/lib/terrain/terrain-provider";
import { isDemoMode } from "@/lib/utils";
import { formatAltitude } from "@/lib/units/format";
import { useSettingsStore } from "@/stores/settings-store";
import type { CoordFormat } from "@/stores/settings-store";
import {
  formatLatLon,
  latLonToUTM,
  latLonToMGRS,
  mgrsLatBand,
} from "@/lib/coordinates/coordinate-format";

/** DOM event the in-map tracker fires with the cursor's map coordinate (or null on mouse-out). */
export const CURSOR_MOVE_EVENT = "plan:cursor-move";

/** Payload of {@link CURSOR_MOVE_EVENT}: the cursor's map coordinate. */
export interface CursorMoveDetail {
  readonly lat: number;
  readonly lon: number;
}

const DEBOUNCE_MS = 400;

/**
 * Render a cursor coordinate in the operator's chosen display format. "dd"/"dms"
 * defer to {@link formatLatLon}; "utm" gives a compact grid string
 * ("43R 712345E 1435678N", zone + latitude-band letter + rounded easting/northing);
 * "mgrs" gives the compact grid reference. Kept pure + exported so the format
 * switch is unit-testable without rendering the overlay.
 */
export function formatCursorCoord(
  lat: number,
  lon: number,
  format: CoordFormat,
): string {
  switch (format) {
    case "utm": {
      const utm = latLonToUTM(lat, lon);
      const easting = Math.round(utm.easting);
      const northing = Math.round(utm.northing);
      return `${utm.zone}${mgrsLatBand(lat)} ${easting}E ${northing}N`;
    }
    case "mgrs":
      return latLonToMGRS(lat, lon);
    case "dms":
      return formatLatLon(lat, lon, "dms");
    case "dd":
    default:
      return formatLatLon(lat, lon, "dd");
  }
}

export function CursorReadout() {
  const t = useTranslations("planner");
  const units = useSettingsStore((s) => s.units);
  const coordFormat = useSettingsStore((s) => s.coordFormat);
  const [coord, setCoord] = useState<CursorMoveDetail | null>(null);
  // null = not yet resolved (pending / not started); NaN = lookup failed/unavailable.
  const [elevation, setElevation] = useState<number | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const onMove = (e: Event) => {
      const detail = (e as CustomEvent<CursorMoveDetail | null>).detail;
      // A null payload (mouse left the map) hides the readout and cancels any
      // in-flight lookup.
      if (!detail) {
        if (debounceRef.current) clearTimeout(debounceRef.current);
        abortRef.current?.abort();
        setCoord(null);
        setElevation(null);
        return;
      }
      setCoord(detail);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      // Demo mode never hits the network; the readout shows "—" for elevation.
      if (isDemoMode()) {
        setElevation(null);
        return;
      }
      setElevation(null);
      debounceRef.current = setTimeout(() => {
        abortRef.current?.abort();
        const controller = new AbortController();
        abortRef.current = controller;
        getElevation(detail.lat, detail.lon, controller.signal)
          .then((el) => {
            // Drop a result whose lookup was superseded by a newer move.
            if (!controller.signal.aborted) setElevation(el);
          })
          .catch(() => {
            if (!controller.signal.aborted) setElevation(NaN);
          });
      }, DEBOUNCE_MS);
    };
    window.addEventListener(CURSOR_MOVE_EVENT, onMove);
    return () => {
      window.removeEventListener(CURSOR_MOVE_EVENT, onMove);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      abortRef.current?.abort();
    };
  }, []);

  if (!coord) return null;

  const elevationText = isDemoMode()
    ? "—"
    : elevation === null
      ? "…"
      : formatAltitude(elevation, units); // NaN renders as "—" from the formatter.

  return (
    <div className="absolute bottom-2 right-2 z-[1000] pointer-events-none text-[10px] font-mono bg-bg-primary/80 backdrop-blur-md rounded px-1.5 py-0.5 border border-border-strong shadow-lg text-text-secondary">
      <span className="text-text-primary">
        {formatCursorCoord(coord.lat, coord.lon, coordFormat)}
      </span>
      <span className="ml-2 text-text-tertiary">
        {t("cursorElevation")}: {elevationText}
      </span>
    </div>
  );
}
