/**
 * Betaflight serial-port constants: the MSP_CF_SERIAL_CONFIG function bits, the
 * baud-rate index table, and a port-identifier label. The functions field is a
 * U16, so only bits 0-15 are representable here; higher functions (FrSky OSD,
 * VTX MSP, gimbal, custom OSD text) need the MSP2 serial config (follow-on).
 *
 * @module fc/betaflight/bf-ports-constants
 */

// Exempt from 300 LOC soft rule: protocol data table.

/** MSP_CF_SERIAL_CONFIG function bits (the U16 functions bitmask). */
export const BF_SERIAL_FUNCTIONS: ReadonlyArray<{ bit: number; label: string }> = [
  { bit: 0, label: "MSP" },
  { bit: 1, label: "GPS" },
  { bit: 2, label: "FrSky Hub telemetry" },
  { bit: 3, label: "HoTT telemetry" },
  { bit: 4, label: "LTM telemetry" },
  { bit: 5, label: "SmartPort telemetry" },
  { bit: 6, label: "Serial RX" },
  { bit: 7, label: "Blackbox" },
  { bit: 9, label: "MAVLink telemetry" },
  { bit: 10, label: "ESC sensor" },
  { bit: 11, label: "VTX (SmartAudio)" },
  { bit: 12, label: "IBUS telemetry" },
  { bit: 13, label: "VTX (Tramp)" },
  { bit: 14, label: "RCDevice" },
  { bit: 15, label: "LIDAR TF" },
];

/** Baud-rate index → label; the MSP serial-config baud field is an index into this table. */
export const BF_BAUD_RATES: readonly string[] = [
  "Auto", "9600", "19200", "38400", "57600", "115200", "230400", "250000",
  "400000", "460800", "500000", "921600", "1000000", "1500000", "2000000", "2470000",
];

/** Friendly label for a Betaflight serial-port identifier value. */
export function bfPortLabel(identifier: number): string {
  if (identifier === 20) return "USB VCP";
  if (identifier >= 30 && identifier < 40) return `SOFTSERIAL${identifier - 29}`;
  if (identifier >= 40 && identifier < 50) return `LPUART${identifier - 39}`;
  if (identifier >= 50) return `UART${identifier - 50}`;
  return `Port ${identifier}`;
}
