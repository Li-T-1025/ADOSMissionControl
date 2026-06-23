/**
 * Human-readable parameter value formatting (enums, bitmasks).
 *
 * @module protocol/param-display
 * @license GPL-3.0-only
 */

import type { ParamMetadata } from "./param-metadata";

/**
 * Format a numeric param value for read-only display.
 * Enum params become "5 — Loiter"; others return the numeric string.
 */
export function formatParamDisplayValue(
  value: number,
  meta?: ParamMetadata | null,
): string {
  if (meta?.values && meta.values.size > 0) {
    // Exact key match; MAVLink params are often integers stored as floats
    const intKey = Math.trunc(value);
    const label =
      meta.values.get(value) ??
      meta.values.get(intKey) ??
      (Number.isInteger(value) ? undefined : meta.values.get(Math.round(value)));
    if (label !== undefined) {
      return `${intKey === value || Number.isInteger(value) ? (Number.isInteger(value) ? value : intKey) : value} \u2014 ${label}`;
    }
  }
  return String(value);
}
