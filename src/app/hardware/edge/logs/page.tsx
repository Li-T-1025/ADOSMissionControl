"use client";

/**
 * @module HardwareEdgeLogsPage
 * @description Log tail viewer entry point. Full virtualised tail with
 * severity filter chips and pause-resume lands when the firmware
 * exposes the logs stream (mirror of debug_puts output over USB CDC).
 * @license GPL-3.0-only
 */

import { ComingSoonPanel } from "@/components/hardware/transmitter/ComingSoonPanel";

export default function HardwareEdgeLogsPage() {
  return (
    <ComingSoonPanel
      title="Logs"
      body="Live tail of the radio's debug log output over USB. Filter by severity, search, pause auto-scroll, export a snapshot. Useful when bringing up a new sensor or debugging a stuck mixer."
      features={[
        "Virtualised tail: smooth scroll at 100 Hz log rate",
        "Severity filter chips: debug / info / warn / error (tri-state)",
        "Substring search with match highlight",
        "Pause keeps the ring buffer filling; resume jumps to tail",
        "Export: copy the filtered view to clipboard or download .log",
      ]}
      footer="Subscribes to the logs stream when the firmware ships the envelope dispatcher."
    />
  );
}
