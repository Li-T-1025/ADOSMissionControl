/**
 * Betaflight LED-strip constants + packed-config codec.
 *
 * Each LED is a packed U32 (MSP_LED_STRIP_CONFIG): position (x/y), function,
 * overlay bitmask, color index, and direction bitmask. The function/direction/
 * overlay labels are the LED-strip wire vocabulary.
 *
 * @module fc/betaflight/bf-led-constants
 */

// Exempt from 300 LOC soft rule: protocol data table + bit codec.

/** LED functions (single value per LED). */
export const BF_LED_FUNCTIONS: readonly string[] = [
  "Color", "Flight mode", "Arm state", "Battery", "RSSI", "GPS",
  "Thrust ring", "GPS bar", "Battery bar", "Altitude",
];

/** LED direction flags (a LED can face several directions). */
export const BF_LED_DIRECTIONS: readonly string[] = ["North", "East", "South", "West", "Up", "Down"];

/** LED overlay flags (stacked effects). */
export const BF_LED_OVERLAYS: readonly string[] = [
  "Throttle", "Rainbow", "Larson scanner", "Blink", "VTX", "Indicator", "Warning",
];

/** Number of configurable palette colors. */
export const BF_LED_COLOR_COUNT = 16;

export interface BfLed {
  x: number;
  y: number;
  color: number;
  /** Index into BF_LED_FUNCTIONS. */
  fn: number;
  /** Direction flags bitmask (bit i = BF_LED_DIRECTIONS[i]). */
  directions: number;
  /** Overlay flags bitmask (bit i = BF_LED_OVERLAYS[i]). */
  overlays: number;
}

/** Unpack a packed LED config U32 into its fields. */
export function unpackLed(v: number): BfLed {
  return {
    x: (v >> 4) & 0x0f,
    y: v & 0x0f,
    fn: (v >> 8) & 0x0f,
    overlays: (v >> 12) & 0x3ff,
    color: (v >> 22) & 0x0f,
    directions: (v >> 26) & 0x3f,
  };
}

/** Pack a LED's fields back into the U32 config value. */
export function packLed(l: BfLed): number {
  const v =
    (((l.x & 0x0f) << 4) | (l.y & 0x0f)) |
    ((l.fn & 0x0f) << 8) |
    ((l.overlays & 0x3ff) << 12) |
    ((l.color & 0x0f) << 22) |
    ((l.directions & 0x3f) << 26);
  return v >>> 0; // keep it an unsigned 32-bit value
}

/** Toggle bit `i` of a flags bitmask. */
export function toggleFlag(mask: number, i: number, on: boolean): number {
  return on ? mask | (1 << i) : mask & ~(1 << i);
}
