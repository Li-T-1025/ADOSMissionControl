"use client";

/**
 * @module HardwareEdgeLogsPage
 * @description Log tail viewer entry point. Renders the full
 * virtualised tail with severity filter chips, search, and
 * pause / resume controls. Subscribes to the firmware logs stream
 * on mount and releases it on unmount.
 * @license GPL-3.0-only
 */

import { LogsView } from "@/components/hardware/transmitter/LogsView";

export default function HardwareEdgeLogsPage() {
  return <LogsView />;
}
